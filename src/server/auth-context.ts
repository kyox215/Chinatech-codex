import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/server/supabase";
import { cookies } from "next/headers";
import type {
  ActorStoreMembership,
  AuditActor,
  StaffProfile,
  StoreMembershipStatus,
  StoreRole,
} from "@/lib/repairdesk/types";

export class UnauthorizedError extends Error {
  constructor(message = "未登录或登录已过期") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "当前员工没有权限执行此操作") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const systemActor: AuditActor = {
  displayName: "系统",
  isSystem: true,
};

export function hasBrowserAuthConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function getRequestActor(required = true): Promise<AuditActor> {
  if (!hasBrowserAuthConfig()) {
    if (required) return systemActor;
    return systemActor;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    if (!required) return systemActor;
    throw new UnauthorizedError();
  }

  const email = typeof claims.email === "string" ? claims.email : undefined;
  if (!hasSupabaseConfig()) {
    return {
      id: claims.sub,
      email,
      displayName: email ?? "员工",
    };
  }

  const admin = getSupabaseAdmin();
  const staff = await ensureStaffProfile({
    admin,
    userId: claims.sub,
    email,
  });
  if (staff.status !== "active") throw new ForbiddenError("当前员工账号已停用");

  await acceptPendingStoreInvitations(admin, staff);
  const memberships = await getActiveStoreMemberships(admin, staff);
  const activeStore = await resolveActiveStore(admin, staff, memberships);

  return {
    id: staff.id,
    email: staff.email || email,
    displayName: staff.display_name || staff.email || email || "员工",
    role: activeStore.role || staff.role,
    storeId: activeStore.id,
    storeName: activeStore.name,
    storeRole: activeStore.role,
    stores: memberships.length ? memberships : [activeStore],
  };
}

export function assertStaffRole(actor: AuditActor, roles: readonly string[]) {
  if (actor.isSystem) return;
  const role = actor.storeRole ?? actor.role;
  if (!role || !roles.includes(role)) {
    throw new ForbiddenError();
  }
}

async function ensureStaffProfile({
  admin,
  userId,
  email,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  email?: string;
}): Promise<StaffProfile> {
  const { data: profile, error: profileError } = await admin
    .from("staff_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(`读取员工档案失败：${profileError.message}`);
  if (profile) return profile as StaffProfile;

  const fallbackName = displayNameFromEmail(email);
  const { data: inserted, error: insertError } = await admin
    .from("staff_profiles")
    .insert({
      id: userId,
      email: email || `${userId}@unknown.local`,
      display_name: fallbackName,
      role: "owner",
      status: "active",
    })
    .select("*")
    .single();

  if (insertError) throw new Error(`创建员工档案失败：${insertError.message}`);
  return inserted as StaffProfile;
}

async function getActiveStoreMemberships(
  admin: ReturnType<typeof getSupabaseAdmin>,
  staff: StaffProfile,
): Promise<ActorStoreMembership[]> {
  const { data, error } = await admin
    .from("store_memberships")
    .select("id, store_id, role, status, store:stores(id, name, slug, status)")
    .eq("user_id", staff.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`读取店铺会员关系失败：${error.message}`);
  }

  return ((data ?? []) as StoreMembershipRow[])
    .map((row) => {
      const store = Array.isArray(row.store) ? row.store[0] : row.store;
      if (!store || store.status !== "active") return undefined;
      return {
        id: String(store.id || row.store_id),
        name: String(store.name || "RepairDesk"),
        slug: String(store.slug || "store"),
        role: toStoreRole(row.role),
        status: toMembershipStatus(row.status),
      };
    })
    .filter((store): store is ActorStoreMembership => Boolean(store));
}

async function acceptPendingStoreInvitations(
  admin: ReturnType<typeof getSupabaseAdmin>,
  staff: StaffProfile,
) {
  if (!staff.email) return;

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("store_invitations")
    .select("id, store_id, email, role, status, expires_at")
    .ilike("email", staff.email)
    .eq("status", "invited")
    .gt("expires_at", now);

  if (error) throw new Error(`读取店铺邀请失败：${error.message}`);

  for (const invitation of (data ?? []) as StoreInvitationRow[]) {
    const storeId = String(invitation.store_id || "");
    if (!storeId) continue;

    const { error: membershipError } = await admin.from("store_memberships").upsert(
      {
        store_id: storeId,
        user_id: staff.id,
        email: staff.email,
        display_name: staff.display_name,
        role: toStoreRole(invitation.role),
        status: "active",
        updated_at: now,
      },
      { onConflict: "store_id,user_id" },
    );
    if (membershipError) throw new Error(`接受店铺邀请失败：${membershipError.message}`);

    const { error: invitationError } = await admin
      .from("store_invitations")
      .update({ status: "active", accepted_at: now, updated_at: now })
      .eq("id", invitation.id);
    if (invitationError) throw new Error(`更新店铺邀请失败：${invitationError.message}`);
  }
}

async function resolveActiveStore(
  admin: ReturnType<typeof getSupabaseAdmin>,
  staff: StaffProfile,
  memberships: ActorStoreMembership[],
): Promise<ActorStoreMembership> {
  if (memberships.length === 0) {
    return createPersonalStore(admin, staff);
  }

  const cookieStore = await cookies();
  const requestedStoreId = cookieStore.get("repairdesk-store-id")?.value;
  return memberships.find((store) => store.id === requestedStoreId) ?? memberships[0];
}

async function createPersonalStore(
  admin: ReturnType<typeof getSupabaseAdmin>,
  staff: StaffProfile,
): Promise<ActorStoreMembership> {
  const name = `${staff.display_name || displayNameFromEmail(staff.email)} 的店铺`;
  const slug = `${slugify(staff.email || staff.display_name || "repairdesk")}-${crypto
    .randomUUID()
    .slice(0, 8)}`;

  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({
      name,
      slug,
      owner_user_id: staff.id,
      status: "active",
      plan: "starter",
      timezone: "Europe/Rome",
      currency_code: "EUR",
    })
    .select("id, name, slug")
    .single();

  if (storeError) throw new Error(`创建默认店铺失败：${storeError.message}`);
  const storeRow = store as { id: string; name: string; slug: string };

  const { error: membershipError } = await admin.from("store_memberships").insert({
    store_id: storeRow.id,
    user_id: staff.id,
    email: staff.email,
    display_name: staff.display_name,
    role: "owner",
    status: "active",
  });

  if (membershipError) throw new Error(`创建店铺会员关系失败：${membershipError.message}`);

  return {
    id: storeRow.id,
    name: storeRow.name,
    slug: storeRow.slug,
    role: "owner",
    status: "active",
  };
}

function displayNameFromEmail(email?: string) {
  return (
    email
      ?.split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "店铺管理员"
  );
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug.length >= 3 ? slug : "store";
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
  id?: string;
  store_id?: string;
  role?: unknown;
  status?: unknown;
  store?: StoreRow | StoreRow[];
}

interface StoreInvitationRow {
  id?: string;
  store_id?: string;
  role?: unknown;
}

interface StoreRow {
  id?: string;
  name?: string;
  slug?: string;
  status?: string;
}
