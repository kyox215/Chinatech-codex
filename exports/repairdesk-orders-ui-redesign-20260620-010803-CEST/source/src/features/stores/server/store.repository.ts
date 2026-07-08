import { cookies } from "next/headers";

import type {
  ActorStoreMembership,
  AuditActor,
  StoreContext,
  StoreCreateInput,
  StoreInvitation,
  StoreInviteInput,
  StoreMember,
  StoreMembersResult,
  StoreMembershipStatus,
  StoreRole,
} from "@/lib/repairdesk/types";
import { writeAuditLog } from "@/server/audit";
import { ForbiddenError } from "@/server/auth-context";
import { type DbRecord, fail, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

const ACTIVE_STORE_COOKIE = "repairdesk-store-id";
const STORE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getStoreContext(actor: AuditActor): Promise<StoreContext> {
  return {
    activeStore: activeStoreFromActor(actor),
    stores: actor.stores ?? [],
  };
}

export async function switchActiveStore(storeId: string, actor: AuditActor): Promise<StoreContext> {
  const store = await assertStoreMembership(storeId, actor);
  await setActiveStoreCookie(store.id);
  await writeAuditLog({
    actor,
    action: "switch",
    entityType: "store",
    entityId: store.id,
    metadata: { store_name: store.name },
  });
  return nextContext(actor, store);
}

export async function createStore(
  input: StoreCreateInput,
  actor: AuditActor,
): Promise<StoreContext> {
  if (!actor.id || actor.isSystem) {
    throw new ForbiddenError("需要登录员工账号后才能创建店铺");
  }

  const name = sanitizeStoreName(input.name);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const slug = await uniqueStoreSlug(supabase, name);

  const { data: storeRow, error: storeError } = await supabase
    .from("stores")
    .insert({
      name,
      slug,
      owner_user_id: actor.id,
      status: "active",
      plan: "starter",
      timezone: input.timezone || "Europe/Rome",
      currency_code: input.currency_code || "EUR",
      created_at: now,
      updated_at: now,
    })
    .select("id, name, slug, status")
    .single();
  fail(storeError, "创建店铺失败");

  const store = storeFromRow(storeRow as DbRecord, "owner");
  const { error: membershipError } = await supabase.from("store_memberships").insert({
    store_id: store.id,
    user_id: actor.id,
    email: actor.email || `${actor.id}@unknown.local`,
    display_name: actor.displayName,
    role: "owner",
    status: "active",
    created_at: now,
    updated_at: now,
  });
  fail(membershipError, "创建店铺成员关系失败");

  await setActiveStoreCookie(store.id);
  await writeAuditLog({
    actor: { ...actor, storeId: store.id, storeName: store.name, storeRole: "owner" },
    action: "create",
    entityType: "store",
    entityId: store.id,
    after: { ...store },
  });

  return nextContext(actor, store);
}

export async function listStoreMembers(actor: AuditActor): Promise<StoreMembersResult> {
  const storeId = requireActiveStoreId(actor);
  const supabase = getSupabaseAdmin();
  const [membersResult, invitationsResult] = await Promise.all([
    supabase
      .from("store_memberships")
      .select("id, user_id, email, display_name, role, status, created_at, updated_at")
      .eq("store_id", storeId)
      .order("role", { ascending: true })
      .order("email", { ascending: true }),
    supabase
      .from("store_invitations")
      .select(
        "id, email, role, status, invited_by, accepted_at, expires_at, created_at, updated_at",
      )
      .eq("store_id", storeId)
      .eq("status", "invited")
      .order("created_at", { ascending: false }),
  ]);
  fail(membersResult.error, "读取店铺成员失败");
  fail(invitationsResult.error, "读取店铺邀请失败");

  return {
    members: ((membersResult.data ?? []) as DbRecord[]).map(memberFromRow),
    invitations: ((invitationsResult.data ?? []) as DbRecord[]).map(invitationFromRow),
  };
}

export async function inviteStoreMember(
  input: StoreInviteInput,
  actor: AuditActor,
): Promise<StoreMembersResult> {
  assertCanManageStoreMembers(actor);
  const storeId = requireActiveStoreId(actor);
  const email = sanitizeEmail(input.email);
  const role = sanitizeInviteRole(input.role);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existingMembership, error: membershipReadError } = await supabase
    .from("store_memberships")
    .select("id")
    .eq("store_id", storeId)
    .ilike("email", email)
    .eq("status", "active")
    .maybeSingle();
  fail(membershipReadError, "检查店铺成员失败");
  if (existingMembership) throw new Error("该邮箱已经是当前店铺成员");

  const { data: staffRow, error: staffError } = await supabase
    .from("staff_profiles")
    .select("id, email, display_name, status")
    .ilike("email", email)
    .maybeSingle();
  fail(staffError, "检查员工账号失败");

  if (staffRow) {
    const staff = staffRow as DbRecord;
    if (staff.status !== "active") throw new Error("该员工账号已停用");
    const { error: upsertError } = await supabase.from("store_memberships").upsert(
      {
        store_id: storeId,
        user_id: requiredString(staff.id),
        email: requiredString(staff.email),
        display_name: requiredString(staff.display_name),
        role,
        status: "active",
        updated_at: now,
      },
      { onConflict: "store_id,user_id" },
    );
    fail(upsertError, "添加店铺成员失败");
  }

  const { data: existingInvite, error: inviteReadError } = await supabase
    .from("store_invitations")
    .select("id")
    .eq("store_id", storeId)
    .ilike("email", email)
    .eq("status", "invited")
    .maybeSingle();
  fail(inviteReadError, "检查店铺邀请失败");

  const invitePayload = {
    store_id: storeId,
    email,
    role,
    token_hash: crypto.randomUUID(),
    status: staffRow ? "active" : "invited",
    invited_by: actor.id ?? null,
    accepted_at: staffRow ? now : null,
    expires_at: expiresAt,
    updated_at: now,
  };

  const { data: invitation, error: inviteError } = existingInvite
    ? await supabase
        .from("store_invitations")
        .update(invitePayload)
        .eq("id", requiredString((existingInvite as DbRecord).id))
        .select("*")
        .single()
    : await supabase
        .from("store_invitations")
        .insert({ id: crypto.randomUUID(), ...invitePayload, created_at: now })
        .select("*")
        .single();
  fail(inviteError, "保存店铺邀请失败");

  await writeAuditLog({
    actor,
    action: "invite",
    entityType: "store_invitation",
    entityId: requiredString((invitation as DbRecord).id),
    after: invitation as Record<string, unknown>,
    metadata: { email, role, accepted_immediately: Boolean(staffRow) },
  });

  return listStoreMembers(actor);
}

