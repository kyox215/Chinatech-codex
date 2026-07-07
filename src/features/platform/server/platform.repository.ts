import type {
  AccountProfileUpdateInput,
  AuditActor,
  OnboardingDecisionInput,
  OnboardingRequest,
  OnboardingRequestInput,
  OnboardingStatus,
  StoreInvitation,
  StoreMembershipStatus,
  StoreRole,
} from "@/lib/repairdesk/types";
import {
  canPlatformApproveOnboardingRequest,
  canPlatformRejectOnboardingRequest,
  createOnboardingAuditSnapshot,
  redactRequesterOnboardingRequest,
} from "@/features/platform/model/onboarding-review-policy";
import { sanitizeAuditRecord } from "@/server/audit";
import { ForbiddenError } from "@/server/auth-context";
import { type DbRecord, fail, maybeString, requiredString } from "@/server/repairdesk-shared";
import { resolveStaffDisplayName } from "@/server/staff-display-name";
import { getSupabaseAdmin } from "@/server/supabase";

export async function getOnboardingStatus(actor: AuditActor): Promise<OnboardingStatus> {
  assertLoggedIn(actor);
  const supabase = getSupabaseAdmin();

  const requestsResult = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("requester_user_id", actor.id)
    .order("created_at", { ascending: false });
  fail(requestsResult.error, "读取注册申请失败");
  const invitationsResult = actor.email
    ? await supabase
        .from("store_invitations")
        .select("id, email, role, status, expires_at, created_at, updated_at, store:stores(name)")
        .eq("email", sanitizeEmail(actor.email))
        .eq("status", "invited")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  fail(invitationsResult.error, "读取店铺邀请失败");

  return {
    userId: actor.id,
    email: actor.email,
    displayName: actor.displayName,
    isPlatformAdmin: Boolean(actor.isPlatformAdmin),
    activeStore: actor.storeId
      ? {
          id: actor.storeId,
          name: actor.storeName || "RepairDesk",
          slug: actor.stores?.find((store) => store.id === actor.storeId)?.slug || "store",
          role: actor.storeRole ?? actor.role ?? "viewer",
          status: "active",
        }
      : undefined,
    stores: actor.stores ?? [],
    requests: ((requestsResult.data ?? []) as DbRecord[]).map((row) =>
      redactRequesterOnboardingRequest(onboardingRequestFromRow(row)),
    ),
    invitations: ((invitationsResult.data ?? []) as DbRecord[]).map(storeInvitationFromRow),
    availableStores: [],
  };
}

export async function updateAccountProfile(
  input: AccountProfileUpdateInput,
  actor: AuditActor,
): Promise<OnboardingStatus> {
  assertLoggedIn(actor);
  const userId = requiredString(actor.id);
  const displayName = sanitizeDisplayName(input.display_name);
  const publicDisplayName = resolveStaffDisplayName({
    email: actor.email,
    displayName,
    role: actor.storeRole || actor.role,
  });
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("staff_profiles")
    .update({
      display_name: displayName,
      updated_at: now,
    })
    .eq("id", userId)
    .select("*")
    .single();
  fail(error, "更新账号名称失败");

  const { error: membershipError } = await supabase
    .from("store_memberships")
    .update({
      display_name: displayName,
      updated_at: now,
    })
    .eq("user_id", userId);
  fail(membershipError, "同步店铺成员名称失败");

  await writePlatformAuditLog({
    actor: { ...actor, displayName: publicDisplayName },
    action: "update_account_profile",
    entityType: "staff_profile",
    entityId: userId,
    before: { display_name: actor.displayName },
    after: { display_name: publicDisplayName, email: (data as DbRecord).email },
  });

  return getOnboardingStatus({ ...actor, displayName: publicDisplayName });
}

