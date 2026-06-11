import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  CreateOrderInput,
  Customer,
  Device,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  BatchTransitionResult,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerListFilters,
  CustomerListResult,
  CustomerMessageInput,
  CustomerUpdateInput,
  CreateInventoryIntakeInput,
  PaymentResult,
  ElectronicsImportPreview,
  ElectronicsImportReport,
  InventoryDetail,
  InventoryItemStatus,
  InventoryListFilters,
  InventoryListItem,
  InventoryListResult,
  InventoryQualityCheckInput,
  InventoryStats,
  InventoryTransactionInput,
  SellInventoryItemInput,
  MessageTemplate,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  RepairDeskOptions,
  StoreContext,
  StoreCreateInput,
  StoreInviteInput,
  StoreMembersResult,
  StoreSettings,
  StoreSettingsUpdateInput,
  UpdateOrderInput,
  UpdateInventoryItemInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";

export type {
  CreateOrderInput,
  Customer,
  Device,
  FaultPriceItem,
  MessageLog,
  OrderDetail,
  OrderEvent,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  BatchTransitionResult,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowup,
  CustomerFollowupInput,
  CustomerInteraction,
  CustomerListFilters,
  CustomerListItem,
  CustomerListResult,
  CustomerMessageInput,
  CustomerStats,
  CustomerTag,
  CustomerUpdateInput,
  CreateInventoryIntakeInput,
  ElectronicsImportPreview,
  ElectronicsImportReport,
  PaymentResult,
  InventoryCheckStatus,
  InventoryCosmeticGrade,
  InventoryDetail,
  InventoryEvent,
  InventoryFunctionalGrade,
  InventoryItem,
  InventoryItemStatus,
  InventoryListFilters,
  InventoryListItem,
  InventoryListResult,
  InventoryQualityCheck,
  InventoryQualityCheckInput,
  InventoryStats,
  InventoryTransaction,
  InventoryTransactionInput,
  InventoryTransactionType,
  MessageTemplate,
  MessageTemplateChannel,
  MessageTemplateDomain,
  MessageTemplateLanguage,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  RepairOrder,
  RepairDeskOptions,
  SellInventoryItemInput,
  StoreContext,
  StoreCreateInput,
  StoreInvitation,
  StoreInviteInput,
  StoreMember,
  StoreMembersResult,
  StoreSettings,
  StoreSettingsUpdateInput,
  UpdateOrderInput,
  UpdateInventoryItemInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";

export async function listInventoryItems(
  filters: InventoryListFilters = {},
): Promise<InventoryListItem[]> {
  return postJson<InventoryListItem[]>("inventory/list", filters);
}

export async function listInventoryItemsPage(
  filters: InventoryListFilters = {},
): Promise<InventoryListResult> {
  return postJson<InventoryListResult>("inventory/list-page", filters);
}

export async function getInventoryStats(): Promise<InventoryStats> {
  return requestJson<InventoryStats>("inventory/stats");
}

export async function getInventoryItem(id: string): Promise<InventoryDetail> {
  return postJson<InventoryDetail>("inventory/get", { id });
}

export async function createInventoryIntake(
  input: CreateInventoryIntakeInput,
): Promise<{ id: string }> {
  return postJson<{ id: string }>("inventory/intake/create", { input });
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("inventory/update", { id, input });
}

export async function transitionInventoryItem(
  id: string,
  to: InventoryItemStatus,
  opts: { reason?: string } = {},
): Promise<{ ok: boolean; from: InventoryItemStatus; to: InventoryItemStatus }> {
  return postJson("inventory/transition", { id, to, reason: opts.reason });
}

export async function recordInventoryCheck(
  id: string,
  input: InventoryQualityCheckInput,
): Promise<{ id: string }> {
  return postJson<{ id: string }>("inventory/check", { id, input });
}

export async function recordInventoryTransaction(
  id: string,
  input: InventoryTransactionInput,
): Promise<{ id: string }> {
  return postJson<{ id: string }>("inventory/transaction", { id, input });
}

export async function sellInventoryItem(
  id: string,
  input: SellInventoryItemInput,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("inventory/sell", { id, input });
}

export async function importElectronicsCsvPreview(
  csvContent: string,
): Promise<ElectronicsImportPreview> {
  return postJson<ElectronicsImportPreview>("inventory/import/electronics/preview", {
    csvContent,
  });
}

export async function applyElectronicsCsvImport(
  csvContent: string,
): Promise<ElectronicsImportReport> {
  return postJson<ElectronicsImportReport>("inventory/import/electronics/apply", {
    csvContent,
  });
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return requestJson<StoreSettings>("settings/store");
}

export async function getStoreContext(): Promise<StoreContext> {
  return requestJson<StoreContext>("stores/context");
}

export async function getStoreMembers(): Promise<StoreMembersResult> {
  return requestJson<StoreMembersResult>("stores/members");
}

export async function createStore(input: StoreCreateInput): Promise<StoreContext> {
  return postJson<StoreContext>("stores/create", { input });
}

export async function switchStore(storeId: string): Promise<StoreContext> {
  return postJson<StoreContext>("stores/switch", { storeId });
}

export async function inviteStoreMember(input: StoreInviteInput): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/invite-member", { input });
}

