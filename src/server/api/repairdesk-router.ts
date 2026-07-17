import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { z } from "zod";

import { getDashboardPrioritySummary } from "@/features/dashboard/server/dashboard-summary.service";
import { syncRepairDeskOfflineOrderCreate } from "@/features/offline/server/offline-order-create-sync";
import { statusGroups } from "@/lib/mock/enums";
import {
  batchTransition,
  confirmCancelledOrderReturn,
  correctTerminalOrder,
  createOrderWorkflowStatus,
  createOrder,
  decideOrderApproval,
  getOrder,
  getOrderCreateOperationStatus,
  getOrderStats,
  getRepairDeskOptions,
  listOrderWorkflow,
  listOrders,
  listOrdersPage,
  patchOrder,
  patchOrderFinance,
  publishOrderQuote,
  confirmOrderQuoteSent,
  recordPayment,
  reopenOrder,
  reorderOrderWorkflowStatuses,
  sendApprovalRequest,
  sendNotification,
  sendWhatsappNotification,
  setOrderWorkflowStatusEnabled,
  transitionOrder,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateOrder,
  voidOrder,
  updateOrderCustody,
  uploadOrderAttachment,
} from "@/features/orders/server/order.service";
import {
  applyOrderDataImport,
  downloadOrderDataTemplate,
  exportCustomerStats,
  exportOrderData,
  listOrderDataBatchHistory,
  previewOrderDataImport,
} from "@/features/orders/server/order-data.service";
import { assertOrderDataAccess } from "@/features/orders/server/order-data-access";
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
  accessInventoryAttachment,
  createInventoryIntake,
  finalizeBuybackPurchase,
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
  BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
  BUYBACK_SENSITIVE_WORKFLOW_ENABLED,
} from "@/features/buyback/model/buyback-evidence-policy";
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
  assertKioskEndToEndEnabled,
  assertKioskReviewWriteEnabled,
} from "@/features/kiosk/server/kiosk-review-gate";
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
import {
  assertPermission,
  type PermissionAction,
  type PermissionContext,
} from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { resolveRepairDeskSourceMode } from "@/server/repairdesk-source-mode";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import {
  queueRepairDeskRealtimeBroadcast,
  type RepairDeskRealtimeMutationBroadcast,
} from "@/features/realtime/server/realtime-broadcast";
import { getStoreSettingsValidationFieldErrors } from "@/features/settings/model/store-settings-update-contract";
import {
  SETTINGS_ERROR_CODES,
  SettingsMutationError,
} from "@/features/settings/model/store-settings-errors";
import type {
  AuditActor,
  CreateInventoryIntakeInput,
  CreateOrderInput,
  InventoryItemStatus,
  InventoryTransactionInput,
  KioskSessionCreateInput,
  OrderListItem,
  OrderListResult,
  OrderStats,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PublishOrderQuoteInput,
  RepairDeskOptions,
  SupplierInput,
  UpdateInventoryItemInput,
  UpdateOrderInput,
  UpdateOrderCustodyInput,
} from "@/lib/repairdesk/types";
import {
  accountProfileUpdateBodySchema,
  approvalDecisionBodySchema,
  approvalRequestBodySchema,
  batchTransitionBodySchema,
  confirmCancelledOrderReturnBodySchema,
  correctTerminalOrderBodySchema,
  orderCreateOperationStatusSchema,
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
  dashboardPrioritySummaryInputSchema,
  electronicsCsvImportBodySchema,
  idBodySchema,
  inventoryAttachmentUploadBodySchema,
  inventoryAttachmentAccessBodySchema,
  buybackFinalizeBodySchema,
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
  kioskSessionReviewBodySchema,
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
  publishOrderQuoteBodySchema,
  confirmOrderQuoteSentBodySchema,
  paymentBodySchema,
  reopenOrderBodySchema,
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
  voidOrderBodySchema,
  updateOrderCustodyBodySchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

const supabaseSource = {
  acceptKioskSession,
  batchTransition,
  confirmCancelledOrderReturn,
  correctTerminalOrder,
  completeCustomerFollowup,
  acceptStoreInvitation,
  approveOnboardingRequest,
  approveStoreAccessRequest,
  applyElectronicsCsvImport,
  accessInventoryAttachment,
  archiveSupplier,
  cancelOnboardingRequest,
  createCustomer,
  createCustomerFollowup,
  createInventoryIntake,
  finalizeBuybackPurchase,
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
  getOrderCreateOperationStatus,
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
  publishOrderQuote,
  confirmOrderQuoteSent,
  recordInventoryCheck,
  recordInventoryTransaction,
  recordPayment,
  reopenOrder,
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
  voidOrder,
  updateOrderCustody,
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

const orderDataStoreBodySchema = z.object({ expectedStoreId: z.string().uuid() }).strict();
const orderDataApplyBodySchema = orderDataStoreBodySchema
  .extend({ batchId: z.string().uuid() })
  .strict();

const realtimeBroadcasts = {
  kioskSessionReviewed: {
    domain: "settings",
    mutation: "updated",
    queryGroups: ["kiosk.sessions", "orders.all", "customers.all"],
  },
  kioskSessionChanged: {
    domain: "settings",
    mutation: "updated",
    queryGroups: ["kiosk.sessions", "orders.all"],
  },
  kioskDeviceChanged: {
    domain: "settings",
    mutation: "updated",
    queryGroups: ["kiosk.devices"],
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
    queryGroups: ["suppliers.all", "orders.options", "orders.all"],
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
    return mock.listStoreMembers(actor);
  };
  return {
    ...mock,
    archiveSupplier: async (id: string, actor: AuditActor) => archiveMockSupplier(id, actor),
    createSupplier: async (input: SupplierInput, actor: AuditActor) =>
      createMockSupplier(input, actor),
    getRepairDeskOptions: async (actor: AuditActor) => ({
      suppliers: listMockSuppliers(actor).filter((supplier) => !supplier.archived_at),
      technicians: mock.allTechnicians,
      assigneeOptions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          display_name: "Hexiang",
          role: "owner" as const,
        },
      ],
      permissions: {
        canReadSuppliers: true,
        canAssignSuppliers: true,
        canManageSuppliers: true,
        canReadInventory: true,
        canSearchOrderArchive: true,
        canBrowseOrderArchive: true,
        canReadOrderFinance: true,
        canReadAggregateFinance: true,
        canReadProfit: true,
        canExportOrders: true,
        canBatchTransitionOrders: true,
        canAssignOrders: true,
      },
    }),
    listSuppliers: async (actor: AuditActor) => listMockSuppliers(actor),
    updateStoreMemberPermissions: mock.updateStoreMemberPermissions,
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
        invitations:
          process.env.REPAIRDESK_E2E_EMPLOYEE_INVITE === "1"
            ? [
                {
                  id: "10000000-0000-4000-8000-000000000001",
                  store_id: activeStore?.id,
                  store_name: activeStore?.name ?? "Demo Repair Store",
                  email: actor.email ?? "invited.staff@repairdesk.local",
                  role: "technician" as const,
                  status: "invited" as const,
                  email_delivery_status: "sent" as const,
                  last_email_delivery_attempt_at: new Date().toISOString(),
                  last_email_delivered_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ]
            : [],
      };
    },
    submitOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持注册申请");
    },
    cancelOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持取消申请");
    },
    listStoreMembers: getMockStoreMembers,
    updateStoreMemberRole: mock.updateStoreMemberRole,
    disableStoreMember: mock.disableStoreMember,
    restoreStoreMember: mock.restoreStoreMember,
    listPlatformOnboardingRequests: async () => [],
    listStoreAccessRequests: mock.listStoreAccessRequests,
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
    approveStoreAccessRequest: mock.approveStoreAccessRequest,
    rejectStoreAccessRequest: mock.rejectStoreAccessRequest,
  };
}

