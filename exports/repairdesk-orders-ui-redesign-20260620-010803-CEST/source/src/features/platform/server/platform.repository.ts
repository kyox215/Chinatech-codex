import type {
  AuditActor,
  OnboardingDecisionInput,
  OnboardingRequest,
  OnboardingRequestInput,
  OnboardingStatus,
  StoreRole,
} from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { type DbRecord, fail, maybeString, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

export async function getOnboardingStatus(actor: AuditActor): Promise<OnboardingStatus> {
  assertLoggedIn(actor);
  const supabase = getSupabaseAdmin();

  const [requestsResult, storesResult] = await Promise.all([
    supabase
      .from("onboarding_requests")
      .select("*")
      .eq("requester_user_id", actor.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("stores")
      .select("id, name, slug")
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);
  fail(requestsResult.error, "读取注册申请失败");
  fail(storesResult.error, "读取店铺列表失败");

  return {
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
    requests: ((requestsResult.data ?? []) as DbRecord[]).map(onboardingRequestFromRow),
    availableStores: ((storesResult.data ?? []) as DbRecord[]).map((row) => ({
      id: requiredString(row.id),
      name: requiredString(row.name),
      slug: requiredString(row.slug),
    })),
  };
}

export async function submitOnboardingRequest(
  input: OnboardingRequestInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertLoggedIn(actor);
  const supabase = getSupabaseAdmin();
  const existing = await getLatestOpenRequest(supabase, requiredString(actor.id));
  if (existing) throw new Error("你已经有一个待审核申请，请等待平台管理员处理");

  const now = new Date().toISOString();
  const requestType = input.request_type;
  const payload: Record<string, unknown> = {
    requester_user_id: actor.id,
    email: sanitizeEmail(actor.email || ""),
    display_name: actor.displayName,
    request_type: requestType,
    requested_role:
      requestType === "create_store" ? "owner" : sanitizeJoinRole(input.requested_role),
    status: "pending",
    created_at: now,
    updated_at: now,
  };

  if (requestType === "create_store") {
    payload.desired_store_name = sanitizeStoreName(input.desired_store_name || "");
  } else {
    const store = await getActiveStore(supabase, input.target_store_id || "");
    payload.target_store_id = store.id;
    payload.target_store_name = store.name;
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
    after: data as Record<string, unknown>,
  });

  return onboardingRequestFromRow(data as DbRecord);
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
  const now = new Date().toISOString();
  const resultingStoreId =
    request.request_type === "create_store"
      ? await approveStoreCreation(supabase, request, now)
      : await approveStoreJoin(supabase, request, now);

  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "approved",
      reviewed_by: actor.id,
      reviewed_at: now,
      decision_note: input.note?.trim() || null,
      resulting_store_id: resultingStoreId,
      updated_at: now,
    })
    .eq("id", request.id)
    .select("*")
    .single();
  fail(error, "批准注册申请失败");

  await writePlatformAuditLog({
    actor,
    action: "approve_onboarding_request",
    entityType: "onboarding_request",
    entityId: request.id,
    before: request as unknown as Record<string, unknown>,
    after: data as Record<string, unknown>,
  });

  return onboardingRequestFromRow(data as DbRecord);
}

export async function rejectOnboardingRequest(
  input: OnboardingDecisionInput,
  actor: AuditActor,
): Promise<OnboardingRequest> {
  assertPlatformAdmin(actor);
  const supabase = getSupabaseAdmin();
  const request = await getPendingRequest(supabase, input.id);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("onboarding_requests")
    .update({
      status: "rejected",
      reviewed_by: actor.id,
      reviewed_at: now,
      decision_note: input.note?.trim() || null,
      updated_at: now,
    })
    .eq("id", request.id)
    .select("*")
    .single();
  fail(error, "拒绝注册申请失败");

  await writePlatformAuditLog({
    actor,
    action: "reject_onboarding_request",
    entityType: "onboarding_request",
    entityId: request.id,
    before: request as unknown as Record<string, unknown>,
    after: data as Record<string, unknown>,
  });

  return onboardingRequestFromRow(data as DbRecord);
}

async function approveStoreCreation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: OnboardingRequest,
  now: string,
) {
  const name = sanitizeStoreName(request.desired_store_name || "");
  const slug = await uniqueStoreSlug(supabase, name);
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .insert({
      name,
      slug,
      owner_user_id: request.requester_user_id,
      status: "active",
      plan: "starter",
      timezone: "Europe/Rome",
      currency_code: "EUR",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  fail(storeError, "创建申请店铺失败");
  const storeId = requiredString((store as DbRecord).id);

  await upsertStaffProfile(supabase, request, "owner", now);
  await upsertStoreMembership(supabase, request, storeId, "owner", now);
  return storeId;
}

async function approveStoreJoin(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: OnboardingRequest,
  now: string,
) {
  const storeId = requiredString(request.target_store_id);
  if (!storeId) throw new Error("申请缺少目标店铺");
  const role = sanitizeJoinRole(request.requested_role);
  await upsertStaffProfile(supabase, request, role, now);
  await upsertStoreMembership(supabase, request, storeId, role, now);
  return storeId;
}

async function upsertStaffProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: OnboardingRequest,
  role: StoreRole,
  now: string,
) {
  const { error } = await supabase.from("staff_profiles").upsert(
    {
      id: request.requester_user_id,
      email: request.email,
      display_name: request.display_name || displayNameFromEmail(request.email),
      role,
      status: "active",
      updated_at: now,
    },
    { onConflict: "id" },
  );
  fail(error, "同步员工档案失败");
}

async function upsertStoreMembership(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: OnboardingRequest,
  storeId: string,
  role: StoreRole,
  now: string,
) {
  const { error } = await supabase.from("store_memberships").upsert(
    {
      store_id: storeId,
      user_id: request.requester_user_id,
      email: request.email,
      display_name: request.display_name || displayNameFromEmail(request.email),
      role,
      status: "active",
      updated_at: now,
    },
    { onConflict: "store_id,user_id" },
  );
  fail(error, "同步店铺成员关系失败");
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

async function getActiveStore(supabase: ReturnType<typeof getSupabaseAdmin>, storeId: string) {
  if (!storeId) throw new Error("请选择要加入的店铺");
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .eq("id", storeId)
    .eq("status", "active")
    .maybeSingle();
  fail(error, "读取目标店铺失败");
  if (!data) throw new Error("目标店铺不存在或不可加入");
  const row = data as DbRecord;
  return {
    id: requiredString(row.id),
    name: requiredString(row.name),
  };
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
      before_data: before ?? null,
      after_data: after ?? null,
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
    requested_role: toStoreRole(row.requested_role),
    status: toRequestStatus(row.status),
    reviewed_by: maybeString(row.reviewed_by),
    reviewed_at: maybeString(row.reviewed_at),
    decision_note: maybeString(row.decision_note),
    resulting_store_id: maybeString(row.resulting_store_id),
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

function sanitizeJoinRole(value?: StoreRole): Exclude<StoreRole, "owner"> {
  if (value === "manager" || value === "technician" || value === "sales" || value === "viewer") {
    return value;
  }
  return "viewer";
}

function displayNameFromEmail(email?: string) {
  return (
    email
      ?.split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "员工"
  );
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

function toRequestStatus(value: unknown): OnboardingRequest["status"] {
  if (value === "approved" || value === "rejected" || value === "cancelled") return value;
  return "pending";
}
