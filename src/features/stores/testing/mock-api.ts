import type {
  AuditActor,
  OnboardingDecisionInput,
  OnboardingRequest,
  StoreContext,
  StoreCreateInput,
  StoreInvitationDecisionInput,
  StoreInviteLinkCreateInput,
  StoreInviteLinkCreateResult,
  StoreInviteLinkDecisionInput,
  StoreInviteLinkRedeemInput,
  StoreInvitation,
  StoreInviteInput,
  StoreMember,
  StoreMemberDecisionInput,
  StoreMemberPermissionUpdateInput,
  StoreMemberRoleUpdateInput,
  StoreMembersResult,
} from "@/lib/repairdesk/types";
import { normalizeStorePermissionGrants } from "@/entities/staff/model/store-permission-policy";
import {
  isOrderDataApplyEnabled,
  isOrderDataExportEnabled,
} from "@/features/orders/server/order-data-feature-flags";
import { isCostMultiCurrencyEnabled } from "@/features/orders/server/order-cost-feature";
import { can } from "@/server/permissions";
import {
  canUseInventoryProductQuickCreate,
  canUseInventoryProductsUi,
  canUseInventoryV2Commands,
  canUseInventoryV2Ui,
} from "@/features/inventory/server/inventory-v2-access";
import { isInventoryProductDeviceDataV2Enabled } from "@/features/inventory/server/inventory-v2-feature-flags";

const mockStores = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Demo Repair Store",
    slug: "demo-repair-store",
    role: "owner",
    status: "active",
    membershipId: "10000000-0000-4000-8000-000000000001",
  },
] satisfies StoreContext["stores"];

