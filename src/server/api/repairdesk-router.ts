import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { statusGroups } from "@/lib/mock/enums";
import {
  batchTransition,
  createOrderWorkflowStatus,
  createOrder,
  decideOrderApproval,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  listOrderWorkflow,
  listOrders,
  listOrdersPage,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  reorderOrderWorkflowStatuses,
  sendApprovalRequest,
  sendNotification,
  sendWhatsappNotification,
  setOrderWorkflowStatusEnabled,
  transitionOrder,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateOrder,
  uploadOrderAttachment,
} from "@/features/orders/server/order.service";
import {
  completeCustomerFollowup,
  createCustomer,
  createCustomerFollowup,
  deleteCustomerDevice,
  getCustomerDevices,
  getCustomerDetail,
  listCustomers,
  listCustomersPage,
  searchCustomerIntakeCandidates,
  searchCustomers,
  sendCustomerMessage,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
} from "@/features/customers/server/customer.service";
import {
  applyElectronicsCsvImport,
  createInventoryIntake,
  getInventoryItem,
  getInventoryStats,
  getInventorySummary,
  importElectronicsCsvPreview,
  listInventoryItems,
  listInventoryItemsPage,
  recordInventoryCheck,
  recordInventoryTransaction,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
  uploadInventoryAttachment,
} from "@/features/inventory/server/inventory.service";
import {
  getStoreSettings,
  listMessageTemplates,
  renderMessageTemplatePreview,
  resetMessageTemplate,
  updateMessageTemplate,
  updateStoreSettings,
} from "@/features/messages/server/message-settings.service";
import {
  archiveSupplier,
  createSupplier,
  listSuppliers,
  updateSupplier,
} from "@/features/suppliers/server/supplier.service";
import {
  archiveMockSupplier,
  createMockSupplier,
  listMockSuppliers,
  updateMockSupplier,
} from "@/features/suppliers/testing/mock-api";
import {
  acceptKioskSession,
  createKioskDevicePairing,
  createKioskSession,
  listKioskDevices,
  listKioskSessions,
  returnKioskSession,
  revokeKioskDevice,
} from "@/features/kiosk/server/kiosk.service";
import {
  acceptStoreInvitation,
  approveStoreAccessRequest,
  createStoreInviteLink,
  createStore,
  getStoreContext,
  disableStoreMember,
  inviteStoreMember,
  listStoreAccessRequests,
  listStoreMembers,
  redeemStoreInviteLink,
  rejectStoreAccessRequest,
  restoreStoreMember,
  revokeStoreInviteLink,
  revokeStoreInvitation,
  switchActiveStore,
  updateStoreMemberPermissions,
  updateStoreMemberRole,
} from "@/features/stores/server/store.service";
import {
  approveOnboardingRequest,
  cancelOnboardingRequest,
  getOnboardingStatus,
  listPlatformOnboardingRequests,
  rejectOnboardingRequest,
  submitOnboardingRequest,
  updateAccountProfile,
} from "@/features/platform/server/platform.service";
import { getRequestActor, UnauthorizedError, ForbiddenError } from "@/server/auth-context";
import { assertPermission, type PermissionAction } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { resolveRepairDeskSourceMode } from "@/server/repairdesk-source-mode";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import {
  queueRepairDeskRealtimeBroadcast,
  type RepairDeskRealtimeMutationBroadcast,
} from "@/features/realtime/server/realtime-broadcast";
import type {
  AuditActor,
  InventoryTransactionInput,
  OrderListItem,
  OrderListResult,
  OrderStats,
  PatchOrderFinanceInput,
  PatchOrderInput,
  RepairDeskOptions,
  SupplierInput,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";
import {
  accountProfileUpdateBodySchema,
  approvalDecisionBodySchema,
  approvalRequestBodySchema,
  batchTransitionBodySchema,
  createOrderSchema,
  customerCreateBodySchema,
  customerDeviceDeleteBodySchema,
  customerDeviceUpsertBodySchema,
  customerFollowupCompleteBodySchema,
  customerFollowupCreateBodySchema,
  customerIdBodySchema,
  customerIntakeSearchBodySchema,
  customerListFiltersSchema,
  customerListPageInputSchema,
  customerMessageBodySchema,
  customerSearchBodySchema,
  customerTagsUpdateBodySchema,
  customerUpdateBodySchema,
  dashboardSummaryInputSchema,
  electronicsCsvImportBodySchema,
  idBodySchema,
  inventoryAttachmentUploadBodySchema,
  inventoryIntakeCreateBodySchema,
  inventoryListFiltersSchema,
  inventoryQualityCheckBodySchema,
  inventorySellBodySchema,
  inventoryTransactionBodySchema,
  inventoryTransitionBodySchema,
  inventoryUpdateBodySchema,
  messageTemplatePreviewBodySchema,
  messageTemplateResetBodySchema,
  messageTemplateUpdateBodySchema,
  kioskDevicePairingBodySchema,
  kioskSessionCreateBodySchema,
  kioskSessionReturnBodySchema,
  notificationBodySchema,
  onboardingDecisionBodySchema,
  onboardingRequestBodySchema,
  orderAttachmentUploadBodySchema,
  orderListFiltersSchema,
  orderListPageInputSchema,
  orderWorkflowStatusCreateBodySchema,
  orderWorkflowStatusEnabledBodySchema,
  orderWorkflowStatusReorderBodySchema,
  orderWorkflowStatusUpdateBodySchema,
  orderWorkflowTransitionsUpdateBodySchema,
  patchOrderBodySchema,
  patchOrderFinanceBodySchema,
  paymentBodySchema,
  storeCreateBodySchema,
  storeInviteBodySchema,
  storeInviteLinkCreateBodySchema,
  storeInviteLinkDecisionBodySchema,
  storeInviteLinkRedeemBodySchema,
  storeInvitationDecisionBodySchema,
  storeMemberDecisionBodySchema,
  storeMemberPermissionUpdateBodySchema,
  storeMemberRoleUpdateBodySchema,
  storeSettingsUpdateBodySchema,
  supplierArchiveBodySchema,
  supplierCreateBodySchema,
  supplierUpdateBodySchema,
  storeSwitchBodySchema,
  transitionOrderBodySchema,
  updateOrderBodySchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

const supabaseSource = {
  acceptKioskSession,
  batchTransition,
  completeCustomerFollowup,
  acceptStoreInvitation,
  approveOnboardingRequest,
  approveStoreAccessRequest,
  applyElectronicsCsvImport,
  archiveSupplier,
  cancelOnboardingRequest,
  createCustomer,
  createCustomerFollowup,
  createInventoryIntake,
  createKioskDevicePairing,
  createKioskSession,
  createOrder,
  createOrderWorkflowStatus,
  createSupplier,
  createStore,
  createStoreInviteLink,
  decideOrderApproval,
  deleteCustomerDevice,
  getCustomerDevices,
  getCustomerDetail,
  getInventoryItem,
  getInventoryStats,
  getInventorySummary,
  getOnboardingStatus,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  getStoreContext,
  getStoreSettings,
  listSuppliers,
  importElectronicsCsvPreview,
  inviteStoreMember,
  disableStoreMember,
  listCustomers,
  listCustomersPage,
  listInventoryItems,
  listInventoryItemsPage,
  listKioskDevices,
  listKioskSessions,
  listMessageTemplates,
  listOrderWorkflow,
  listOrders,
  listOrdersPage,
  listPlatformOnboardingRequests,
  listStoreAccessRequests,
  listStoreMembers,
  patchOrder,
  patchOrderFinance,
  recordInventoryCheck,
  recordInventoryTransaction,
  recordPayment,
  reorderOrderWorkflowStatuses,
  renderMessageTemplatePreview,
  resetMessageTemplate,
  rejectOnboardingRequest,
  rejectStoreAccessRequest,
  redeemStoreInviteLink,
  returnKioskSession,
  revokeStoreInviteLink,
  revokeStoreInvitation,
  revokeKioskDevice,
  searchCustomers,
  searchCustomerIntakeCandidates,
  sendApprovalRequest,
  sendCustomerMessage,
  sendNotification,
  sendWhatsappNotification,
  sellInventoryItem,
  setOrderWorkflowStatusEnabled,
  setCustomerTags,
  submitOnboardingRequest,
  switchActiveStore,
  transitionInventoryItem,
  transitionOrder,
  updateStoreMemberPermissions,
  updateStoreMemberRole,
  updateCustomer,
  updateInventoryItem,
  updateMessageTemplate,
  updateOrder,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateSupplier,
  updateStoreSettings,
  restoreStoreMember,
  updateAccountProfile,
  uploadInventoryAttachment,
  uploadOrderAttachment,
  upsertCustomerDevice,
};

const realtimeBroadcasts = {
  kioskSessionReviewed: {
    domain: "settings",
    mutation: "updated",
    queryGroups: ["orders.all", "customers.all", "settings.store"],
  },
  orderCreated: {
    domain: "orders",
    mutation: "created",
    queryGroups: ["orders.all", "customers.all"],
  },
  orderUpdated: {
    domain: "orders",
    mutation: "updated",
    queryGroups: ["orders.all", "customers.all"],
  },
  orderTransitioned: {
    domain: "orders",
    mutation: "transitioned",
    queryGroups: ["orders.all", "customers.all"],
  },
  orderWorkflowChanged: {
    domain: "settings",
    mutation: "workflow_changed",
    queryGroups: ["orders.workflow", "orders.options", "orders.all", "settings.store"],
  },
  customerCreated: {
    domain: "customers",
    mutation: "created",
    queryGroups: ["customers.all"],
  },
  customerUpdated: {
    domain: "customers",
    mutation: "updated",
    queryGroups: ["customers.all"],
  },
  inventoryCreated: {
    domain: "inventory",
    mutation: "created",
    queryGroups: ["inventory.all", "customers.all"],
  },
  inventoryUpdated: {
    domain: "inventory",
    mutation: "updated",
    queryGroups: ["inventory.all", "customers.all"],
  },
  inventoryTransitioned: {
    domain: "inventory",
    mutation: "transitioned",
    queryGroups: ["inventory.all", "customers.all"],
  },
  settingsUpdated: {
    domain: "settings",
    mutation: "settings_updated",
    queryGroups: ["settings.store", "orders.options"],
  },
  suppliersChanged: {
    domain: "settings",
    mutation: "settings_updated",
    queryGroups: ["settings.store", "orders.options", "orders.all"],
  },
  messageTemplateUpdated: {
    domain: "settings",
    mutation: "settings_updated",
    queryGroups: ["settings.templates"],
  },
  storeMembershipChanged: {
    domain: "settings",
    mutation: "membership_changed",
    queryGroups: [
      "stores.context",
      "stores.members",
      "stores.access_requests",
      "orders.options",
      "orders.all",
    ],
  },
} as const satisfies Record<string, RepairDeskRealtimeMutationBroadcast>;

async function source() {
  const { isRepairDeskE2eAuthBypassEnabled } = await import("@/shared/lib/e2e-auth-bypass");
  const { hasSupabaseConfig } = await import("@/server/supabase");
  const mode = resolveRepairDeskSourceMode({
    hasSupabaseConfig: hasSupabaseConfig(),
    e2eAuthBypass: isRepairDeskE2eAuthBypassEnabled(),
  });
  if (mode === "supabase") return supabaseSource;

  const mock = await import("@/lib/mock/api");
  const getMockStoreMembers = async (actor: Awaited<ReturnType<typeof getRequestActor>>) => {
    const now = new Date().toISOString();
    return {
      members: [
        {
          id: "mock_membership_owner",
          user_id: actor.id ?? "mock_user",
          email: actor.email ?? "owner@example.com",
          display_name: actor.displayName,
          role: actor.storeRole ?? actor.role ?? "owner",
          status: "active" as const,
          permission_grants: [],
          created_at: now,
          updated_at: now,
        },
      ],
      invitations: [],
      invite_links: [],
    };
  };
  return {
    ...mock,
    archiveSupplier: async (id: string, actor: AuditActor) => archiveMockSupplier(id, actor),
    createSupplier: async (input: SupplierInput, actor: AuditActor) =>
      createMockSupplier(input, actor),
    getRepairDeskOptions: async () => ({
      suppliers: listMockSuppliers().filter((supplier) => !supplier.archived_at),
      technicians: mock.allTechnicians,
      permissions: {
        canReadSuppliers: true,
        canAssignSuppliers: true,
        canManageSuppliers: true,
      },
    }),
    listSuppliers: async () => listMockSuppliers(),
    updateStoreMemberPermissions: async (_input: unknown, actor: AuditActor) =>
      getMockStoreMembers(actor),
    updateSupplier: async (id: string, input: SupplierInput, actor: AuditActor) =>
      updateMockSupplier(id, input, actor),
    getOnboardingStatus: async (actor: Awaited<ReturnType<typeof getRequestActor>>) => {
      const context = await mock.getStoreContext(actor);
      const activeStore = actor.storeId
        ? {
            id: actor.storeId,
            name: actor.storeName || "Mock Store",
            slug: "mock-store",
            role: actor.storeRole ?? actor.role ?? "owner",
            status: "active" as const,
          }
        : context.activeStore;
      return {
        userId: actor.id,
        email: actor.email,
        emailVerified: actor.emailVerified === true,
        displayName: actor.displayName,
        isPlatformAdmin: Boolean(actor.isPlatformAdmin),
        activeStore,
        stores: activeStore ? context.stores : (actor.stores ?? []),
        requests: [],
        availableStores: [],
      };
    },
    submitOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持注册申请");
    },
    cancelOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持取消申请");
    },
    listStoreMembers: getMockStoreMembers,
    updateStoreMemberRole: async (
      _input: unknown,
      actor: Awaited<ReturnType<typeof getRequestActor>>,
    ) => getMockStoreMembers(actor),
    disableStoreMember: async (
      _input: unknown,
      actor: Awaited<ReturnType<typeof getRequestActor>>,
    ) => getMockStoreMembers(actor),
    restoreStoreMember: async (
      _input: unknown,
      actor: Awaited<ReturnType<typeof getRequestActor>>,
    ) => getMockStoreMembers(actor),
    listPlatformOnboardingRequests: async () => [],
    listStoreAccessRequests: async () => [],
    updateAccountProfile: async (
      input: { display_name: string },
      actor: Awaited<ReturnType<typeof getRequestActor>>,
    ) => {
      const context = await mock.getStoreContext(actor);
      const activeStore = actor.storeId
        ? {
            id: actor.storeId,
            name: actor.storeName || "Mock Store",
            slug: "mock-store",
            role: actor.storeRole ?? actor.role ?? "owner",
            status: "active" as const,
          }
        : context.activeStore;
      return {
        userId: actor.id,
        email: actor.email,
        emailVerified: actor.emailVerified === true,
        displayName: input.display_name.trim() || actor.displayName,
        isPlatformAdmin: Boolean(actor.isPlatformAdmin),
        activeStore,
        stores: activeStore ? context.stores : (actor.stores ?? []),
        requests: [],
        availableStores: [],
      };
    },
    approveOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持平台审批");
    },
    rejectOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持平台审批");
    },
    approveStoreAccessRequest: async () => {
      throw new Error("Mock 模式暂不支持加入申请审批");
    },
    rejectStoreAccessRequest: async () => {
      throw new Error("Mock 模式暂不支持加入申请审批");
    },
  };
}