export async function updateStoreSettings(input: StoreSettingsUpdateInput): Promise<StoreSettings> {
  return postJson<StoreSettings>("settings/store/update", { input });
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  return requestJson<MessageTemplate[]>("message-templates");
}

export async function updateMessageTemplate(
  id: string,
  input: MessageTemplateUpdateInput,
): Promise<MessageTemplate> {
  return postJson<MessageTemplate>("message-template/update", { id, input });
}

export async function resetMessageTemplate(id: string): Promise<MessageTemplate> {
  return postJson<MessageTemplate>("message-template/reset", { id });
}

export async function renderMessageTemplatePreview(
  input: MessageTemplatePreviewInput,
): Promise<MessageTemplatePreviewResult> {
  return postJson<MessageTemplatePreviewResult>("message-template/preview", input);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/repairdesk/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `请求失败：${response.status}`);
  }
  return payload.data as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  return postJson<OrderListItem[]>("orders/list", filters);
}

export async function listOrdersPage(input: OrderListPageInput = {}): Promise<OrderListResult> {
  return postJson<OrderListResult>("orders/list-page", input);
}

export async function getOrderStats(): Promise<OrderStats> {
  return requestJson<OrderStats>("order-stats");
}

export async function getOrder(id: string): Promise<OrderDetail> {
  return postJson<OrderDetail>("order/get", { id });
}

export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string } = {},
) {
  return postJson("order/transition", { id, to, reason: opts.reason });
}

export async function batchTransition(
  ids: string[],
  to: RepairOrderStatus,
): Promise<BatchTransitionResult> {
  return postJson<BatchTransitionResult>("order/batch-transition", { ids, to });
}

export async function recordPayment(
  id: string,
  amount: number,
  method?: string,
): Promise<PaymentResult> {
  return postJson<PaymentResult>("order/payment", { id, amount, method });
}

export async function sendNotification(id: string, body: string, channel: "whatsapp" | "sms") {
  return postJson("order/notification", { id, body, channel });
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
): Promise<WhatsappNotificationResult> {
  return postJson<WhatsappNotificationResult>("order/whatsapp-notification", {
    id,
    body,
    template_kind: templateKind,
    transition_to: transitionTo,
  });
}

export async function sendApprovalRequest(id: string, body: string) {
  return postJson("order/approval-request", { id, body });
}

export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  return postJson<Customer[]>("customers/search", { q, limit });
}

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  return postJson<Device[]>("customers/devices", { customerId });
}

export async function listCustomers(
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  return postJson<CustomerListResult>("customers/list", filters);
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  return postJson<CustomerDetail>("customer/get", { id });
}

export async function createCustomer(input: CustomerCreateInput): Promise<{ id: string }> {
  return postJson<{ id: string }>("customer/create", { input });
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("customer/update", { id, input });
}

export async function upsertCustomerDevice(
  customerId: string,
  input: CustomerDeviceInput,
): Promise<{ id: string }> {
  return postJson<{ id: string }>("customer/device/upsert", { customerId, input });
}

export async function deleteCustomerDevice(
  customerId: string,
  deviceId: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("customer/device/delete", { customerId, deviceId });
}

export async function setCustomerTags(
  customerId: string,
  tagIds: string[],
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("customer/tags/update", { customerId, tagIds });
}

export async function createCustomerFollowup(
  customerId: string,
  input: CustomerFollowupInput,
): Promise<{ id: string }> {
  return postJson<{ id: string }>("customer/followup/create", { customerId, input });
}

export async function completeCustomerFollowup(
  customerId: string,
  followupId: string,
): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("customer/followup/complete", { customerId, followupId });
}

export async function sendCustomerMessage(
  customerId: string,
  input: CustomerMessageInput,
): Promise<{ ok: boolean; id: string }> {
  return postJson<{ ok: boolean; id: string }>("customer/message", { customerId, input });
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  return postJson<{ id: string }>("orders/create", input);
}

export async function updateOrder(id: string, input: UpdateOrderInput): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("order/update", { id, input });
}

export async function patchOrder(id: string, input: PatchOrderInput): Promise<PatchOrderResult> {
  return postJson<PatchOrderResult>("order/patch", { id, input });
}

export async function patchOrderFinance(
  id: string,
  input: PatchOrderFinanceInput,
): Promise<PatchOrderResult> {
  return postJson<PatchOrderResult>("order/finance", { id, input });
}

export async function getRepairDeskOptions(): Promise<RepairDeskOptions> {
  return requestJson<RepairDeskOptions>("options");
}
