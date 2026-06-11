import { NextResponse } from "next/server";
import { z } from "zod";

import {
  batchTransition,
  createOrderWorkflowStatus,
  createOrder,
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
  importElectronicsCsvPreview,
  listInventoryItems,
  listInventoryItemsPage,
  recordInventoryCheck,
  recordInventoryTransaction,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
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
  createStore,
  getStoreContext,
  inviteStoreMember,
  listStoreMembers,
  switchActiveStore,
} from "@/features/stores/server/store.service";
import {
  approveOnboardingRequest,
  getOnboardingStatus,
  listPlatformOnboardingRequests,
  rejectOnboardingRequest,
  submitOnboardingRequest,
} from "@/features/platform/server/platform.service";
import { getRequestActor, UnauthorizedError, ForbiddenError } from "@/server/auth-context";
import { writeAuditLog } from "@/server/audit";
import {
  approvalRequestBodySchema,
  batchTransitionBodySchema,
  createOrderSchema,
  customerCreateBodySchema,
  customerDeviceDeleteBodySchema,
  customerDeviceUpsertBodySchema,
  customerFollowupCompleteBodySchema,
  customerFollowupCreateBodySchema,
  customerIdBodySchema,
  customerListFiltersSchema,
  customerListPageInputSchema,
  customerMessageBodySchema,
  customerSearchBodySchema,
  customerTagsUpdateBodySchema,
  customerUpdateBodySchema,
  electronicsCsvImportBodySchema,
  idBodySchema,
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
  notificationBodySchema,
  onboardingDecisionBodySchema,
  onboardingRequestBodySchema,
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
  storeSettingsUpdateBodySchema,
  storeSwitchBodySchema,
  transitionOrderBodySchema,
  updateOrderBodySchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

const supabaseSource = {
  batchTransition,
  completeCustomerFollowup,
  approveOnboardingRequest,
  applyElectronicsCsvImport,
  createCustomer,
  createCustomerFollowup,
  createInventoryIntake,
  createOrder,
  createOrderWorkflowStatus,
  createStore,
  deleteCustomerDevice,
  getCustomerDevices,
  getCustomerDetail,
  getInventoryItem,
  getInventoryStats,
  getOnboardingStatus,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  getStoreContext,
  getStoreSettings,
  importElectronicsCsvPreview,
  inviteStoreMember,
  listCustomers,
  listCustomersPage,
  listInventoryItems,
  listInventoryItemsPage,
  listMessageTemplates,
  listOrderWorkflow,
  listOrders,
  listOrdersPage,
  listPlatformOnboardingRequests,
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
  searchCustomers,
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
  updateCustomer,
  updateInventoryItem,
  updateMessageTemplate,
  updateOrder,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  updateStoreSettings,
  upsertCustomerDevice,
};

async function source() {
  const { hasSupabaseConfig } = await import("@/server/supabase");
  if (hasSupabaseConfig()) return supabaseSource;

  const mock = await import("@/lib/mock/api");
  return {
    ...mock,
    getRepairDeskOptions: async () => ({
      suppliers: mock.suppliers,
      technicians: mock.allTechnicians,
    }),
    getOnboardingStatus: async (actor: Awaited<ReturnType<typeof getRequestActor>>) => ({
      email: actor.email,
      displayName: actor.displayName,
      isPlatformAdmin: Boolean(actor.isPlatformAdmin),
      activeStore: actor.storeId
        ? {
            id: actor.storeId,
            name: actor.storeName || "Mock Store",
            slug: "mock-store",
            role: actor.storeRole ?? actor.role ?? "owner",
            status: "active" as const,
          }
        : undefined,
      stores: actor.stores ?? [],
      requests: [],
      availableStores: [],
    }),
    submitOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持注册申请");
    },
    listPlatformOnboardingRequests: async () => [],
    approveOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持平台审批");
    },
    rejectOnboardingRequest: async () => {
      throw new Error("Mock 模式暂不支持平台审批");
    },
  };
}