let activeStoreId = mockStores[0].id;
const createdStoreProfiles = new Map<string, { name: string; address: string }>();
const mockMembersByStore = new Map<string, StoreMember[]>([
  [
    activeStoreId,
    [
      {
        id: "10000000-0000-4000-8000-000000000001",
        user_id: "mock_user_owner",
        email: "owner@repairdesk.local",
        display_name: "店铺管理员",
        role: "owner",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        user_id: "mock_user_manager",
        email: "manager@repairdesk.local",
        display_name: "演示店长",
        role: "manager",
        status: "active",
        permission_grants: [
          "order:archive_browse",
          "finance:aggregate_read",
          "finance:profit_read",
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "10000000-0000-4000-8000-000000000003",
        user_id: "mock_user_technician",
        email: "technician@repairdesk.local",
        display_name: "演示技术员",
        role: "technician",
        status: "active",
        permission_grants: ["supplier:read"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  ],
]);
const mockInvitations: StoreMembersResult["invitations"] = [];
const mockInviteLinks: NonNullable<StoreMembersResult["invite_links"]> = [];
const mockInviteLinkHashes = new Map<string, string>();
const mockAccessRequestsByStore = new Map<string, OnboardingRequest[]>([
  [
    activeStoreId,
    [
      {
        id: "20000000-0000-4000-8000-000000000001",
        requester_user_id: "mock_user_applicant",
        email: "applicant@repairdesk.local",
        display_name: "演示申请人",
        request_type: "join_store",
        target_store_id: activeStoreId,
        target_store_name: "Demo Repair Store",
        request_note: "希望加入当前门店协助前台接待。",
        review_scope: "store",
        requested_role: "sales",
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  ],
]);

export async function getStoreContext(actor?: AuditActor): Promise<StoreContext> {
  return context(actor);
}

export async function switchActiveStore(
  storeId: string,
  _actor?: AuditActor,
): Promise<StoreContext> {
  if (!mockStores.some((store) => store.id === storeId)) throw new Error("店铺不存在");
  activeStoreId = storeId;
  return context(_actor);
}

export async function createStore(
  input: StoreCreateInput,
  actor?: AuditActor,
): Promise<StoreContext> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("店铺名称至少需要 2 个字符");
  const id = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  mockStores.unshift({
    id,
    name,
    slug: mockStoreSlug(name),
    role: "owner",
    status: "active",
    membershipId,
  });
  createdStoreProfiles.set(id, {
    name,
    address: input.address?.trim() ?? "",
  });
  storeMembers(id).unshift({
    id: membershipId,
    user_id: actor?.id ?? "mock_user_owner",
    email: actor?.email ?? "owner@repairdesk.local",
    display_name: actor?.displayName ?? "店铺管理员",
    role: "owner",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  activeStoreId = id;
  return context(actor);
}

export function getCreatedMockStoreProfile(storeId: string) {
  const profile = createdStoreProfiles.get(storeId);
  return profile ? { ...profile } : undefined;
}

export function getActiveMockStoreId() {
  return activeStoreId;
}

export async function listStoreMembers(actor?: AuditActor): Promise<StoreMembersResult> {
  assertMockPermission(actor, "member:manage_basic");
  return members(actor);
}

export async function updateStoreMemberRole(input: StoreMemberRoleUpdateInput, actor?: AuditActor) {
  assertMockPermission(actor, "member:manage_basic");
  const member = requireMockManageableMember(input.id, actor);
  const management = mockMemberManagement(member, actor);
  if (!management.allowed_roles.includes(input.role)) throw new Error("不能修改该成员角色");
  member.role = input.role;
  member.permission_grants = [];
  member.updated_at = new Date().toISOString();
  return members(actor);
}

export async function updateStoreMemberPermissions(
  input: StoreMemberPermissionUpdateInput,
  actor?: AuditActor,
) {
  assertMockPermission(actor, "member:grant_manager");
  const member = requireMockManageableMember(input.id, actor);
  if (!mockMemberManagement(member, actor).can_update_permissions) {
    throw new Error("只有店主可以分配员工权限");
  }
  member.permission_grants = normalizeStorePermissionGrants(input.permissions, member.role);
  member.updated_at = new Date().toISOString();
  return members(actor);
}

export async function disableStoreMember(input: StoreMemberDecisionInput, actor?: AuditActor) {
  assertMockPermission(actor, "member:manage_basic");
  const member = requireMockManageableMember(input.id, actor);
  if (!mockMemberManagement(member, actor).can_disable) throw new Error("不能停用该成员");
  member.status = "inactive";
  member.permission_grants = [];
  member.updated_at = new Date().toISOString();
  return members(actor);
}

export async function restoreStoreMember(input: StoreMemberDecisionInput, actor?: AuditActor) {
  assertMockPermission(actor, "member:manage_basic");
  const member = requireMockManageableMember(input.id, actor);
  if (!mockMemberManagement(member, actor).can_restore) throw new Error("不能恢复该成员");
  member.status = "active";
  member.updated_at = new Date().toISOString();
  return members(actor);
}

export async function listStoreAccessRequests(actor?: AuditActor): Promise<OnboardingRequest[]> {
  assertMockAccessRequestReview(actor);
  return storeAccessRequests().filter((request) => request.status === "pending");
}

export async function approveStoreAccessRequest(
  input: OnboardingDecisionInput,
  actor?: AuditActor,
): Promise<OnboardingRequest> {
  assertMockAccessRequestReview(actor);
  const request = requirePendingMockAccessRequest(input.id);
  const requestedRole = request.requested_role === "owner" ? "viewer" : request.requested_role;
  const role = sanitizeInviteRole(input.approved_role ?? requestedRole);
  const now = new Date().toISOString();
  request.status = "approved";
  request.approved_role = role;
  request.reviewed_by = actor?.id;
  request.reviewed_by_membership_id = actor?.activeMembershipId;
  request.reviewed_at = now;
  request.decision_note = input.note?.trim() || undefined;
  request.resulting_store_id = activeStoreId;
  request.updated_at = now;
  if (!storeMembers().some((member) => member.user_id === request.requester_user_id)) {
    storeMembers().push({
      id: crypto.randomUUID(),
      user_id: request.requester_user_id,
      email: request.email,
      display_name: request.display_name,
      role,
      status: "active",
      created_at: now,
      updated_at: now,
    });
  }
  return { ...request };
}

export async function rejectStoreAccessRequest(
  input: OnboardingDecisionInput,
  actor?: AuditActor,
): Promise<OnboardingRequest> {
  assertMockAccessRequestReview(actor);
  const request = requirePendingMockAccessRequest(input.id);
  const now = new Date().toISOString();
  request.status = "rejected";
  request.reviewed_by = actor?.id;
  request.reviewed_by_membership_id = actor?.activeMembershipId;
  request.reviewed_at = now;
  request.decision_note = input.note?.trim() || undefined;
  request.updated_at = now;
  return { ...request };
}

export async function inviteStoreMember(
  input: StoreInviteInput,
  actor?: AuditActor,
): Promise<StoreMembersResult> {
  assertMockPermission(actor, "member:invite");
  const email = input.email.trim().toLowerCase();
  const role = sanitizeInviteRole(input.role);
  assertMockInviteRole(actor, role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  if (storeMembers().some((member) => member.email.toLowerCase() === email)) {
    throw new Error("该邮箱已经是当前店铺成员");
  }
  const now = new Date().toISOString();
  const existingInvite = mockInvitations.find(
    (item) =>
      item.store_id === activeStoreId &&
      item.email.toLowerCase() === email &&
      item.status === "invited",
  );
  const nextInvite = {
    ...(existingInvite ?? {
      id: crypto.randomUUID(),
      store_id: activeStoreId,
      store_name: mockStores.find((store) => store.id === activeStoreId)?.name,
      email,
      created_at: now,
    }),
    role,
    status: "invited" as const,
    email_delivery_status: "sent" as const,
    email_delivery_method: "supabase_invite" as const,
    last_email_delivery_attempt_at: now,
    last_email_delivered_at: now,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: now,
  };
  if (existingInvite) {
    Object.assign(existingInvite, nextInvite);
  } else {
    mockInvitations.unshift(nextInvite);
  }
  return members(actor);
}

export async function acceptStoreInvitation(
  input: StoreInvitationDecisionInput,
  actor?: AuditActor,
): Promise<StoreContext> {
  const email = actor?.email?.trim().toLowerCase();
  const invitation = mockInvitations.find(
    (item) =>
      item.id === input.id && item.email.toLowerCase() === email && item.status === "invited",
  );
  if (!invitation) throw new Error("邀请不存在或已失效");
  if (new Date(invitation.expires_at).getTime() <= Date.now()) throw new Error("邀请已过期");
  const storeId = invitation.store_id ?? activeStoreId;
  const store = mockStores.find((item) => item.id === storeId) ?? mockStores[0];
  invitation.status = "active";
  invitation.accepted_at = new Date().toISOString();
  invitation.updated_at = invitation.accepted_at;
  storeMembers(storeId).unshift({
    id: crypto.randomUUID(),
    user_id: actor?.id ?? "mock_user_invited",
    email: invitation.email,
    display_name: actor?.displayName ?? invitation.email,
    role: invitation.role,
    status: "active",
    created_at: invitation.accepted_at,
    updated_at: invitation.accepted_at,
  });
  activeStoreId = store.id;
  return context(actor);
}

export async function createStoreInviteLink(
  input: StoreInviteLinkCreateInput,
  _actor?: AuditActor,
): Promise<StoreInviteLinkCreateResult> {
  assertMockPermission(_actor, "member:invite");
  const now = new Date().toISOString();
  const role = sanitizeInviteRole(input.role);
  assertMockInviteRole(_actor, role);
  const code = `rd_${crypto.randomUUID().replace(/-/g, "")}`;
  const link = {
    id: crypto.randomUUID(),
    store_id: activeStoreId,
    store_name: mockStores.find((store) => store.id === activeStoreId)?.name,
    label: input.label?.trim() || undefined,
    role,
    status: "active" as const,
    expires_at: new Date(
      Date.now() + (input.expires_in_days ?? 7) * 24 * 60 * 60 * 1000,
    ).toISOString(),
    max_uses: input.max_uses,
    used_count: 0,
    created_by: _actor?.id,
    created_at: now,
    updated_at: now,
  };
  mockInviteLinks.unshift(link);
  mockInviteLinkHashes.set(link.id, mockHashInviteCode(code));
  return { link, code };
}

export async function revokeStoreInviteLink(
  input: StoreInviteLinkDecisionInput,
  _actor?: AuditActor,
): Promise<StoreMembersResult> {
  assertMockPermission(_actor, "member:revoke");
  const link = mockInviteLinks.find((item) => item.id === input.id && item.status === "active");
  if (link?.store_id !== activeStoreId) throw new Error("邀请码不存在或已处理");
  if (!link) throw new Error("邀请码不存在或已处理");
  link.status = "inactive";
  link.revoked_by = _actor?.id;
  link.revoked_at = new Date().toISOString();
  link.updated_at = link.revoked_at;
  return members(_actor);
}

export async function redeemStoreInviteLink(input: StoreInviteLinkRedeemInput, actor?: AuditActor) {
  const email = actor?.email?.trim().toLowerCase();
  if (!email) throw new Error("需要登录员工账号后才能兑换邀请码");
  const codeHash = mockHashInviteCode(input.code.trim());
  const link = mockInviteLinks.find(
    (item) => mockInviteLinkHashes.get(item.id) === codeHash && item.status === "active",
  );
  if (!link) throw new Error("邀请码不存在或已失效");
  if (new Date(link.expires_at).getTime() <= Date.now()) throw new Error("邀请码不存在或已失效");
  if (link.max_uses !== undefined && link.used_count >= link.max_uses) {
    throw new Error("邀请码不存在或已失效");
  }
  if (storeMembers(link.store_id).some((member) => member.email.toLowerCase() === email)) {
    throw new Error("你已经是该店铺成员");
  }
  const existingInvite = mockInvitations.find(
    (item) => item.store_id === link.store_id && item.email === email && item.status === "invited",
  );
  if (existingInvite) return mockPublicInvitation(existingInvite);

  link.used_count += 1;
  link.updated_at = new Date().toISOString();
  const invitation = {
    id: crypto.randomUUID(),
    store_id: link.store_id,
    store_name: link.store_name,
    email,
    role: link.role,
    status: "invited" as const,
    invited_by: link.created_by,
    accepted_at: undefined,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: link.updated_at,
    updated_at: link.updated_at,
  };
  mockInvitations.unshift(invitation);
  return mockPublicInvitation(invitation);
}

export async function revokeStoreInvitation(
  input: StoreInvitationDecisionInput,
  _actor?: AuditActor,
): Promise<StoreMembersResult> {
  assertMockPermission(_actor, "member:revoke");
  const invitation = mockInvitations.find(
    (item) => item.id === input.id && item.store_id === activeStoreId && item.status === "invited",
  );
  if (!invitation) throw new Error("邀请不存在或已处理");
  invitation.status = "inactive";
  invitation.updated_at = new Date().toISOString();
  return members(_actor);
}

function context(actor?: AuditActor): StoreContext {
  const scopedActor = mockActor(actor);
  const activeStoreBase = mockStores.find((store) => store.id === activeStoreId) ?? mockStores[0];
  const activeStore = {
    ...activeStoreBase,
    role: scopedActor.storeRole ?? "owner",
    membershipId: actor?.activeMembershipId ?? activeStoreBase.membershipId,
  };
  const canManageMembers = can(scopedActor, "member:manage_basic");
  const canInviteMembers = canManageMembers && can(scopedActor, "member:invite");
  const canUpdateStoreSettings = can(scopedActor, "settings:update_store");
  const primaryOwnerUserId = storeMembers(activeStoreId).find(
    (member) => member.role === "owner" && member.status === "active",
  )?.user_id;
  const isPrimaryOwner = scopedActor.storeRole === "owner" && scopedActor.id === primaryOwnerUserId;
  const lifecycleCheck = isPrimaryOwner
    ? ({ allowed: true, code: "available" } as const)
    : ({ allowed: false, code: "primary_owner_required" } as const);
  const lifecycleMutation =
    isPrimaryOwner &&
    process.env.STORE_LIFECYCLE_ENFORCEMENT_ENABLED === "1" &&
    process.env.STORE_LIFECYCLE_MUTATIONS_ENABLED === "1"
      ? ({ allowed: true, code: "available" } as const)
      : isPrimaryOwner
        ? ({ allowed: false, code: "feature_disabled" } as const)
        : lifecycleCheck;
  const activeStoreWithLifecycle = {
    ...activeStore,
    isPrimaryOwner,
    lifecycle: {
      store_id: activeStore.id,
      phase: "active" as const,
      revision: 1,
    },
  };
  const canManageOrderData =
    isOrderDataExportEnabled() &&
    scopedActor.storeRole === "owner" &&
    scopedActor.id === primaryOwnerUserId;
  const canApplyOrderData = canManageOrderData && isOrderDataApplyEnabled();
  const orderDataAccess: NonNullable<StoreContext["orderDataAccess"]> = !isOrderDataExportEnabled()
    ? { code: "feature_disabled", can_export: false, can_apply: false }
    : scopedActor.storeRole !== "owner"
      ? { code: "owner_role_required", can_export: false, can_apply: false }
      : scopedActor.id !== primaryOwnerUserId
        ? { code: "primary_owner_required", can_export: false, can_apply: false }
        : {
            code: canApplyOrderData ? "available" : "available_export_only",
            can_export: true,
            can_apply: canApplyOrderData,
          };
  return {
    activeStore: activeStoreWithLifecycle,
    stores: mockStores.map((store) =>
      store.id === activeStoreId ? activeStoreWithLifecycle : store,
    ),
    recoveryStores: [],
    activeStoreExplicit: true,
    lifecycleAccess: {
      store_id: activeStore.id,
      check: lifecycleCheck,
      rename: lifecycleMutation,
      close: lifecycleMutation,
      restore: lifecycleMutation,
      purge:
        process.env.STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED === "1"
          ? lifecycleMutation
          : ({ allowed: false, code: "feature_disabled" } as const),
    },
    orderDataAccess,
    permissions: {
      canReadSuppliers: can(scopedActor, "supplier:read"),
      canAssignSuppliers: can(scopedActor, "supplier:assign"),
      canManageSuppliers: can(scopedActor, "supplier:manage"),
      canReadInventory: can(scopedActor, "inventory:read"),
      canCreateInventory: can(scopedActor, "inventory:create"),
      canUpdateInventory:
        can(scopedActor, "inventory:update") && isInventoryProductDeviceDataV2Enabled(),
      canSellInventory: can(scopedActor, "inventory:sale"),
      inventoryV2UiEnabled: canUseInventoryV2Ui(scopedActor),
      inventoryV2CommandsEnabled: canUseInventoryV2Commands(scopedActor),
      inventoryProductsUiEnabled: canUseInventoryProductsUi(scopedActor),
      inventoryProductQuickCreateEnabled: canUseInventoryProductQuickCreate(scopedActor),
      canManageOrderData,
      canApplyOrderData,
      canReadAggregateFinance: can(scopedActor, "finance:aggregate_read"),
      can_manage_order_costs:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        can(scopedActor, "finance:cost_manage"),
      canReadRepairProfitReports:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED === "1" &&
        can(scopedActor, "finance:profit_read"),
      canExportRepairCosts:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        process.env.REPAIRDESK_COST_EXPORT_ENABLED === "1" &&
        can(scopedActor, "finance:cost_export"),
      canPreviewCostBackfill:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        process.env.REPAIRDESK_COST_BACKFILL_ENABLED === "1" &&
        can(scopedActor, "finance:cost_backfill_preview"),
      canApplyCostBackfill:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        process.env.REPAIRDESK_COST_BACKFILL_ENABLED === "1" &&
        can(scopedActor, "finance:cost_backfill_apply"),
      canAllocatePartsCosts:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED === "1" &&
        can(scopedActor, "inventory:cost_allocate"),
      canReadCostCurrencies:
        isCostMultiCurrencyEnabled() &&
        (can(scopedActor, "finance:currency_manage") ||
          can(scopedActor, "finance:cost_manage") ||
          can(scopedActor, "inventory:cost_allocate")),
      canManageCostCurrencies:
        isCostMultiCurrencyEnabled() && can(scopedActor, "finance:currency_manage"),
      canReadStoreSettings: true,
      canUpdateStoreSettings,
      canConfigureWorkflow: can(scopedActor, "settings:update_workflow"),
      canReadMessageTemplates: true,
      canUpdateMessageTemplates: can(scopedActor, "settings:update_message_template"),
      canListMembers: canManageMembers,
      canInviteMembers,
      memberInviteRoles: canInviteMembers
        ? scopedActor.storeRole === "owner"
          ? ["manager", "technician", "sales", "viewer"]
          : ["technician", "sales", "viewer"]
        : [],
      canManageMembers,
      canRevokeMembers: canManageMembers && can(scopedActor, "member:revoke"),
      canGrantManager: can(scopedActor, "member:grant_manager"),
      canReviewAccessRequests:
        scopedActor.storeRole === "owner" && can(scopedActor, "member:grant_manager"),
      canManageKioskDevices: canUpdateStoreSettings,
      canReviewKioskSessions: canUpdateStoreSettings && can(scopedActor, "order:update_intake"),
      canViewAudit: can(scopedActor, "support:view_audit"),
      canReadMemos: true,
      canCreateMemos: scopedActor.storeRole !== "viewer",
      canManageMemos: scopedActor.storeRole === "owner" || scopedActor.storeRole === "manager",
    },
  };
}

function members(actor?: AuditActor): StoreMembersResult {
  return {
    members: storeMembers().map((member) => ({
      ...member,
      management: mockMemberManagement(member, actor),
    })),
    invitations: mockInvitations.filter(
      (invitation) => invitation.store_id === activeStoreId && invitation.status === "invited",
    ),
    invite_links: mockInviteLinks.filter(
      (link) => link.store_id === activeStoreId && link.status === "active",
    ),
  };
}

function storeMembers(storeId = activeStoreId) {
  const existing = mockMembersByStore.get(storeId);
  if (existing) return existing;
  const created: StoreMember[] = [];
  mockMembersByStore.set(storeId, created);
  return created;
}

function storeAccessRequests(storeId = activeStoreId) {
  const existing = mockAccessRequestsByStore.get(storeId);
  if (existing) return existing;
  const created: OnboardingRequest[] = [];
  mockAccessRequestsByStore.set(storeId, created);
  return created;
}

function requireMockManageableMember(id: string, actor?: AuditActor) {
  const member = storeMembers().find((item) => item.id === id);
  if (!member) throw new Error("员工不存在或不属于当前店铺");
  if (member.role === "owner" || member.user_id === actor?.id) {
    throw new Error("不能管理店主或自己的当前店铺权限");
  }
  return member;
}

function mockMemberManagement(member: StoreMember, actor?: AuditActor) {
  const actorRole = actor?.storeRole ?? "owner";
  const isSelf = member.user_id === actor?.id || member.id === actor?.activeMembershipId;
  const targetBlocked = member.role === "owner" || isSelf;
  const canManageTarget =
    !targetBlocked &&
    (actorRole === "owner" || (actorRole === "manager" && member.role !== "manager"));
  const allowedRoles =
    canManageTarget && member.status === "active"
      ? actorRole === "owner"
        ? (["manager", "technician", "sales", "viewer"] as const)
        : (["technician", "sales", "viewer"] as const)
      : [];
  return {
    allowed_roles: [...allowedRoles],
    can_update_role: allowedRoles.length > 0,
    can_update_permissions: actorRole === "owner" && !targetBlocked && member.status === "active",
    can_disable: canManageTarget && member.status === "active",
    can_restore: canManageTarget && member.status === "inactive",
  };
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "store"
  );
}

function mockStoreSlug(value: string) {
  return `${slugify(value)}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 64).replace(/-+$/g, "");
}

function sanitizeInviteRole(role: StoreInviteInput["role"]) {
  if (!["manager", "technician", "sales", "viewer"].includes(role)) {
    throw new Error("不能邀请 owner 角色");
  }
  return role;
}

function mockActor(actor?: AuditActor): AuditActor {
  return {
    id: actor?.id ?? "mock_user_owner",
    email: actor?.email ?? "owner@repairdesk.local",
    displayName: actor?.displayName ?? "店铺管理员",
    role: actor?.role ?? actor?.storeRole ?? "owner",
    storeId: activeStoreId,
    storeName: mockStores.find((store) => store.id === activeStoreId)?.name,
    storeRole: actor?.storeRole ?? actor?.role ?? "owner",
    activeMembershipId: actor?.activeMembershipId,
    permissionGrants: actor?.permissionGrants,
  };
}

function assertMockPermission(actor: AuditActor | undefined, action: Parameters<typeof can>[1]) {
  if (!can(mockActor(actor), action)) throw new Error("当前员工没有权限执行此操作");
}

function assertMockInviteRole(actor: AuditActor | undefined, role: StoreInviteInput["role"]) {
  if (role === "manager" && !can(mockActor(actor), "member:grant_manager")) {
    throw new Error("当前员工没有权限授予店长角色");
  }
}

function assertMockAccessRequestReview(actor?: AuditActor) {
  const scopedActor = mockActor(actor);
  if (scopedActor.storeRole !== "owner" || !can(scopedActor, "member:grant_manager")) {
    throw new Error("只有店主可以处理加入申请");
  }
}

function requirePendingMockAccessRequest(id: string) {
  const request = storeAccessRequests().find(
    (item) => item.id === id && item.target_store_id === activeStoreId && item.status === "pending",
  );
  if (!request) throw new Error("加入申请不存在、已处理或不属于当前店铺");
  return request;
}

function mockHashInviteCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function mockPublicInvitation(invitation: StoreInvitation): StoreInvitation {
  return {
    id: invitation.id,
    store_name: invitation.store_name,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
    updated_at: invitation.updated_at,
  };
}