function ok(data: unknown) {
  return NextResponse.json({ data });
}

function emptyOrderListResult(pageSize: number): OrderListResult {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    pageCount: 1,
    workflowCounts: { all: 0 } as OrderListResult["workflowCounts"],
  };
}

function deriveDashboardStatsFromRecentOrders(items: OrderListItem[], total: number): OrderStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return {
    total,
    today: items.filter((order) => new Date(order.created_at).getTime() >= todayMs).length,
    inProgress: items.filter((order) =>
      order.workflow_status
        ? order.workflow_status !== "closed"
        : statusGroups.in_progress.includes(order.status),
    ).length,
    unpaid: items.filter((order) => !order.is_paid).length,
    approvalOverdue: items.filter((order) => order.approval_overdue).length,
    pickupOverdue: items.filter((order) => order.pickup_overdue).length,
  };
}

function fail(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const message =
    error instanceof z.ZodError
      ? `请求参数错误：${error.issues.map((issue) => issue.message).join("，")}`
      : error instanceof Error
        ? error.message
        : "请求处理失败";

  return NextResponse.json({ error: message }, { status: 400 });
}

export async function handleRepairDeskGet(path: string) {
  try {
    const actor = await getRequestActor(true, {
      allowPendingStore: allowsPendingStore(path, "GET"),
    });
    const api = await source();
    switch (path) {
      case "onboarding/status":
        return ok(await api.getOnboardingStatus(actor));
      case "platform/onboarding/requests":
        return ok(await api.listPlatformOnboardingRequests(actor));
      case "order-stats":
        assertOrderListPermission(actor);
        return ok(await api.getOrderStats(actor));
      case "order-workflow":
        return ok(await api.listOrderWorkflow(actor));
      case "options":
        return ok(await api.getRepairDeskOptions(actor));
      case "inventory/stats":
        return ok(await api.getInventoryStats(actor));
      case "settings/store":
        return ok(await api.getStoreSettings(actor));
      case "settings/suppliers":
        assertRepairDeskPermission(actor, "supplier:read");
        return ok(await api.listSuppliers(actor));
      case "message-templates":
        return ok(await api.listMessageTemplates(actor));
      case "stores/context":
        return ok(await api.getStoreContext(actor));
      case "stores/members":
        return ok(await api.listStoreMembers(actor));
      case "stores/access-requests":
        return ok(await api.listStoreAccessRequests(actor));
      case "kiosk/devices":
        assertRepairDeskPermission(actor, "settings:update_store");
        return ok(await api.listKioskDevices(actor));
      case "kiosk/sessions":
        assertOrderDetailReadPermission(actor);
        return ok(await api.listKioskSessions(actor));
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}

export async function handleRepairDeskPost(path: string, body: unknown) {
  try {
    const actor = await getRequestActor(true, {
      allowPendingStore: allowsPendingStore(path, "POST"),
    });
    const api = await source();
    switch (path) {
      case "onboarding/request": {
        const { input } = onboardingRequestBodySchema.parse(body);
        return ok(await api.submitOnboardingRequest(input, actor));
      }
      case "onboarding/request/cancel":
        return ok(
          await api.cancelOnboardingRequest(onboardingDecisionBodySchema.parse(body), actor),
        );
      case "onboarding/invitations/accept":
        return ok(
          await api.acceptStoreInvitation(storeInvitationDecisionBodySchema.parse(body), actor),
        );
      case "onboarding/invite-links/redeem":
        return ok(
          await api.redeemStoreInviteLink(storeInviteLinkRedeemBodySchema.parse(body), actor),
        );
      case "platform/onboarding/approve":
        return ok(
          await api.approveOnboardingRequest(onboardingDecisionBodySchema.parse(body), actor),
        );
      case "platform/onboarding/reject":
        return ok(
          await api.rejectOnboardingRequest(onboardingDecisionBodySchema.parse(body), actor),
        );
      case "account/profile/update": {
        const { input } = accountProfileUpdateBodySchema.parse(body);
        return ok(await api.updateAccountProfile(input, actor));
      }
      case "kiosk/devices/pairing": {
        assertRepairDeskPermission(actor, "settings:update_store");
        const { input } = kioskDevicePairingBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createKioskDevicePairing(input, actor),
            realtimeBroadcasts.settingsUpdated,
          ),
        );
      }
      case "kiosk/devices/revoke": {
        assertRepairDeskPermission(actor, "settings:update_store");
        const { id } = idBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.revokeKioskDevice(id, actor),
            realtimeBroadcasts.settingsUpdated,
          ),
        );
      }
      case "kiosk/sessions/create": {
        assertRepairDeskPermission(actor, "order:update_intake");
        const { input } = kioskSessionCreateBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createKioskSession(input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "kiosk/sessions/accept": {
        assertRepairDeskPermission(actor, "order:update_intake");
        const { id } = idBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.acceptKioskSession(id, actor),
            realtimeBroadcasts.kioskSessionReviewed,
          ),
        );
      }
      case "kiosk/sessions/return": {
        assertRepairDeskPermission(actor, "order:update_intake");
        const input = kioskSessionReturnBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.returnKioskSession(input, actor),
            realtimeBroadcasts.kioskSessionReviewed,
          ),
        );
      }
      case "orders/list":
        assertOrderListPermission(actor);
        return ok(await api.listOrders(orderListFiltersSchema.parse(body), actor));
      case "orders/list-page":
        assertOrderListPermission(actor);
        return ok(await api.listOrdersPage(orderListPageInputSchema.parse(body), actor));
      case "orders/queue-summary": {
        assertOrderListPermission(actor);
        const input = orderListPageInputSchema.parse(body);
        const [listResult, workflowResult, optionsResult] = await Promise.allSettled([
          api.listOrdersPage(input, actor),
          api.listOrderWorkflow(actor),
          api.getRepairDeskOptions(actor),
        ]);
        if (listResult.status === "rejected") throw listResult.reason;

        const workflow =
          workflowResult.status === "fulfilled"
            ? workflowResult.value
            : { statuses: [], transitions: [] };
        const options: RepairDeskOptions =
          optionsResult.status === "fulfilled"
            ? optionsResult.value
            : {
                suppliers: [],
                technicians: [],
                permissions: {
                  canReadSuppliers: false,
                  canAssignSuppliers: false,
                  canManageSuppliers: false,
                },
              };
        const partialErrors =
          workflowResult.status === "rejected" || optionsResult.status === "rejected"
            ? {
                ...(workflowResult.status === "rejected"
                  ? { workflow: "状态流配置暂时不可用" }
                  : {}),
                ...(optionsResult.status === "rejected" ? { options: "筛选选项暂时不可用" } : {}),
              }
            : undefined;

        return ok({ list: listResult.value, workflow, options, partialErrors });
      }
      case "dashboard/summary": {
        assertOrderListPermission(actor);
        const { pageSize = 6 } = dashboardSummaryInputSchema.parse(body);
        const [recentOrdersResult, statsResult] = await Promise.allSettled([
          api.listOrdersPage({ page: 1, pageSize }, actor),
          api.getOrderStats(actor),
        ]);
        if (recentOrdersResult.status === "rejected" && statsResult.status === "rejected") {
          throw new Error("仪表盘数据暂时不可用");
        }

        const recentOrders =
          recentOrdersResult.status === "fulfilled"
            ? recentOrdersResult.value
            : emptyOrderListResult(pageSize);
        const stats =
          statsResult.status === "fulfilled"
            ? statsResult.value
            : deriveDashboardStatsFromRecentOrders(recentOrders.items, recentOrders.total);
        const partialErrors =
          recentOrdersResult.status === "rejected" || statsResult.status === "rejected"
            ? {
                ...(recentOrdersResult.status === "rejected"
                  ? { recentOrders: "最新工单暂时不可用" }
                  : {}),
                ...(statsResult.status === "rejected" ? { stats: "工单统计暂时不可用" } : {}),
              }
            : undefined;

        return ok({ recentOrders, stats, partialErrors });
      }
      case "customers/list":
        assertCustomerListPermission(actor);
        return ok(await api.listCustomers(customerListFiltersSchema.parse(body), actor));
      case "customers/list-page":
        assertCustomerListPermission(actor);
        return ok(await api.listCustomersPage(customerListPageInputSchema.parse(body), actor));
      case "inventory/list":
        return ok(await api.listInventoryItems(inventoryListFiltersSchema.parse(body), actor));
      case "inventory/list-page":
        return ok(await api.listInventoryItemsPage(inventoryListFiltersSchema.parse(body), actor));
      case "inventory/summary":
        return ok(await api.getInventorySummary(inventoryListFiltersSchema.parse(body), actor));
      case "orders/create":
        assertOrderCreatePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "create",
            "repair_order",
            "new",
            body,
            () => api.createOrder(createOrderSchema.parse(body), actor),
            realtimeBroadcasts.orderCreated,
          ),
        );
      case "order/get": {
        const { id } = idBodySchema.parse(body);
        assertOrderDetailReadPermission(actor);
        return ok(await api.getOrder(id, actor));
      }
      case "inventory/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await api.getInventoryItem(id, actor));
      }
      case "customer/get": {
        const { id } = idBodySchema.parse(body);
        assertCustomerDetailReadPermission(actor);
        return ok(await api.getCustomerDetail(id, actor));
      }
      case "customer/create": {
        const { input } = customerCreateBodySchema.parse(body);
        assertCustomerCreatePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "create",
            "customer",
            "new",
            input,
            () => api.createCustomer(input, actor),
            realtimeBroadcasts.customerCreated,
          ),
        );
      }
      case "customer/update": {
        const { id, input } = customerUpdateBodySchema.parse(body);
        assertCustomerUpdatePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "customer",
            id,
            input,
            () => api.updateCustomer(id, input, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "customer/device/upsert": {
        const { customerId, input } = customerDeviceUpsertBodySchema.parse(body);
        assertCustomerUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.upsertCustomerDevice(customerId, input, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "customer/device/delete": {
        const { customerId, deviceId } = customerDeviceDeleteBodySchema.parse(body);
        assertCustomerUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.deleteCustomerDevice(customerId, deviceId, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "customer/tags/update": {
        const { customerId, tagIds } = customerTagsUpdateBodySchema.parse(body);
        assertCustomerTagPermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.setCustomerTags(customerId, tagIds, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "customer/followup/create": {
        const { customerId, input } = customerFollowupCreateBodySchema.parse(body);
        assertCustomerUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createCustomerFollowup(customerId, input, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "customer/followup/complete": {
        const { customerId, followupId } = customerFollowupCompleteBodySchema.parse(body);
        assertCustomerUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.completeCustomerFollowup(customerId, followupId, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "customer/message": {
        const { customerId, input } = customerMessageBodySchema.parse(body);
        assertCustomerMessagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.sendCustomerMessage(customerId, input, actor),
            realtimeBroadcasts.customerUpdated,
          ),
        );
      }
      case "order/update": {
        const { id, input } = updateOrderBodySchema.parse(body);
        assertOrderUpdatePermission(actor, input);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "repair_order",
            id,
            input,
            () => api.updateOrder(id, input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/patch": {
        const { id, input } = patchOrderBodySchema.parse(body);
        assertOrderPatchPermission(actor, input);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "repair_order",
            id,
            input,
            () => api.patchOrder(id, input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/finance": {
        const { id, input } = patchOrderFinanceBodySchema.parse(body);
        assertOrderFinancePermission(actor, input);
        return ok(
          await auditGeneric(
            actor,
            "payment",
            "repair_order",
            id,
            input,
            () => api.patchOrderFinance(id, input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/attachment/upload": {
        const { id, input } = orderAttachmentUploadBodySchema.parse(body);
        assertOrderAttachmentUploadPermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "upload",
            "order_attachment",
            id,
            input,
            () => api.uploadOrderAttachment(id, input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/transition": {
        const { id, to, reason } = transitionOrderBodySchema.parse(body);
        assertOrderTransitionPermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "transition",
            "repair_order",
            id,
            { to, reason },
            () => api.transitionOrder(id, to, { reason, operator: actor }),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order/batch-transition": {
        const { ids, to } = batchTransitionBodySchema.parse(body);
        assertOrderBatchTransitionPermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "transition",
            "repair_order",
            "batch",
            { ids, to },
            () => api.batchTransition(ids, to, actor),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order-workflow/status/create": {
        const { input } = orderWorkflowStatusCreateBodySchema.parse(body);
        assertWorkflowConfigurePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "create",
            "order_workflow_status",
            "new",
            input,
            () => api.createOrderWorkflowStatus(input, actor),
            realtimeBroadcasts.orderWorkflowChanged,
          ),
        );
      }
      case "order-workflow/status/update": {
        const { id, input } = orderWorkflowStatusUpdateBodySchema.parse(body);
        assertWorkflowConfigurePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "order_workflow_status",
            id,
            input,
            () => api.updateOrderWorkflowStatus(id, input, actor),
            realtimeBroadcasts.orderWorkflowChanged,
          ),
        );
      }
      case "order-workflow/status/reorder": {
        const input = orderWorkflowStatusReorderBodySchema.parse(body);
        assertWorkflowConfigurePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "reorder",
            "order_workflow_status",
            "batch",
            input,
            () => api.reorderOrderWorkflowStatuses(input, actor),
            realtimeBroadcasts.orderWorkflowChanged,
          ),
        );
      }
      case "order-workflow/status/enabled": {
        const input = orderWorkflowStatusEnabledBodySchema.parse(body);
        assertWorkflowConfigurePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "order_workflow_status",
            input.id,
            input,
            () => api.setOrderWorkflowStatusEnabled(input, actor),
            realtimeBroadcasts.orderWorkflowChanged,
          ),
        );
      }
      case "order-workflow/transitions/update": {
        const input = orderWorkflowTransitionsUpdateBodySchema.parse(body);
        assertWorkflowConfigurePermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "order_workflow_transition",
            input.from_status_code,
            input,
            () => api.updateOrderWorkflowTransitions(input, actor),
            realtimeBroadcasts.orderWorkflowChanged,
          ),
        );
      }
      case "order/payment": {
        const { id, amount, method, expected_updated_at, idempotency_key } =
          paymentBodySchema.parse(body);
        assertOrderPaymentPermission(actor);
        const paymentIdempotencyKey = idempotency_key ?? randomUUID();
        return ok(
          await runWithRealtime(
            actor,
            () =>
              api.recordPayment(
                id,
                amount,
                method,
                actor,
                expected_updated_at,
                paymentIdempotencyKey,
              ),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/notification": {
        const { id, body: messageBody, channel } = notificationBodySchema.parse(body);
        assertOrderCustomerMessagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.sendNotification(id, messageBody, channel, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/whatsapp-notification": {
        const {
          id,
          body: messageBody,
          template_kind,
          transition_to,
          recipient_phone,
        } = whatsappNotificationBodySchema.parse(body);
        assertOrderCustomerMessagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () =>
              api.sendWhatsappNotification(
                id,
                messageBody,
                template_kind,
                transition_to,
                actor,
                recipient_phone,
              ),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/approval-request": {
        const { id, body: messageBody, recipient_phone } = approvalRequestBodySchema.parse(body);
        assertOrderCustomerMessagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.sendApprovalRequest(id, messageBody, actor, recipient_phone),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/approval-decision": {
        const { id, input } = approvalDecisionBodySchema.parse(body);
        assertOrderTransitionPermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "repair_order_approval",
            id,
            input,
            () => api.decideOrderApproval(id, input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "customers/search": {
        const { q, limit } = customerSearchBodySchema.parse(body);
        assertCustomerListPermission(actor);
        return ok(await api.searchCustomers(q, limit, actor));
      }
      case "customers/intake-search": {
        const { q, limit, deviceLimit } = customerIntakeSearchBodySchema.parse(body);
        assertCustomerDetailReadPermission(actor);
        return ok(await api.searchCustomerIntakeCandidates(q, limit, deviceLimit, actor));
      }
      case "customers/devices": {
        const { customerId } = customerIdBodySchema.parse(body);
        assertCustomerDetailReadPermission(actor);
        return ok(await api.getCustomerDevices(customerId, actor));
      }
      case "inventory/intake/create": {
        const { input } = inventoryIntakeCreateBodySchema.parse(body);
        assertInventoryCreatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createInventoryIntake(input, actor),
            realtimeBroadcasts.inventoryCreated,
          ),
        );
      }
      case "inventory/update": {
        const { id, input } = inventoryUpdateBodySchema.parse(body);
        assertInventoryUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.updateInventoryItem(id, input, actor),
            realtimeBroadcasts.inventoryUpdated,
          ),
        );
      }
      case "inventory/transition": {
        const { id, to, reason } = inventoryTransitionBodySchema.parse(body);
        assertInventoryUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.transitionInventoryItem(id, to, { reason }, actor),
            realtimeBroadcasts.inventoryTransitioned,
          ),
        );
      }
      case "inventory/check": {
        const { id, input } = inventoryQualityCheckBodySchema.parse(body);
        assertInventoryQualityCheckPermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.recordInventoryCheck(id, input, actor),
            realtimeBroadcasts.inventoryUpdated,
          ),
        );
      }
      case "inventory/attachment/upload": {
        const { id, input } = inventoryAttachmentUploadBodySchema.parse(body);
        assertInventoryUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.uploadInventoryAttachment(id, input, actor),
            realtimeBroadcasts.inventoryUpdated,
          ),
        );
      }
      case "inventory/transaction": {
        const { id, input } = inventoryTransactionBodySchema.parse(body);
        assertInventoryTransactionPermission(actor, input);
        return ok(
          await runWithRealtime(
            actor,
            () => api.recordInventoryTransaction(id, input, actor),
            realtimeBroadcasts.inventoryUpdated,
          ),
        );
      }
      case "inventory/sell": {
        const { id, input } = inventorySellBodySchema.parse(body);
        assertInventorySalePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.sellInventoryItem(id, input, actor),
            realtimeBroadcasts.inventoryTransitioned,
          ),
        );
      }
      case "inventory/import/electronics/preview": {
        const { csvContent } = electronicsCsvImportBodySchema.parse(body);
        return ok(await api.importElectronicsCsvPreview(csvContent));
      }
      case "inventory/import/electronics/apply": {
        const { csvContent } = electronicsCsvImportBodySchema.parse(body);
        assertInventoryCreatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.applyElectronicsCsvImport(csvContent, actor),
            realtimeBroadcasts.inventoryCreated,
          ),
        );
      }
      case "settings/store/update": {
        const { input } = storeSettingsUpdateBodySchema.parse(body);
        assertStoreSettingsUpdatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.updateStoreSettings(input, actor),
            realtimeBroadcasts.settingsUpdated,
          ),
        );
      }
      case "settings/suppliers/create": {
        assertRepairDeskPermission(actor, "supplier:manage");
        const { input } = supplierCreateBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createSupplier(input, actor),
            realtimeBroadcasts.suppliersChanged,
          ),
        );
      }
      case "settings/suppliers/update": {
        assertRepairDeskPermission(actor, "supplier:manage");
        const { id, input } = supplierUpdateBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.updateSupplier(id, input, actor),
            realtimeBroadcasts.suppliersChanged,
          ),
        );
      }
      case "settings/suppliers/archive": {
        assertRepairDeskPermission(actor, "supplier:manage");
        const { id } = supplierArchiveBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.archiveSupplier(id, actor),
            realtimeBroadcasts.suppliersChanged,
          ),
        );
      }
      case "stores/create": {
        const { input } = storeCreateBodySchema.parse(body);
        return ok(await api.createStore(input, actor));
      }
      case "stores/switch": {
        const { storeId } = storeSwitchBodySchema.parse(body);
        return ok(await api.switchActiveStore(storeId, actor));
      }
      case "stores/invite-member": {
        const { input } = storeInviteBodySchema.parse(body);
        assertMemberInvitePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.inviteStoreMember(input, actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      }
      case "stores/members/update-role":
        assertMemberManagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.updateStoreMemberRole(storeMemberRoleUpdateBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/members/update-permissions":
        assertMemberPermissionGrantPermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () =>
              api.updateStoreMemberPermissions(
                storeMemberPermissionUpdateBodySchema.parse(body),
                actor,
              ),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/members/disable":
        assertMemberManagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.disableStoreMember(storeMemberDecisionBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/members/restore":
        assertMemberManagePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.restoreStoreMember(storeMemberDecisionBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/invite-links/create": {
        const { input } = storeInviteLinkCreateBodySchema.parse(body);
        assertMemberInvitePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createStoreInviteLink(input, actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      }
      case "stores/invite-links/revoke":
        assertMemberRevokePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.revokeStoreInviteLink(storeInviteLinkDecisionBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/invitations/revoke":
        assertMemberRevokePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.revokeStoreInvitation(storeInvitationDecisionBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/access-requests/approve":
        return ok(
          await runWithRealtime(
            actor,
            () => api.approveStoreAccessRequest(onboardingDecisionBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "stores/access-requests/reject":
        return ok(
          await runWithRealtime(
            actor,
            () => api.rejectStoreAccessRequest(onboardingDecisionBodySchema.parse(body), actor),
            realtimeBroadcasts.storeMembershipChanged,
          ),
        );
      case "message-template/update": {
        const { id, input } = messageTemplateUpdateBodySchema.parse(body);
        assertMessageTemplatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.updateMessageTemplate(id, input, actor),
            realtimeBroadcasts.messageTemplateUpdated,
          ),
        );
      }
      case "message-template/reset": {
        const { id } = messageTemplateResetBodySchema.parse(body);
        assertMessageTemplatePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.resetMessageTemplate(id, actor),
            realtimeBroadcasts.messageTemplateUpdated,
          ),
        );
      }
      case "message-template/preview":
        return ok(
          await api.renderMessageTemplatePreview(
            messageTemplatePreviewBodySchema.parse(body),
            actor,
          ),
        );
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}

export function allowsPendingStore(path: string, method: "GET" | "POST") {
  if (method === "GET") {
    return path === "onboarding/status" || path === "platform/onboarding/requests";
  }
  return (
    path === "stores/create" ||
    path === "onboarding/request" ||
    path === "onboarding/request/cancel" ||
    path === "onboarding/invitations/accept" ||
    path === "onboarding/invite-links/redeem" ||
    path === "account/profile/update" ||
    path === "platform/onboarding/approve" ||
    path === "platform/onboarding/reject"
  );
}

export function assertOrderListPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:list");
}

export function assertOrderDetailReadPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:detail");
}

export function assertOrderCreatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:create");
}

export function assertOrderUpdatePermission(actor: AuditActor, _input: UpdateOrderInput) {
  for (const action of resolveOrderUpdatePermissionActions(_input)) {
    assertRepairDeskPermission(actor, action);
  }
}

export function assertOrderPatchPermission(actor: AuditActor, input: PatchOrderInput) {
  for (const action of resolveOrderPatchPermissionActions(input)) {
    assertRepairDeskPermission(actor, action);
  }
}

export function assertOrderFinancePermission(actor: AuditActor, _input: PatchOrderFinanceInput) {
  assertRepairDeskPermission(actor, "payment:adjust");
}

export function assertOrderPaymentPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "payment:collect");
}