function ok(data: unknown) {
  return privateJson({ data });
}

function binaryResponse(result: { bytes: Buffer; headers: Record<string, string> }) {
  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: { ...result.headers, "Cache-Control": "private, no-store, max-age=0" },
  });
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function emptyOrderListResult(pageSize: number): OrderListResult {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    pageCount: 1,
    workflowCounts: { all: 0 } as OrderListResult["workflowCounts"],
    queueCounts: {
      all: 0,
      processing: 0,
      ordered: 0,
      arrived: 0,
      arrived_notified: 0,
      repaired: 0,
      repaired_notified: 0,
    },
    resultGroupCounts: {
      processing: 0,
      ordered: 0,
      arrived: 0,
      arrived_notified: 0,
      repaired: 0,
      repaired_notified: 0,
      completed: 0,
      cancelled: 0,
    },
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
    return privateJson({ error: error.message }, 401);
  }
  if (error instanceof ForbiddenError) {
    return privateJson({ error: error.message, code: SETTINGS_ERROR_CODES.forbidden }, 403);
  }
  if (error instanceof SettingsMutationError) {
    return privateJson(
      {
        error: error.message,
        code: error.code,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
      error.status,
    );
  }

  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    const domainError = error as Error & {
      status: number;
      code: string;
      details?: Record<string, unknown>;
    };
    return privateJson(
      {
        error: domainError.message,
        code: domainError.code,
        ...(domainError.details && typeof domainError.details === "object"
          ? { details: domainError.details }
          : {}),
      },
      domainError.status,
    );
  }

  const message =
    error instanceof z.ZodError
      ? `请求参数错误：${error.issues.map((issue) => issue.message).join("，")}`
      : error instanceof Error
        ? error.message
        : "请求处理失败";

  return privateJson({ error: message }, 400);
}