async function assertStoreMembership(
  storeId: string,
  actor: AuditActor,
): Promise<ActorStoreMembership> {
  if (!actor.id || actor.isSystem) throw new ForbiddenError();

  const localStore = actor.stores?.find((store) => store.id === storeId);
  if (localStore?.status === "active") return localStore;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_memberships")
    .select("id, store_id, role, status, store:stores(id, name, slug, status)")
    .eq("user_id", actor.id)
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();
  fail(error, "读取店铺成员关系失败");
  if (!data) throw new ForbiddenError("你没有权限进入这个店铺");

  const row = data as StoreMembershipRow;
  const store = Array.isArray(row.store) ? row.store[0] : row.store;
  if (!store || store.status !== "active") throw new ForbiddenError("店铺不可用");
  return {
    id: requiredString(row.store_id) || requiredString(store.id),
    name: requiredString(store.name),
    slug: requiredString(store.slug),
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
  };
}

function requireActiveStoreId(actor: AuditActor) {
  if (!actor.storeId || actor.isSystem) throw new ForbiddenError();
  return actor.storeId;
}

function assertCanManageStoreMembers(actor: AuditActor) {
  const role = actor.storeRole ?? actor.role;
  if (actor.isSystem || role === "owner" || role === "manager") return;
  throw new ForbiddenError("只有店铺 owner 或 manager 可以管理员工");
}

async function uniqueStoreSlug(supabase: ReturnType<typeof getSupabaseAdmin>, name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0 ? "" : `-${crypto.randomUUID().slice(0, 6)}`;
    const candidate = `${base}${suffix}`.slice(0, 64).replace(/-+$/g, "");
    const { data, error } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    fail(error, "检查店铺标识失败");
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64).replace(/-+$/g, "");
}

async function setActiveStoreCookie(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STORE_COOKIE_MAX_AGE,
  });
}

function nextContext(actor: AuditActor, activeStore: ActorStoreMembership): StoreContext {
  const stores = actor.stores?.filter((store) => store.id !== activeStore.id) ?? [];
  return {
    activeStore,
    stores: [activeStore, ...stores],
  };
}

function activeStoreFromActor(actor: AuditActor): ActorStoreMembership | undefined {
  if (!actor.storeId) return undefined;
  return (
    actor.stores?.find((store) => store.id === actor.storeId) ?? {
      id: actor.storeId,
      name: actor.storeName || "RepairDesk",
      slug: "store",
      role: actor.storeRole ?? actor.role ?? "viewer",
      status: "active",
    }
  );
}

function storeFromRow(row: DbRecord, role: StoreRole): ActorStoreMembership {
  return {
    id: requiredString(row.id),
    name: requiredString(row.name),
    slug: requiredString(row.slug),
    role,
    status: toMembershipStatus(row.status),
  };
}

function memberFromRow(row: DbRecord): StoreMember {
  return {
    id: requiredString(row.id),
    user_id: requiredString(row.user_id),
    email: requiredString(row.email),
    display_name: requiredString(row.display_name) || undefined,
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function invitationFromRow(row: DbRecord): StoreInvitation {
  return {
    id: requiredString(row.id),
    email: requiredString(row.email),
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    invited_by: requiredString(row.invited_by) || undefined,
    accepted_at: requiredString(row.accepted_at) || undefined,
    expires_at: requiredString(row.expires_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function sanitizeStoreName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("店铺名称至少需要 2 个字符");
  if (name.length > 80) throw new Error("店铺名称不能超过 80 个字符");
  return name;
}

function sanitizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  return email;
}

function sanitizeInviteRole(value: StoreInviteInput["role"]): StoreInviteInput["role"] {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  throw new Error("邀请角色不正确");
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length >= 3 ? slug : `store-${crypto.randomUUID().slice(0, 6)}`;
}

function toStoreRole(value: unknown): StoreRole {
  if (
    value === "owner" ||
    value === "manager" ||
    value === "technician" ||
    value === "sales" ||
    value === "viewer"
  ) {
    return value;
  }
  return "viewer";
}

function toMembershipStatus(value: unknown): StoreMembershipStatus {
  if (value === "active" || value === "invited" || value === "inactive") return value;
  return "inactive";
}

interface StoreMembershipRow {
  store_id?: string;
  role?: unknown;
  status?: unknown;
  store?: StoreRow | StoreRow[];
}

interface StoreRow {
  id?: string;
  name?: string;
  slug?: string;
  status?: unknown;
}