export function assertOrderTransitionPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:transition");
}

export function assertOrderBatchTransitionPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:batch_transition");
}

export function assertOrderAttachmentUploadPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:photo_upload");
}

export function assertOrderCustomerMessagePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:message");
}

export function assertCustomerListPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:list");
}

export function assertCustomerDetailReadPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:detail");
}

export function assertCustomerCreatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:create");
}

export function assertCustomerUpdatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:update");
}

export function assertCustomerTagPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:tag");
}

export function assertCustomerMessagePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:message");
}

export function assertInventoryCreatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:create");
}

export function assertInventoryUpdatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:update");
}

export function assertInventoryQualityCheckPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:quality_check");
}

export function assertInventorySalePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:sale");
}

export function assertInventoryTransactionPermission(
  actor: AuditActor,
  input: InventoryTransactionInput,
) {
  if (input.transaction_type === "sale_payment") {
    assertInventorySalePermission(actor);
    return;
  }

  assertInventoryUpdatePermission(actor);
}

export function assertStoreSettingsUpdatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "settings:update_store");
}

export function assertWorkflowConfigurePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "settings:update_workflow");
}

export function assertMessageTemplatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "settings:update_message_template");
}

export function assertMemberInvitePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "member:invite");
}

export function assertMemberManagePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "member:manage_basic");
}