function routeConflict(code: string, message: string) {
  const error = new Error(message) as Error & { status: number; code: string };
  error.status = 409;
  error.code = code;
  return error;
}

export async function handleRepairDeskGet(path: string, searchParams?: URLSearchParams) {
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
        assertInventoryReadPermission(actor);
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
      case "kiosk/available-devices": {
        const orderId = z.string().trim().min(1).max(128).parse(searchParams?.get("order_id"));
        assertKioskSessionCreatePermission(actor, { order_id: orderId });
        assertKioskEndToEndEnabled();
        const order = await api.getOrder(orderId, actor);
        if (order.capabilities?.canCreateKioskSession !== true) {
          throw new ForbiddenError("当前工单不能创建 iPad 任务");
        }
        const devices = await api.listKioskDevices(actor);
        return ok(
          devices
            .filter((device) => device.status === "active")
            .map(({ id, label, status }) => ({ id, label, status })),
        );
      }
      case "kiosk/sessions":
        assertKioskSessionReviewPermission(actor);
        return ok(await api.listKioskSessions(actor));
      default:
        return privateJson({ error: "接口不存在" }, 404);
    }
  } catch (error) {
    return fail(error);
  }
}

export function getRepairDeskPostActor(path: string) {
  return getRequestActor(true, {
    allowPendingStore: allowsPendingStore(path, "POST"),
  }).then(async (actor) => {
    if (path === "orders/data/import/preview") {
      await assertOrderDataAccess(actor, "order:import_preview", actor.storeId ?? "");
    }
    return actor;
  });
}