function ok(data: unknown) {
  return NextResponse.json({ data });
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
    const actor = await getRequestActor(true, { allowPendingStore: allowsPendingStore(path) });
    const api = await source();
    switch (path) {
      case "onboarding/status":
        return ok(await api.getOnboardingStatus(actor));
      case "platform/onboarding/requests":
        return ok(await api.listPlatformOnboardingRequests(actor));
      case "order-stats":
        return ok(await api.getOrderStats(actor));
      case "order-workflow":
        return ok(await api.listOrderWorkflow(actor));
      case "options":
        return ok(await api.getRepairDeskOptions(actor));
      case "inventory/stats":
        return ok(await api.getInventoryStats(actor));
      case "settings/store":
        return ok(await api.getStoreSettings(actor));
      case "message-templates":
        return ok(await api.listMessageTemplates(actor));
      case "stores/context":
        return ok(await api.getStoreContext(actor));
      case "stores/members":
        return ok(await api.listStoreMembers(actor));
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}

export async function handleRepairDeskPost(path: string, body: unknown) {
  try {
    const actor = await getRequestActor(true, { allowPendingStore: allowsPendingStore(path) });
    const api = await source();
    switch (path) {
      case "onboarding/request": {
        const { input } = onboardingRequestBodySchema.parse(body);
        return ok(await api.submitOnboardingRequest(input, actor));
      }
      case "platform/onboarding/approve":
        return ok(
          await api.approveOnboardingRequest(onboardingDecisionBodySchema.parse(body), actor),
        );
      case "platform/onboarding/reject":
        return ok(
          await api.rejectOnboardingRequest(onboardingDecisionBodySchema.parse(body), actor),
        );
      case "orders/list":
        return ok(await api.listOrders(orderListFiltersSchema.parse(body), actor));
      case "orders/list-page":
        return ok(await api.listOrdersPage(orderListPageInputSchema.parse(body), actor));
      case "customers/list":
        return ok(await api.listCustomers(customerListFiltersSchema.parse(body), actor));
      case "customers/list-page":
        return ok(await api.listCustomersPage(customerListPageInputSchema.parse(body), actor));
      case "inventory/list":
        return ok(await api.listInventoryItems(inventoryListFiltersSchema.parse(body), actor));
      case "inventory/list-page":
        return ok(await api.listInventoryItemsPage(inventoryListFiltersSchema.parse(body), actor));
      case "orders/create":
        return ok(
          await auditGeneric(actor, "create", "repair_order", "new", body, () =>
            api.createOrder(createOrderSchema.parse(body), actor),
          ),
        );
      case "order/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await api.getOrder(id, actor));
      }
      case "inventory/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await api.getInventoryItem(id, actor));
      }
      case "customer/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await api.getCustomerDetail(id, actor));
      }
      case "customer/create": {
        const { input } = customerCreateBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "create", "customer", "new", input, () =>
            api.createCustomer(input, actor),
          ),
        );
      }
      case "customer/update": {
        const { id, input } = customerUpdateBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "update", "customer", id, input, () =>
            api.updateCustomer(id, input, actor),
          ),
        );
      }
      case "customer/device/upsert": {
        const { customerId, input } = customerDeviceUpsertBodySchema.parse(body);
        return ok(await api.upsertCustomerDevice(customerId, input, actor));
      }
      case "customer/device/delete": {
        const { customerId, deviceId } = customerDeviceDeleteBodySchema.parse(body);
        return ok(await api.deleteCustomerDevice(customerId, deviceId, actor));
      }
      case "customer/tags/update": {
        const { customerId, tagIds } = customerTagsUpdateBodySchema.parse(body);
        return ok(await api.setCustomerTags(customerId, tagIds, actor));
      }
      case "customer/followup/create": {
        const { customerId, input } = customerFollowupCreateBodySchema.parse(body);
        return ok(await api.createCustomerFollowup(customerId, input, actor));
      }
      case "customer/followup/complete": {
        const { customerId, followupId } = customerFollowupCompleteBodySchema.parse(body);
        return ok(await api.completeCustomerFollowup(customerId, followupId, actor));
      }
      case "customer/message": {
        const { customerId, input } = customerMessageBodySchema.parse(body);
        return ok(await api.sendCustomerMessage(customerId, input, actor));
      }
      case "order/update": {
        const { id, input } = updateOrderBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "update", "repair_order", id, input, () =>
            api.updateOrder(id, input, actor),
          ),
        );
      }
      case "order/patch": {
        const { id, input } = patchOrderBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "update", "repair_order", id, input, () =>
            api.patchOrder(id, input, actor),
          ),
        );
      }
      case "order/finance": {
        const { id, input } = patchOrderFinanceBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "payment", "repair_order", id, input, () =>
            api.patchOrderFinance(id, input, actor),
          ),
        );
      }
      case "order/transition": {
        const { id, to, reason } = transitionOrderBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "transition", "repair_order", id, { to, reason }, () =>
            api.transitionOrder(id, to, { reason, operator: actor, storeId: actor.storeId }),
          ),
        );
      }
      case "order/batch-transition": {
        const { ids, to } = batchTransitionBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "transition", "repair_order", "batch", { ids, to }, () =>
            api.batchTransition(ids, to, actor),
          ),
        );
      }
      case "order-workflow/status/create": {
        const { input } = orderWorkflowStatusCreateBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "create", "order_workflow_status", "new", input, () =>
            api.createOrderWorkflowStatus(input, actor),
          ),
        );
      }
      case "order-workflow/status/update": {
        const { id, input } = orderWorkflowStatusUpdateBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "update", "order_workflow_status", id, input, () =>
            api.updateOrderWorkflowStatus(id, input, actor),
          ),
        );
      }
      case "order-workflow/status/reorder": {
        const input = orderWorkflowStatusReorderBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "reorder", "order_workflow_status", "batch", input, () =>
            api.reorderOrderWorkflowStatuses(input, actor),
          ),
        );
      }
      case "order-workflow/status/enabled": {
        const input = orderWorkflowStatusEnabledBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "update", "order_workflow_status", input.id, input, () =>
            api.setOrderWorkflowStatusEnabled(input, actor),
          ),
        );
      }
      case "order-workflow/transitions/update": {
        const input = orderWorkflowTransitionsUpdateBodySchema.parse(body);
        return ok(
          await auditGeneric(
            actor,
            "update",
            "order_workflow_transition",
            input.from_status_code,
            input,
            () => api.updateOrderWorkflowTransitions(input, actor),
          ),
        );
      }
      case "order/payment": {
        const { id, amount, method } = paymentBodySchema.parse(body);
        return ok(
          await auditGeneric(actor, "payment", "repair_order", id, { amount, method }, () =>
            api.recordPayment(id, amount, method, actor),
          ),
        );
      }
      case "order/notification": {
        const { id, body: messageBody, channel } = notificationBodySchema.parse(body);
        return ok(await api.sendNotification(id, messageBody, channel, actor));
      }
      case "order/whatsapp-notification": {
        const {
          id,
          body: messageBody,
          template_kind,
          transition_to,
        } = whatsappNotificationBodySchema.parse(body);
        return ok(
          await api.sendWhatsappNotification(id, messageBody, template_kind, transition_to, actor),
        );
      }
      case "order/approval-request": {
        const { id, body: messageBody } = approvalRequestBodySchema.parse(body);
        return ok(await api.sendApprovalRequest(id, messageBody, actor));
      }
      case "customers/search": {
        const { q, limit } = customerSearchBodySchema.parse(body);
        return ok(await api.searchCustomers(q, limit, actor));
      }
      case "customers/devices": {
        const { customerId } = customerIdBodySchema.parse(body);
        return ok(await api.getCustomerDevices(customerId, actor));
      }
      case "inventory/intake/create": {
        const { input } = inventoryIntakeCreateBodySchema.parse(body);
        return ok(await api.createInventoryIntake(input, actor));
      }
      case "inventory/update": {
        const { id, input } = inventoryUpdateBodySchema.parse(body);
        return ok(await api.updateInventoryItem(id, input, actor));
      }
      case "inventory/transition": {
        const { id, to, reason } = inventoryTransitionBodySchema.parse(body);
        return ok(await api.transitionInventoryItem(id, to, { reason }, actor));
      }
      case "inventory/check": {
        const { id, input } = inventoryQualityCheckBodySchema.parse(body);
        return ok(await api.recordInventoryCheck(id, input, actor));
      }
      case "inventory/transaction": {
        const { id, input } = inventoryTransactionBodySchema.parse(body);
        return ok(await api.recordInventoryTransaction(id, input, actor));
      }
      case "inventory/sell": {
        const { id, input } = inventorySellBodySchema.parse(body);
        return ok(await api.sellInventoryItem(id, input, actor));
      }
      case "inventory/import/electronics/preview": {
        const { csvContent } = electronicsCsvImportBodySchema.parse(body);
        return ok(await api.importElectronicsCsvPreview(csvContent));
      }
      case "inventory/import/electronics/apply": {
        const { csvContent } = electronicsCsvImportBodySchema.parse(body);
        return ok(await api.applyElectronicsCsvImport(csvContent, actor));
      }
      case "settings/store/update": {
        const { input } = storeSettingsUpdateBodySchema.parse(body);
        return ok(await api.updateStoreSettings(input, actor));
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
        return ok(await api.inviteStoreMember(input, actor));
      }
      case "message-template/update": {
        const { id, input } = messageTemplateUpdateBodySchema.parse(body);
        return ok(await api.updateMessageTemplate(id, input, actor));
      }
      case "message-template/reset": {
        const { id } = messageTemplateResetBodySchema.parse(body);
        return ok(await api.resetMessageTemplate(id, actor));
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

function allowsPendingStore(path: string) {
  return path.startsWith("onboarding/") || path.startsWith("platform/");
}

async function auditGeneric<T>(
  actor: Awaited<ReturnType<typeof getRequestActor>>,
  action: string,
  entityType: string,
  entityId: string,
  input: unknown,
  run: () => Promise<T>,
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
  return result;
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
