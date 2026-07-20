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
import {
  deleteProvisionedStoreDefaults,
  provisionStoreDefaults,
} from "@/features/stores/server/store-provisioning";
import { sanitizeAuditRecord } from "@/server/audit";
import { assertVerifiedEmail, ForbiddenError } from "@/server/auth-context";
import { type DbRecord, fail, maybeString, requiredString } from "@/server/repairdesk-shared";
import { resolveStaffDisplayName } from "@/server/staff-display-name";
import { getSupabaseAdmin } from "@/server/supabase";
import { normalizeOptionalE164Phone } from "@/shared/lib/phone";
import { isPlatformOwnerEmail } from "@/shared/config/platform-authority";

const JOIN_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const JOIN_REQUEST_LIMIT = 5;
const LEGACY_CREATE_STORE_DECISION_NOTE = "系统自动开通店铺，无需平台审批";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export async function getOnboardingStatus(actor: AuditActor): Promise<OnboardingStatus> {
  assertLoggedIn(actor);
  const supabase = getSupabaseAdmin();

  const requestsResult = await supabase
    .from("onboarding_requests")
    .select("*")
    .eq("requester_user_id", actor.id)
    .order("created_at", { ascending: false });
  fail(requestsResult.error, "读取注册申请失败");
  const invitationsResult =
    actor.email && actor.emailVerified
      ? await supabase
          .from("store_invitations")
          .select(
            "id, email, role, status, email_delivery_status, last_email_delivery_attempt_at, last_email_delivered_at, expires_at, created_at, updated_at, store:stores(name)",
          )
          .eq("email", sanitizeEmail(actor.email))
          .eq("status", "invited")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : { data: [], error: null };
  fail(invitationsResult.error, "读取店铺邀请失败");

  return {
    userId: actor.id,
    email: actor.email,
    emailVerified: actor.emailVerified === true,
    displayName: actor.displayName,
    phoneE164: actor.phoneE164 ?? null,
    phoneVerifiedAt: actor.phoneVerifiedAt ?? null,
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
  const shouldUpdatePhone = "phone_e164" in input;
  const phoneE164 = shouldUpdatePhone ? normalizeOptionalE164Phone(input.phone_e164) : undefined;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    display_name: displayName,
    updated_at: now,
  };
  if (shouldUpdatePhone) updatePayload.phone_e164 = phoneE164;

  const { data, error } = await supabase
    .from("staff_profiles")
    .update(updatePayload)
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
  const publicDisplayName = resolveStaffDisplayName({
    email: actor.email,
    displayName,
    role: actor.storeRole ?? actor.role,
  });

  await writePlatformAuditLog({
    actor: { ...actor, displayName: publicDisplayName },
    action: "update_account_profile",
    entityType: "staff_profile",
    entityId: userId,
    before: shouldUpdatePhone
      ? { display_name: actor.displayName, phone_e164: actor.phoneE164 ?? null }
      : { display_name: actor.displayName },
    after: shouldUpdatePhone
      ? { display_name: displayName, phone_e164: phoneE164, email: (data as DbRecord).email }
      : { display_name: displayName, email: (data as DbRecord).email },
  });

  return getOnboardingStatus({
    ...actor,
    displayName: publicDisplayName,
    phoneE164: shouldUpdatePhone ? phoneE164 : actor.phoneE164,
  });
}

