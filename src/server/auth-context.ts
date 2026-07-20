import { createHash } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/server/supabase";
import { cookies, headers } from "next/headers";
import { assertRepairDeskBrowserAuthMode } from "@/server/repairdesk-source-mode";
import { resolveStaffDisplayName } from "@/server/staff-display-name";
import { isStorePermissionAction } from "@/entities/staff/model/store-permission-policy";
import type {
  ActorStoreMembership,
  AuditActor,
  StaffProfile,
  StoreLifecycleState,
  StorePermissionAction,
  StoreMembershipStatus,
  StoreRole,
} from "@/lib/repairdesk/types";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import { isPlatformOwnerEmail, PLATFORM_OWNER_EMAIL } from "@/shared/config/platform-authority";

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
  const authAssurance = resolveAuthAssuranceFromClaims(claims);
  if (!hasSupabaseConfig()) {
    return {
      id: claims.sub,
      email,
      emailVerified: emailVerifiedFromClaims,
      displayName: resolveStaffDisplayName({ email, displayName: email, fallback: "员工" }),
      requestIpHash,
      ...authAssurance,
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

  const isPlatformAdmin = await isActivePlatformAdmin(admin, {
    userId: staff.id,
    authenticatedEmail: email,
    emailVerified,
  });
  const memberships = await getActiveStoreMemberships(admin, staff);
  const activeStoreResolution = memberships.length
    ? await resolveActiveStore(memberships)
    : undefined;
  const activeStore = activeStoreResolution?.store;
  const businessStores = memberships.filter(
    (store) => !store.lifecycle || store.lifecycle.phase === "active",
  );
  const recoveryStores = memberships.filter(
    (store) =>
      store.isPrimaryOwner === true &&
      (store.lifecycle?.phase === "closing" ||
        store.lifecycle?.phase === "archived" ||
        store.lifecycle?.phase === "purge_scheduled" ||
        store.lifecycle?.phase === "purging" ||
        store.lifecycle?.phase === "purge_failed"),
  );
  if (!activeStore && !options.allowPendingStore) {
    throw new ForbiddenError("账号尚未加入店铺，请先提交申请并等待平台管理员审批");
  }
  const permissionGrants = activeStore
    ? await getActiveStorePermissionGrants(admin, staff.id, activeStore.id)
    : [];

  return {
    id: staff.id,
    email,
    emailVerified,
    displayName: resolveStaffDisplayName({
      email,
      displayName: staff.display_name,
      role: activeStore?.role || staff.role,
      fallback: "员工",
    }),
    phoneE164: staff.phone_e164 ?? null,
    phoneVerifiedAt: staff.phone_verified_at ?? null,
    role: activeStore?.role || staff.role,
    isPlatformAdmin,
    storeId: activeStore?.id,
    storeName: activeStore?.name,
    storeRole: activeStore?.role,
    activeMembershipId: activeStore?.membershipId,
    permissionGrants,
    stores: businessStores,
    recoveryStores,
    activeStoreExplicit: activeStoreResolution?.explicit ?? false,
    requestIpHash,
    ...authAssurance,
  };
}

export function resolveAuthAssuranceFromClaims(
  claims: Record<string, unknown>,
): Pick<AuditActor, "authAssuranceLevel" | "recentAuthAt"> {
  const authAssuranceLevel = claims.aal === "aal2" ? "aal2" : "aal1";
  const totpTimestamps = Array.isArray(claims.amr)
    ? claims.amr
        .map((entry) => {
          if (!entry || typeof entry !== "object") return undefined;
          const authentication = entry as Record<string, unknown>;
          if (authentication.method !== "totp") return undefined;
          const timestamp = authentication.timestamp;
          return typeof timestamp === "number" && Number.isFinite(timestamp)
            ? timestamp
            : undefined;
        })
        .filter((timestamp): timestamp is number => timestamp !== undefined)
    : [];
  const latestAuthenticationSeconds = Math.max(...totpTimestamps, 0);
  return {
    authAssuranceLevel,
    ...(latestAuthenticationSeconds > 0
      ? { recentAuthAt: new Date(latestAuthenticationSeconds * 1000).toISOString() }
      : {}),
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
  if (profile) {
    const current = profile as StaffProfile;
    const normalizedAuthEmail = email?.trim().toLowerCase();
    if (!normalizedAuthEmail || current.email.trim().toLowerCase() === normalizedAuthEmail) {
      return current;
    }
    const { data: synced, error: syncError } = await admin
      .from("staff_profiles")
      .update({ email: normalizedAuthEmail, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single();
    if (syncError) throw new Error(`同步员工登录邮箱失败：${syncError.message}`);
    return synced as StaffProfile;
  }

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

export async function isActivePlatformAdmin(
  admin: ReturnType<typeof getSupabaseAdmin>,
  identity: {
    userId: string;
    authenticatedEmail?: string;
    emailVerified: boolean;
  },
) {
  if (!identity.emailVerified || !isPlatformOwnerEmail(identity.authenticatedEmail)) return false;
  const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(
    identity.userId,
  );
  if (authUserError) {
    throw new Error(`读取平台负责人身份失败：${authUserError.message}`);
  }
  if (
    !authUserResult.user ||
    !isPlatformOwnerEmail(authUserResult.user.email) ||
    !isVerifiedEmailAuthUser(authUserResult.user)
  ) {
    return false;
  }
  const { data, error } = await admin
    .from("platform_admins")
    .select("user_id, status")
    .eq("user_id", identity.userId)
    .eq("email", PLATFORM_OWNER_EMAIL)
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
    .select("id, store_id, role, status, store:stores(id, name, slug, status, owner_user_id)")
    .eq("user_id", staff.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`读取店铺会员关系失败：${error.message}`);
  }

  const memberships = ((data ?? []) as StoreMembershipRow[])
    .map((row): ActorStoreMembership | undefined => {
      const store = Array.isArray(row.store) ? row.store[0] : row.store;
      if (!store || store.status !== "active") return undefined;
      return {
        id: String(store.id || row.store_id),
        ...(row.id ? { membershipId: String(row.id) } : {}),
        name: String(store.name || "RepairDesk"),
        slug: String(store.slug || "store"),
        role: toStoreRole(row.role),
        status: toMembershipStatus(row.status),
        isPrimaryOwner: store.owner_user_id === staff.id,
      };
    })
    .filter((store): store is ActorStoreMembership => Boolean(store));

  if (memberships.length === 0) return memberships;
  const { data: lifecycleRows, error: lifecycleError } = await admin
    .from("store_lifecycles")
    .select(
      "store_id, phase, revision, close_requested_at, access_cutoff_at, archive_eligible_at, archived_at, purge_after, retention_until, legal_hold_until",
    )
    .in(
      "store_id",
      memberships.map((store) => store.id),
    );
  if (lifecycleError && !isLifecycleTableUnavailable(lifecycleError)) {
    throw new Error(`读取店铺状态失败：${lifecycleError.message}`);
  }
  const lifecycleByStore = new Map(
    ((lifecycleRows ?? []) as Record<string, unknown>[]).map((row) => [
      String(row.store_id),
      lifecycleFromRow(row),
    ]),
  );
  return memberships.map((store) => ({
    ...store,
    ...(lifecycleByStore.has(store.id) ? { lifecycle: lifecycleByStore.get(store.id) } : {}),
  }));
}

async function getActiveStorePermissionGrants(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  storeId: string,
): Promise<StorePermissionAction[]> {
  const { data, error } = await admin
    .from("store_member_permission_grants")
    .select("action")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) {
    if (isMissingPermissionGrantsTableError(error)) return [];
    throw new Error(`读取员工权限失败：${error.message}`);
  }

  return ((data ?? []) as { action?: unknown }[])
    .map((row) => row.action)
    .filter(isStorePermissionAction);
}

async function resolveActiveStore(
  memberships: ActorStoreMembership[],
): Promise<{ store: ActorStoreMembership; explicit: boolean } | undefined> {
  const available = memberships.filter(
    (store) => !store.lifecycle || store.lifecycle.phase === "active",
  );
  if (available.length === 0) return undefined;
  const cookieStore = await cookies();
  const requestedStoreId = cookieStore.get("repairdesk-store-id")?.value;
  const requestedStore = available.find((store) => store.id === requestedStoreId);
  return {
    store: requestedStore ?? available[0],
    explicit: available.length === 1 || Boolean(requestedStore),
  };
}

function lifecycleFromRow(row: Record<string, unknown>): StoreLifecycleState {
  const optionalIso = (key: string) =>
    typeof row[key] === "string" && row[key] ? { [key]: row[key] as string } : {};
  return {
    store_id: String(row.store_id),
    phase: row.phase as StoreLifecycleState["phase"],
    revision: Number(row.revision),
    ...optionalIso("close_requested_at"),
    ...optionalIso("access_cutoff_at"),
    ...optionalIso("archive_eligible_at"),
    ...optionalIso("archived_at"),
    ...optionalIso("purge_after"),
    ...optionalIso("retention_until"),
    ...optionalIso("legal_hold_until"),
  };
}

function isLifecycleTableUnavailable(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  return (
    error.code === "42P01" || (error.code === "PGRST205" && message.includes("store_lifecycles"))
  );
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

export function isVerifiedEmailClaim(claims: Record<string, unknown>) {
  if (claims.email_verified === true) return true;
  if (typeof claims.email_confirmed_at === "string" && claims.email_confirmed_at) return true;

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
  return isVerifiedEmailAuthUser(user);
}

export function isVerifiedEmailAuthUser(user: {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  if (user.email_confirmed_at) return true;
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

function isMissingPermissionGrantsTableError(error: { message?: string; code?: string }) {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" &&
    message.includes("store_member_permission_grants") &&
    message.includes("schema cache")
  );
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
  owner_user_id?: string;
}
