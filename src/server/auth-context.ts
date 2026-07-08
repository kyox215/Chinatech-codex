import { createHash } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/server/supabase";
import { cookies, headers } from "next/headers";
import { assertRepairDeskBrowserAuthMode } from "@/server/repairdesk-source-mode";
import { resolveStaffDisplayName } from "@/server/staff-display-name";
import type {
  ActorStoreMembership,
  AuditActor,
  StaffProfile,
  StoreMembershipStatus,
  StoreRole,
} from "@/lib/repairdesk/types";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

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

export interface RequestActorOptions {
  allowPendingStore?: boolean;
}

export function hasBrowserAuthConfig() {
  if (isRepairDeskE2eAuthBypassEnabled()) return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function getRequestActor(
  required = true,
  options: RequestActorOptions = {},
): Promise<AuditActor> {
  const requestIpHash = await getRequestIpHash();
  if (!hasBrowserAuthConfig()) {
    assertRepairDeskBrowserAuthMode({ hasBrowserAuthConfig: false });
    if (required) return { ...systemActor, requestIpHash };
    return { ...systemActor, requestIpHash };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    if (!required) return { ...systemActor, requestIpHash };
    throw new UnauthorizedError();
  }

  const email = typeof claims.email === "string" ? claims.email : undefined;
  const emailVerifiedFromClaims = isVerifiedEmailClaim(claims);
  if (!hasSupabaseConfig()) {
    return {
      id: claims.sub,
      email,
      emailVerified: emailVerifiedFromClaims,
      displayName: resolveStaffDisplayName({ email, displayName: email, fallback: "员工" }),
      requestIpHash,
    };
  }

  const admin = getSupabaseAdmin();
  const emailVerified = emailVerifiedFromClaims
    ? true
    : await resolveVerifiedEmailFromAuthUser(admin, claims.sub);
  const staff = await ensureStaffProfile({
    admin,
    userId: claims.sub,
    email,
  });
  if (staff.status !== "active") throw new ForbiddenError("当前员工账号已停用");

  const isPlatformAdmin = await isActivePlatformAdmin(admin, staff);
  const memberships = await getActiveStoreMemberships(admin, staff);
  const activeStore = memberships.length ? await resolveActiveStore(memberships) : undefined;
  if (!activeStore && !options.allowPendingStore) {
    throw new ForbiddenError("账号尚未加入店铺，请先提交申请并等待平台管理员审批");
  }

  return {
    id: staff.id,
    email: staff.email || email,
    emailVerified,
    displayName: resolveStaffDisplayName({
      email: staff.email || email,
      displayName: staff.display_name,
      role: activeStore?.role || staff.role,
      fallback: "员工",
    }),
    role: activeStore?.role || staff.role,
    isPlatformAdmin,
    storeId: activeStore?.id,
    storeName: activeStore?.name,
    storeRole: activeStore?.role,
    stores: memberships,
    requestIpHash,
  };
}

export function assertStaffRole(actor: AuditActor, roles: readonly string[]) {
  if (actor.isSystem) return;
  const role = actor.storeRole ?? actor.role;
  if (!role || !roles.includes(role)) {
    throw new ForbiddenError();
  }
}

export function assertVerifiedEmail(actor: AuditActor) {
  if (actor.emailVerified === true) return;
  throw new ForbiddenError("请先验证账号邮箱后再继续");
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

  const fallbackName = resolveStaffDisplayName({ email, fallback: "Staff" });
  const { data: inserted, error: insertError } = await admin
    .from("staff_profiles")
    .insert({
      id: userId,
      email: email || `${userId}@unknown.local`,
      display_name: fallbackName,
      role: "viewer",
      status: "active",
    })
    .select("*")
    .single();

  if (insertError) throw new Error(`创建员工档案失败：${insertError.message}`);
  return inserted as StaffProfile;
}

async function isActivePlatformAdmin(
  admin: ReturnType<typeof getSupabaseAdmin>,
  staff: StaffProfile,
) {
  const { data, error } = await admin
    .from("platform_admins")
    .select("user_id, status")
    .eq("user_id", staff.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    if (error.message.includes("platform_admins")) return false;
    throw new Error(`读取平台管理员权限失败：${error.message}`);
  }
  return Boolean(data);
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

async function resolveActiveStore(
  memberships: ActorStoreMembership[],
): Promise<ActorStoreMembership | undefined> {
  if (memberships.length === 0) return undefined;
  const cookieStore = await cookies();
  const requestedStoreId = cookieStore.get("repairdesk-store-id")?.value;
  return memberships.find((store) => store.id === requestedStoreId) ?? memberships[0];
}

async function getRequestIpHash() {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = headerStore.get("x-real-ip")?.trim();
    const ip = forwardedFor || realIp;
    if (!ip) return undefined;
    return createHash("sha256").update(ip).digest("hex");
  } catch {
    return undefined;
  }
}

function isVerifiedEmailClaim(claims: Record<string, unknown>) {
  if (claims.email_verified === true) return true;
  if (typeof claims.email_confirmed_at === "string" && claims.email_confirmed_at) return true;

  const userMetadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : undefined;
  if (userMetadata?.email_verified === true) return true;

  const appMetadata =
    claims.app_metadata && typeof claims.app_metadata === "object"
      ? (claims.app_metadata as Record<string, unknown>)
      : undefined;
  return appMetadata?.email_verified === true;
}

async function resolveVerifiedEmailFromAuthUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return false;
  const user = data.user;
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  if (user.confirmed_at) return true;
  if (user.user_metadata?.email_verified === true) return true;
  return user.app_metadata?.email_verified === true;
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

interface StoreRow {
  id?: string;
  name?: string;
  slug?: string;
  status?: string;
}