export async function submitOnboardingRequest(
  input: OnboardingRequestInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertLoggedIn(actor);
  assertVerifiedEmail(actor);
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
  await enforceJoinRequestRateLimit(supabase, actor);
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
  failOnboardingRequestWrite(error, "提交注册申请失败");

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
  const scopedResult = await queryPlatformOnboardingRequests(supabase, true);
  const result = isMissingOnboardingColumnError(scopedResult.error, "review_scope")
    ? await queryPlatformOnboardingRequests(supabase, false)
    : scopedResult;
  fail(result.error, "读取平台审批列表失败");

  const requests = ((result.data ?? []) as DbRecord[])
    .map(onboardingRequestFromRow)
    .filter((request) => request.status === "pending" && request.review_scope === "platform");
  const queue: OnboardingRequest[] = [];
  for (const request of requests) {
    if (request.request_type === "create_store") {
      await autoApproveLegacyCreateStoreRequest(supabase, request, actor);
      continue;
    }
    queue.push(request);
  }
  return queue;
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

async function queryPlatformOnboardingRequests(supabase: SupabaseAdmin, withReviewScope: boolean) {
  const query = supabase.from("onboarding_requests").select("*").eq("status", "pending");
  if (withReviewScope) query.eq("review_scope", "platform");
  return query.order("created_at", { ascending: true });
}

async function autoApproveLegacyCreateStoreRequest(
  supabase: SupabaseAdmin,
  request: OnboardingRequest,
  actor: AuditActor,
) {
  const now = new Date().toISOString();
  const storeName = sanitizeStoreName(
    request.desired_store_name || `${displayNameFromEmail(request.email)} RepairDesk`,
  );
  const slug = await uniqueStoreSlug(supabase, storeName);
  const storeCode = generateStoreCode(storeName);
  const { data: storeRow, error: storeError } = await supabase
    .from("stores")
    .insert({
      store_code: storeCode,
      name: storeName,
      slug,
      owner_user_id: request.requester_user_id,
      status: "suspended",
      plan: "starter",
      timezone: "Europe/Rome",
      currency_code: "EUR",
      created_at: now,
      updated_at: now,
    })
    .select("id, name, slug, status")
    .single();
  fail(storeError, "自动创建店铺失败");

  const store = storeRow as DbRecord;
  const storeId = requiredString(store.id);
  try {
    await provisionStoreDefaults(supabase, {
      storeId,
      storeName,
      actorId: request.requester_user_id,
      now,
    });
    const { error: membershipError } = await supabase.from("store_memberships").insert({
      store_id: storeId,
      user_id: request.requester_user_id,
      email: sanitizeEmail(request.email),
      display_name: request.display_name || displayNameFromEmail(request.email),
      role: "owner",
      status: "active",
      created_at: now,
      updated_at: now,
    });
    fail(membershipError, "自动创建店铺成员关系失败");

    const { error: activationError } = await supabase
      .from("stores")
      .update({ status: "active", updated_at: now })
      .eq("id", storeId);
    fail(activationError, "自动激活店铺失败");

    const approved = await markLegacyCreateStoreRequestApproved(
      supabase,
      request,
      storeId,
      actor,
      now,
    );
    await writePlatformAuditLog({
      actor,
      action: "auto_approve_create_store_request",
      entityType: "onboarding_request",
      entityId: request.id,
      before: createOnboardingAuditSnapshot(request),
      after: createOnboardingAuditSnapshot(approved),
    });
  } catch (error) {
    await rollbackLegacyCreatedStore(supabase, storeId);
    throw error;
  }
}

async function markLegacyCreateStoreRequestApproved(
  supabase: SupabaseAdmin,
  request: OnboardingRequest,
  storeId: string,
  actor: AuditActor,
  now: string,
) {
  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "approved",
      reviewed_by: actor.id,
      reviewed_at: now,
      decision_note: LEGACY_CREATE_STORE_DECISION_NOTE,
      resulting_store_id: storeId,
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("request_type", "create_store")
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  fail(error, "自动通过创建店铺申请失败");
  if (!data) throw new Error("创建店铺申请已处理，请刷新后再试");
  return onboardingRequestFromRow(data as DbRecord);
}

async function rollbackLegacyCreatedStore(supabase: SupabaseAdmin, storeId: string) {
  await deleteProvisionedStoreDefaults(supabase, storeId);
  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) {
    throw new Error("自动创建店铺失败，回滚未完成店铺失败，请联系管理员处理");
  }
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
    .in("role", ["owner"]);
  if (error) throw new Error("提交注册申请失败，请稍后重试");

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

async function enforceJoinRequestRateLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  actor: AuditActor,
) {
  const userId = requiredString(actor.id);
  const windowStart = new Date(Date.now() - JOIN_REQUEST_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("onboarding_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_user_id", userId)
    .eq("request_type", "join_store")
    .gte("created_at", windowStart);
  fail(error, "检查加入申请频率失败");
  if ((count ?? 0) >= JOIN_REQUEST_LIMIT) {
    throw new Error("提交申请过于频繁，请稍后再试");
  }
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
    email_delivery_status: toInvitationEmailDeliveryStatus(row.email_delivery_status),
    last_email_delivery_attempt_at: requiredString(row.last_email_delivery_attempt_at) || undefined,
    last_email_delivered_at: requiredString(row.last_email_delivered_at) || undefined,
    expires_at: requiredString(row.expires_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function toInvitationEmailDeliveryStatus(value: unknown) {
  if (value === "pending" || value === "sent" || value === "failed") return value;
  return "not_requested" as const;
}

function assertLoggedIn(actor: AuditActor) {
  if (!actor.id || actor.isSystem) throw new ForbiddenError("需要登录后继续");
}

function assertPlatformAdmin(actor: AuditActor) {
  assertLoggedIn(actor);
  if (
    !actor.isPlatformAdmin ||
    actor.emailVerified !== true ||
    !isPlatformOwnerEmail(actor.email)
  ) {
    throw new ForbiddenError("只有项目负责人可以处理平台审批");
  }
}

function sanitizeDisplayName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1) throw new Error("账号名称不能为空");
  if (name.length > 60) throw new Error("账号名称不能超过 60 个字符");
  return name;
}

function sanitizeStoreName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("店铺名称至少需要 2 个字符");
  if (name.length > 80) throw new Error("店铺名称不能超过 80 个字符");
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

async function uniqueStoreSlug(supabase: SupabaseAdmin, name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64).replace(/-+$/g, "");
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

function generateStoreCode(name: string) {
  const base = slugify(name).replace(/-/g, "").slice(0, 6).toUpperCase();
  const prefix = base.length >= 3 ? base : "STORE";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`.slice(0, 32);
}

function displayNameFromEmail(email?: string) {
  return (
    email
      ?.split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "员工"
  );
}

function isMissingOnboardingColumnError(
  error: { message?: string } | null | undefined,
  column: string,
) {
  const message = error?.message;
  if (!message) return false;
  return (
    new RegExp(`column onboarding_requests\\.${column} does not exist`, "i").test(message) ||
    new RegExp(`Could not find the '${column}' column of 'onboarding_requests'`, "i").test(message)
  );
}

function failOnboardingRequestWrite(
  error: { message?: string } | null | undefined,
  context: string,
) {
  if (!error) return;
  if (isMissingAnyOnboardingColumnError(error)) {
    throw new Error(`${context}: 注册申请数据结构尚未同步，请联系管理员同步数据库后重试`);
  }
  throw new Error(`${context}: ${error.message ?? "未知错误"}`);
}

function isMissingAnyOnboardingColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message;
  return Boolean(
    message &&
    (/column onboarding_requests\.[a-z_]+ does not exist/i.test(message) ||
      /Could not find the '[a-z_]+' column of 'onboarding_requests'/i.test(message)),
  );
}