export async function handleRepairDeskPost(path: string, body: unknown, requestActor?: AuditActor) {
  try {
    const actor = requestActor ?? (await getRepairDeskPostActor(path));
    const api = await source();
    switch (path) {
      case "orders/data/template": {
        const { expectedStoreId } = orderDataStoreBodySchema.parse(body);
        return binaryResponse(await downloadOrderDataTemplate({ expectedStoreId, actor }));
      }
      case "orders/data/export": {
        const { expectedStoreId } = orderDataStoreBodySchema.parse(body);
        return binaryResponse(await exportOrderData({ expectedStoreId, actor }));
      }
      case "customers/data/stats-export": {
        const { expectedStoreId } = orderDataStoreBodySchema.parse(body);
        return binaryResponse(await exportCustomerStats({ expectedStoreId, actor }));
      }
      case "orders/data/batches": {
        const { expectedStoreId } = orderDataStoreBodySchema.parse(body);
        return ok(await listOrderDataBatchHistory({ expectedStoreId, actor }));
      }
      case "orders/data/import/preview": {
        if (!(body instanceof FormData)) throw new Error("导入文件格式无效");
        const file = body.get("file");
        const expectedStoreId = body.get("expectedStoreId");
        const mode = body.get("mode");
        if (!file || typeof file === "string") throw new Error("请选择 XLSX 文件");
        if (file.size > 4 * 1024 * 1024) throw new Error("上传文件超过 4 MB 限制");
        if (typeof expectedStoreId !== "string") throw new Error("店铺上下文无效");
        if (mode !== "update_only" && mode !== "create_and_update") {
          throw new Error("导入模式无效");
        }
        return ok(
          await previewOrderDataImport({
            actor,
            expectedStoreId,
            mode,
            fileName: file.name,
            mimeType: file.type,
            bytes: Buffer.from(await file.arrayBuffer()),
          }),
        );
      }
      case "orders/data/import/apply": {
        const { expectedStoreId, batchId } = orderDataApplyBodySchema.parse(body);
        return ok(await applyOrderDataImport({ actor, expectedStoreId, batchId }));
      }
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
        assertKioskEndToEndEnabled();
        const { input } = kioskDevicePairingBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.createKioskDevicePairing(input, actor),
            realtimeBroadcasts.kioskDeviceChanged,
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
            realtimeBroadcasts.kioskDeviceChanged,
          ),
        );
      }
      case "kiosk/sessions/create": {
        const { input } = kioskSessionCreateBodySchema.parse(body);
        assertKioskSessionCreatePermission(actor, input);
        assertKioskEndToEndEnabled();
        return ok(
          await runWithRealtime(
            actor,
            () => api.createKioskSession(input, actor),
            realtimeBroadcasts.kioskSessionChanged,
          ),
        );
      }
      case "kiosk/sessions/accept": {
        assertKioskSessionReviewPermission(actor);
        assertKioskReviewWriteEnabled();
        const input = kioskSessionReviewBodySchema.parse(body);
        return ok(
          await runWithRealtime(
            actor,
            () => api.acceptKioskSession(input, actor),
            realtimeBroadcasts.kioskSessionReviewed,
          ),
        );
      }
      case "kiosk/sessions/return": {
        assertKioskSessionReviewPermission(actor);
        assertKioskReviewWriteEnabled();
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
      case "dashboard/priority-summary": {
        assertOrderListPermission(actor);
        const { limit } = dashboardPrioritySummaryInputSchema.parse(body);
        return ok(
          await getDashboardPrioritySummary({
            actor,
            limit,
            listOrders: api.listOrders,
          }),
        );
      }
      case "customers/list":
        assertCustomerListPermission(actor);
        return ok(await api.listCustomers(customerListFiltersSchema.parse(body), actor));
      case "customers/list-page":
        assertCustomerListPermission(actor);
        return ok(await api.listCustomersPage(customerListPageInputSchema.parse(body), actor));
      case "inventory/list":
        assertInventoryReadPermission(actor);
        return ok(await api.listInventoryItems(inventoryListFiltersSchema.parse(body), actor));
      case "inventory/list-page":
        assertInventoryReadPermission(actor);
        return ok(await api.listInventoryItemsPage(inventoryListFiltersSchema.parse(body), actor));
      case "inventory/summary":
        assertInventoryReadPermission(actor);
        return ok(await api.getInventorySummary(inventoryListFiltersSchema.parse(body), actor));
      case "orders/create": {
        const input = createOrderSchema.parse(body);
        assertOrderCreatePermission(actor, input);
        const result = await api.createOrder(input, actor);
        if (!result.replayed) {
          await writeAuditLog({
            actor,
            action: "create",
            entityType: "repair_order",
            entityId: result.id,
            after: asRecord(result),
            metadata: { input: asRecord(body) },
          });
          queueRealtimeBroadcast(actor, realtimeBroadcasts.orderCreated);
        }
        return ok(result);
      }
      case "orders/create/status": {
        const { operation_id: operationId } = orderCreateOperationStatusSchema.parse(body);
        assertOrderCreatePermission(actor);
        return ok(await api.getOrderCreateOperationStatus(operationId, actor));
      }
      case "offline/orders/create": {
        const result = await syncRepairDeskOfflineOrderCreate(body, actor);
        await writeAuditLog({
          actor,
          action: "offline_sync",
          entityType: "repair_order",
          entityId: result.responseSummary?.serverOrderId ?? "pending",
          metadata: result.auditMetadata,
        });
        if (result.handlerResult.status === "synced") {
          queueRealtimeBroadcast(actor, realtimeBroadcasts.orderCreated);
        }
        return ok(result.handlerResult);
      }
      case "order/get": {
        const { id } = idBodySchema.parse(body);
        assertOrderDetailReadPermission(actor);
        return ok(await api.getOrder(id, actor));
      }
      case "inventory/get": {
        const { id } = idBodySchema.parse(body);
        assertInventoryReadPermission(actor);
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
      case "order/custody": {
        const { id, input } = updateOrderCustodyBodySchema.parse(body);
        assertOrderCustodyPermission(actor, input);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "repair_order",
            id,
            {
              device_custody_status: input.device_custody_status,
              reason: input.reason,
            },
            () => api.updateOrderCustody(id, input, actor),
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
      case "order/publish-quote": {
        const { id, input } = publishOrderQuoteBodySchema.parse(body);
        assertOrderQuotePreparePermission(actor, input);
        return ok(
          await runWithRealtime(
            actor,
            () => api.publishOrderQuote(id, input, actor),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order/confirm-quote-sent": {
        const { id, input } = confirmOrderQuoteSentBodySchema.parse(body);
        assertOrderQuoteSendPermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.confirmOrderQuoteSent(id, input, actor),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order/correct-terminal": {
        const { id, input } = correctTerminalOrderBodySchema.parse(body);
        assertRepairDeskPermission(actor, "order:correct");
        return ok(
          await runWithRealtime(
            actor,
            () => api.correctTerminalOrder(id, input, actor),
            realtimeBroadcasts.orderUpdated,
          ),
        );
      }
      case "order/reopen": {
        const { id, input } = reopenOrderBodySchema.parse(body);
        assertRepairDeskPermission(actor, "order:reopen");
        return ok(
          await runWithRealtime(
            actor,
            () => api.reopenOrder(id, input, actor),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order/void": {
        const { id, input } = voidOrderBodySchema.parse(body);
        assertRepairDeskPermission(actor, "order:void");
        return ok(
          await runWithRealtime(
            actor,
            () => api.voidOrder(id, input, actor),
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
        const { id, to, reason, expected_updated_at, idempotency_key } =
          transitionOrderBodySchema.parse(body);
        if (to === "quoted") {
          throw routeConflict(
            "USE_PUBLISH_QUOTE",
            "进入已报价阶段必须使用“发布报价”，以校验诊断、金额和版本",
          );
        }
        assertOrderTransitionPermission(actor);
        return ok(
          await auditGeneric(
            actor,
            "transition",
            "repair_order",
            id,
            { to, reason },
            () =>
              api.transitionOrder(id, to, {
                reason,
                expectedUpdatedAt: expected_updated_at,
                idempotencyKey: idempotency_key,
                operator: actor,
              }),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order/cancelled-return": {
        const { id, expected_updated_at, idempotency_key } =
          confirmCancelledOrderReturnBodySchema.parse(body);
        assertOrderTransitionPermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () =>
              api.confirmCancelledOrderReturn(id, {
                expectedUpdatedAt: expected_updated_at,
                idempotencyKey: idempotency_key,
                operator: actor,
              }),
            realtimeBroadcasts.orderTransitioned,
          ),
        );
      }
      case "order/batch-transition": {
        const { ids, to } = batchTransitionBodySchema.parse(body);
        if (to === "quoted") {
          throw routeConflict("USE_PUBLISH_QUOTE", "批量流转不能发布报价，请逐单完成检测与报价");
        }
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
        if (template_kind === "approval_request") {
          throw routeConflict(
            "USE_CONFIRM_QUOTE_SENT",
            "报价审批必须先打开 WhatsApp，再使用“确认已发送”绑定最新报价",
          );
        }
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
        approvalRequestBodySchema.parse(body);
        throw routeConflict(
          "USE_CONFIRM_QUOTE_SENT",
          "报价审批必须先打开 WhatsApp，再使用“确认已发送”绑定最新报价",
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
        assertInventoryIntakeDoesNotBypassBuybackFinalize(input);
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
        assertInventoryUpdatePermission(actor, input);
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
        if (to === "purchased") {
          throw new Error("回收成交必须使用带签名与幂等保护的确认成交操作");
        }
        assertInventoryTransitionPermission(actor, to);
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
        if (
          ["id_front", "id_back", "signature", "invoice_photo", "box_photo"].includes(input.kind)
        ) {
          assertBuybackSensitiveWorkflowAvailable();
          assertBuybackEvidenceCapturePermission(actor);
        } else {
          assertInventoryUpdatePermission(actor);
        }
        return ok(
          await runWithRealtime(
            actor,
            () => api.uploadInventoryAttachment(id, input, actor),
            realtimeBroadcasts.inventoryUpdated,
          ),
        );
      }
      case "inventory/attachment/access": {
        const { id, attachment_id } = inventoryAttachmentAccessBodySchema.parse(body);
        return ok(await api.accessInventoryAttachment(id, attachment_id, actor));
      }
      case "inventory/buyback/finalize": {
        const { id, input } = buybackFinalizeBodySchema.parse(body);
        assertBuybackSensitiveWorkflowAvailable();
        assertBuybackFinalizePermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.finalizeBuybackPurchase(id, input, actor),
            realtimeBroadcasts.inventoryTransitioned,
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
        assertLegacyElectronicsImportPermission(actor);
        return ok(await api.importElectronicsCsvPreview(csvContent, actor));
      }
      case "inventory/import/electronics/apply": {
        const { csvContent } = electronicsCsvImportBodySchema.parse(body);
        assertBuybackSensitiveWorkflowAvailable();
        assertLegacyElectronicsImportPermission(actor);
        return ok(
          await runWithRealtime(
            actor,
            () => api.applyElectronicsCsvImport(csvContent, actor),
            realtimeBroadcasts.inventoryCreated,
          ),
        );
      }
      case "settings/store/update": {
        assertStoreSettingsUpdatePermission(actor);
        const parsed = storeSettingsUpdateBodySchema.safeParse(body);
        if (!parsed.success) {
          throw SettingsMutationError.validationFailed(
            getStoreSettingsValidationFieldErrors(parsed.error),
          );
        }
        return ok(
          await runWithRealtime(
            actor,
            () => api.updateStoreSettings(parsed.data, actor),
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
        return privateJson({ error: "接口不存在" }, 404);
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
  assertOrderScopedPermission(actor, "order:list");
}

export function assertOrderDetailReadPermission(actor: AuditActor) {
  assertOrderScopedPermission(actor, "order:detail");
}

export function assertOrderCreatePermission(actor: AuditActor, input?: CreateOrderInput) {
  assertRepairDeskPermission(actor, "order:create");
  if (input?.assignee_membership_id) assertRepairDeskPermission(actor, "order:assign");
}

export function assertOrderUpdatePermission(actor: AuditActor, _input: UpdateOrderInput) {
  for (const action of resolveOrderUpdatePermissionActions(_input)) {
    assertOrderScopedPermission(actor, action);
  }
}

export function assertOrderPatchPermission(actor: AuditActor, input: PatchOrderInput) {
  for (const action of resolveOrderPatchPermissionActions(input)) {
    assertOrderScopedPermission(actor, action);
  }
}

export function assertOrderCustodyPermission(actor: AuditActor, _input: UpdateOrderCustodyInput) {
  assertOrderScopedPermission(actor, "order:update_intake");
}

export function assertOrderFinancePermission(actor: AuditActor, _input: PatchOrderFinanceInput) {
  assertRepairDeskPermission(actor, "payment:adjust");
}

export function assertOrderQuotePreparePermission(
  actor: AuditActor,
  _input?: PublishOrderQuoteInput,
) {
  assertRepairDeskPermission(actor, "order:quote_prepare");
}

export function assertOrderQuoteSendPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:quote_prepare");
  assertRepairDeskPermission(actor, "customer:message");
}

export function assertOrderPaymentPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "payment:collect");
}

export function assertOrderTransitionPermission(actor: AuditActor) {
  assertOrderScopedPermission(actor, "order:transition");
}

export function assertOrderBatchTransitionPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "order:batch_transition");
}

export function assertOrderAttachmentUploadPermission(actor: AuditActor) {
  assertOrderScopedPermission(actor, "order:photo_upload");
}

export function assertOrderCustomerMessagePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "customer:message");
}

export function assertInventoryReadPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:read");
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

export function assertInventoryIntakeDoesNotBypassBuybackFinalize(
  input: CreateInventoryIntakeInput,
) {
  const sourceType = input.source_type?.trim() || "buyback";
  if (sourceType === "buyback" && Number(input.buyback_price ?? 0) !== 0) {
    throw new Error("回收成本只能由带证件、签名与幂等保护的确认成交操作写入");
  }
}

export function assertInventoryUpdatePermission(
  actor: AuditActor,
  input?: UpdateInventoryItemInput,
) {
  assertRepairDeskPermission(actor, "inventory:update");
  if (input && hasOwnField(input, "buyback_price")) {
    assertRepairDeskPermission(actor, "finance:order_read");
  }
  if (input && ["repair_cost_amount", "fees_amount"].some((field) => hasOwnField(input, field))) {
    assertRepairDeskPermission(actor, "finance:profit_read");
  }
}

export function assertInventoryQualityCheckPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:quality_check");
}

export function assertInventoryTransitionPermission(actor: AuditActor, to: InventoryItemStatus) {
  if (to === "recycled") {
    assertRepairDeskPermission(actor, "inventory:write_off");
    return;
  }
  assertInventoryUpdatePermission(actor);
}

export function assertBuybackEvidenceCapturePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "buyback:evidence_capture");
}

export function assertBuybackFinalizePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "buyback:finalize");
}