export async function submitOnboardingRequest(
  input: OnboardingRequestInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertLoggedIn(actor);
  const requestType = input.request_type;
  if (requestType === "create_store") {
    throw new Error("创建店铺请使用创建店铺接口");
  }
  const supabase = getSupabaseAdmin();
  const existing = await getLatestOpenRequest(supabase, requiredString(actor.id));
  if (existing) throw new Error("你已经有一个待审核申请，请等待平台管理员处理");

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    requester_user_id: actor.id,
    email: sanitizeEmail(actor.email || ""),
    display_name: actor.displayName,
    request_type: requestType,
    requested_role: sanitizeJoinRole(input.requested_role),
    request_note: sanitizeOptionalNote(input.note),
    review_scope: "platform",
    status: "pending",
    created_at: now,
    updated_at: now,
  };

  if (input.target_store_id) {
    throw new Error("加入店铺请填写负责人邮箱；邀请链接和邀请码会在后续版本启用");
  }
  if (input.target_owner_email) {
    const ownerEmail = sanitizeTargetOwnerEmail(input.target_owner_email);
    payload.target_owner_email = ownerEmail;
    const store = await findSingleApproverStoreByEmail(supabase, ownerEmail);
    if (store && !payload.target_store_id) {
      payload.target_store_id = store.id;
      payload.target_store_name = store.name;
      payload.review_scope = "store";
    }
  }

  const { data, error } = await supabase
    .from("onboarding_requests")
    .insert(payload)
    .select("*")
    .single();
  fail(error, "提交注册申请失败");

  await writePlatformAuditLog({
    actor,
    action: "submit_onboarding_request",
    entityType: "onboarding_request",
    entityId: requiredString((data as DbRecord).id),
    after: createOnboardingAuditSnapshot(onboardingRequestFromRow(data as DbRecord)),
  });

  return redactRequesterOnboardingRequest(onboardingRequestFromRow(data as DbRecord));
}