export function assertMemberRevokePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "member:revoke");
}

export function assertMemberPermissionGrantPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "member:grant_manager");
}

export function resolveOrderUpdatePermissionActions(input: UpdateOrderInput): PermissionAction[] {
  const actions = new Set<PermissionAction>(["order:update_intake"]);

  if (hasFullOrderRepairFields(input)) {
    actions.add("order:update_repair");
  }

  if (hasFullOrderFinanceFields(input)) {
    actions.add("payment:adjust");
  }

  return [...actions];
}

export function resolveOrderPatchPermissionActions(input: PatchOrderInput): PermissionAction[] {
  const actions = new Set<PermissionAction>();
  const repairFields = new Set([
    "diagnosis_result",
    "device_notes",
    "device_unlock",
    "warranty_text",
  ]);

  for (const key of Object.keys(input.changes)) {
    if (key === "parts_supplier_id") {
      actions.add("supplier:assign");
    } else {
      actions.add(repairFields.has(key) ? "order:update_repair" : "order:update_intake");
    }
  }

  return [...actions];
}

function hasFullOrderRepairFields(input: UpdateOrderInput) {
  return [
    "device_notes",
    "diagnosis_result",
    "device_unlock",
    "warranty_text",
    "warranty_months",
    "warranty_change_reason",
  ].some((field) => hasOwnField(input, field));
}