export function assertBuybackSensitiveWorkflowAvailable() {
  if (!BUYBACK_SENSITIVE_WORKFLOW_ENABLED) {
    throw new ForbiddenError(BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE);
  }
}

export function assertInventorySalePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:sale");
}

export function assertInventoryTransactionPermission(
  actor: AuditActor,
  input: InventoryTransactionInput,
) {
  if (input.transaction_type === "buyback_payment") {
    throw new Error("回收付款只能由带证件、签名与幂等保护的确认成交操作生成");
  }
  if (input.transaction_type === "sale_payment") {
    assertInventorySalePermission(actor);
    return;
  }

  assertInventoryUpdatePermission(actor);
  assertRepairDeskPermission(actor, "finance:profit_read");
}

export function assertLegacyElectronicsImportPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "inventory:legacy_import");
}

export function assertStoreSettingsUpdatePermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "settings:update_store");
}

export function assertKioskSessionReviewPermission(actor: AuditActor) {
  assertRepairDeskPermission(actor, "settings:update_store");
  assertRepairDeskPermission(actor, "order:update_intake");
}

export function assertKioskSessionCreatePermission(
  actor: AuditActor,
  input: Pick<KioskSessionCreateInput, "order_id">,
) {
  const role = actor.storeRole ?? actor.role;
  assertRepairDeskPermission(actor, "order:update_intake", {
    scopeSatisfied:
      role === "technician" && Boolean(actor.activeMembershipId && input.order_id?.trim()),
  });
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
  if (hasOwnField(input.changes, "assignee_membership_id")) actions.add("order:assign");
  const repairFields = new Set([
    "diagnosis_result",
    "device_notes",
    "device_unlock",
    "internal_tag",
    "warranty_text",
    "warranty_months",
    "warranty_change_reason",
  ]);

  for (const key of Object.keys(input.changes)) {
    if (key === "assignee_membership_id") {
      continue;
    } else if (key === "parts_supplier_id") {
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
    "internal_tag",
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

function assertOrderScopedPermission(actor: AuditActor, action: PermissionAction) {
  const role = actor.storeRole ?? actor.role;
  assertRepairDeskPermission(actor, action, {
    scopeSatisfied: role === "technician" ? Boolean(actor.activeMembershipId) : false,
  });
}

function assertRepairDeskPermission(
  actor: AuditActor,
  action: PermissionAction,
  context?: PermissionContext,
) {
  if (actor.isSystem && isRepairDeskE2eAuthBypassEnabled()) return;
  assertPermission(actor, action, context);
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