export async function cancelOnboardingRequest(
  input: OnboardingDecisionInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertLoggedIn(actor);
  const supabase = getSupabaseAdmin();
  const request = await getPendingRequesterRequest(supabase, input.id, requiredString(actor.id));
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "cancelled",
      decision_note: sanitizeOptionalNote(input.note),
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("requester_user_id", actor.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  fail(error, "取消申请失败");
  if (!data) throw new Error("申请已处理，请刷新后再试");

  await writePlatformAuditLog({
    actor,
    action: "cancel_onboarding_request",
    entityType: "onboarding_request",
    entityId: request.id,
    before: createOnboardingAuditSnapshot(request),
    after: createOnboardingAuditSnapshot(onboardingRequestFromRow(data as DbRecord)),
  });

  return redactRequesterOnboardingRequest(onboardingRequestFromRow(data as DbRecord));
}

export async function listPlatformOnboardingRequests(
  actor: AuditActor,
): Promise<OnboardingRequest[]> {
  assertPlatformAdmin(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("status", "pending")
    .eq("review_scope", "platform")
    .order("created_at", { ascending: true });
  fail(error, "读取平台审批列表失败");
  return ((data ?? []) as DbRecord[]).map(onboardingRequestFromRow);
}

export async function approveOnboardingRequest(
  input: OnboardingDecisionInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertPlatformAdmin(actor);
  const supabase = getSupabaseAdmin();
  const request = await getPendingRequest(supabase, input.id);
  if (request.request_type === "create_store") {
    throw new ForbiddenError("平台不再审批创建店铺；请使用创建店铺接口");
  }
  if (!canPlatformApproveOnboardingRequest(request)) {
    throw new ForbiddenError("加入私有店铺必须由目标店铺负责人审批");
  }
  throw new ForbiddenError("平台不再审批加入店铺；请由目标店铺负责人处理");
}

export async function rejectOnboardingRequest(
  input: OnboardingDecisionInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertPlatformAdmin(actor);
  const supabase = getSupabaseAdmin();
  const request = await getPendingRequest(supabase, input.id);
  if (!canPlatformRejectOnboardingRequest(request)) {
    throw new ForbiddenError("店铺加入申请必须由目标店铺负责人处理");
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "rejected",
      reviewed_by: actor.id,
      reviewed_at: now,
      decision_note: sanitizeOptionalNote(input.note),
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("status", "pending")
    .eq("review_scope", "platform")
    .select("*")
    .maybeSingle();
  fail(error, "拒绝注册申请失败");
  if (!data) throw new Error("申请已处理，请刷新后再试");

  await writePlatformAuditLog({
    actor,
    action: "reject_onboarding_request",
    entityType: "onboarding_request",
    entityId: request.id,
    before: createOnboardingAuditSnapshot(request),
    after: createOnboardingAuditSnapshot(onboardingRequestFromRow(data as DbRecord)),
  });

  return onboardingRequestFromRow(data as DbRecord);
}

async function getLatestOpenRequest(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data, error } = await supabase
    .from("onboarding_requests")
    .select("id")
    .eq("requester_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  fail(error, "检查待审核申请失败");
  return data;
}

async function getPendingRequesterRequest(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  id: string,
  userId: string,
): Promise<OnboardingRequest> {
  const { data, error } = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("id", id)
    .eq("requester_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  fail(error, "读取待取消申请失败");
  if (!data) throw new Error("申请不存在或已处理");
  return onboardingRequestFromRow(data as DbRecord);
}

async function getPendingRequest(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  id: string,
): Promise<OnboardingRequest> {
  const { data, error } = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  fail(error, "读取注册申请失败");
  if (!data) throw new Error("申请不存在或已处理");
  return onboardingRequestFromRow(data as DbRecord);
}

async function findSingleApproverStoreByEmail(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  email: string,
) {
  const { data, error } = await supabase
    .from("store_memberships")
    .select("store_id, store:stores(id, name, status)")
    .eq("email", email)
    .eq("status", "active")
    .in("role", ["owner", "manager"]);
  fail(error, "匹配店铺负责人失败");

  const stores = new Map<string, { id: string; name: string }>();
  for (const row of (data ?? []) as DbRecord[]) {
    const storeRow = Array.isArray(row.store) ? row.store[0] : row.store;
    if (!storeRow || (storeRow as DbRecord).status !== "active") continue;
    const id = requiredString((storeRow as DbRecord).id) || requiredString(row.store_id);
    if (!id) continue;
    stores.set(id, {
      id,
      name: requiredString((storeRow as DbRecord).name) || "未命名店铺",
    });
  }

  return stores.size === 1 ? [...stores.values()][0] : undefined;
}

async function writePlatformAuditLog({
  actor,
  action,
  entityType,
  entityId,
  before,
  after,
}: {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  const { error } = await getSupabaseAdmin()
    .from("platform_audit_logs")
    .insert({
      id: crypto.randomUUID(),
      actor_id: actor.id ?? null,
      actor_email: actor.email ?? null,
      actor_name: actor.displayName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: sanitizeAuditRecord(before),
      after_data: sanitizeAuditRecord(after),
      metadata: {},
    });
  fail(error, "写入平台审计日志失败");
}

function onboardingRequestFromRow(row: DbRecord): OnboardingRequest {
  return {
    id: requiredString(row.id),
    requester_user_id: requiredString(row.requester_user_id),
    email: requiredString(row.email),
    display_name: maybeString(row.display_name),
    request_type: row.request_type === "join_store" ? "join_store" : "create_store",
    desired_store_name: maybeString(row.desired_store_name),
    target_store_id: maybeString(row.target_store_id),
    target_store_name: maybeString(row.target_store_name),
    target_owner_email: maybeString(row.target_owner_email),
    request_note: maybeString(row.request_note),
    review_scope: toReviewScope(row.review_scope),
    requested_role: toStoreRole(row.requested_role),
    approved_role: toApprovedRole(row.approved_role),
    status: toRequestStatus(row.status),
    reviewed_by: maybeString(row.reviewed_by),
    reviewed_by_membership_id: maybeString(row.reviewed_by_membership_id),
    reviewed_at: maybeString(row.reviewed_at),
    decision_note: maybeString(row.decision_note),
    resulting_store_id: maybeString(row.resulting_store_id),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function storeInvitationFromRow(row: DbRecord): StoreInvitation {
  const store = Array.isArray(row.store) ? row.store[0] : (row.store as DbRecord | undefined);
  return {
    id: requiredString(row.id),
    store_name: store ? requiredString(store.name) || undefined : undefined,
    email: requiredString(row.email),
    role: toStoreRole(row.role),
    status: toMembershipStatus(row.status),
    expires_at: requiredString(row.expires_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function assertLoggedIn(actor: AuditActor) {
  if (!actor.id || actor.isSystem) throw new ForbiddenError("需要登录后继续");
}

function assertPlatformAdmin(actor: AuditActor) {
  assertLoggedIn(actor);
  if (!actor.isPlatformAdmin) throw new ForbiddenError("只有平台管理员可以处理注册申请");
}

function sanitizeDisplayName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1) throw new Error("账号名称不能为空");
  if (name.length > 60) throw new Error("账号名称不能超过 60 个字符");
  return name;
}

function sanitizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("当前账号邮箱格式不正确");
  return email;
}

function sanitizeTargetOwnerEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("店铺负责人邮箱格式不正确");
  return email;
}

function sanitizeOptionalNote(value?: string) {
  const note = value?.trim().replace(/\s+/g, " ");
  if (!note) return null;
  if (note.length > 500) throw new Error("申请备注不能超过 500 个字符");
  return note;
}

function sanitizeJoinRole(value?: StoreRole): Exclude<StoreRole, "owner"> {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  return "viewer";
}

function toApprovedRole(value: unknown): OnboardingRequest["approved_role"] {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  return undefined;
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

function toRequestStatus(value: unknown): OnboardingRequest["status"] {
  if (value === "approved" || value === "rejected" || value === "cancelled") return value;
  return "pending";
}

function toReviewScope(value: unknown): OnboardingRequest["review_scope"] {
  return value === "store" ? "store" : "platform";
}