function hasFullOrderFinanceFields(input: UpdateOrderInput) {
  return hasOwnField(input, "fault_prices") || hasOwnField(input, "deposit_amount");
}

function hasOwnField(input: object, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function assertRepairDeskPermission(actor: AuditActor, action: PermissionAction) {
  if (actor.isSystem && isRepairDeskE2eAuthBypassEnabled()) return;
  assertPermission(actor, action);
}

async function auditGeneric<T>(
  actor: Awaited<ReturnType<typeof getRequestActor>>,
  action: string,
  entityType: string,
  entityId: string,
  input: unknown,
  run: () => Promise<T>,
  realtime?: RepairDeskRealtimeMutationBroadcast,
) {
  const result = await run();
  await writeAuditLog({
    actor,
    action,
    entityType,
    entityId: resolveEntityId(entityId, result),
    after: asRecord(result),
    metadata: { input: asRecord(input) },
  });
  queueRealtimeBroadcast(actor, realtime);
  return result;
}

async function runWithRealtime<T>(
  actor: Awaited<ReturnType<typeof getRequestActor>>,
  run: () => Promise<T>,
  realtime?: RepairDeskRealtimeMutationBroadcast,
) {
  const result = await run();
  queueRealtimeBroadcast(actor, realtime);
  return result;
}

function queueRealtimeBroadcast(
  actor: Awaited<ReturnType<typeof getRequestActor>>,
  realtime?: RepairDeskRealtimeMutationBroadcast,
) {
  if (!realtime || !actor.storeId) return;
  queueRepairDeskRealtimeBroadcast({ storeId: actor.storeId, ...realtime });
}

function resolveEntityId(entityId: string, result: unknown) {
  if (entityId !== "new") return entityId;
  if (result && typeof result === "object" && "id" in result && typeof result.id === "string") {
    return result.id;
  }
  return entityId;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}
