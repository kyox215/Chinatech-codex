import type { RepairOrderStatus } from "@/lib/mock/enums";
import type {
  AccountProfileUpdateInput,
  CreateOrderInput,
  Customer,
  Device,
  CustomerIntakeCandidate,
  DashboardSummary,
  DashboardSummaryInput,
  OrderDetail,
  OrderApprovalFlowStatus,
  OrderExceptionStatus,
  OrderWorkflow,
  OrderWorkflowStatusCode,
  OrderWorkflowStatus,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusEnabledInput,
  OrderWorkflowStatusReorderInput,
  OrderWorkflowStatusUpdateInput,
  OrderWorkflowTransitionsUpdateInput,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderQueueSummary,
  OrderQueueSummaryInput,
  OrderStats,
  OrderDataImportApplyResult,
  OrderDataImportMode,
  OrderDataImportPreview,
  OrderApprovalDecisionInput,
  OrderApprovalDecisionResult,
  OrderAttachmentUploadInput,
  OrderAttachmentUploadResult,
  OrderNotifyStatus,
  OrderPartsStatus,
  OrderPaymentStatus,
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
  CustomerListPageInput,
  CustomerListPageResult,
  CustomerListResult,
  CustomerMessageInput,
  CustomerUpdateInput,
  CreateInventoryIntakeInput,
  PaymentResult,
  ElectronicsImportPreview,
  ElectronicsImportReport,
  InventoryDetail,
  InventoryAttachment,
  InventoryAttachmentKind,
  InventoryAttachmentUploadInput,
  InventoryAttachmentUploadResult,
  InventoryItemStatus,
  InventoryListFilters,
  InventoryListItem,
  InventoryListResult,
  InventoryQualityCheckInput,
  InventoryStats,
  InventorySummary,
  InventoryTransactionInput,
  KioskDevice,
  KioskDevicePairingInput,
  KioskDevicePairingResult,
  KioskSession,
  KioskSessionCreateInput,
  KioskSessionReturnInput,
  SellInventoryItemInput,
  MessageTemplate,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  OnboardingDecisionInput,
  OnboardingRequest,
  OnboardingRequestInput,
  OnboardingStatus,
  RepairDeskOptions,
  StoreRole,
  StoreContext,
  StoreCreateInput,
  StoreInvitation,
  StoreInvitationDecisionInput,
  StoreInviteLinkCreateInput,
  StoreInviteLinkCreateResult,
  StoreInviteLinkDecisionInput,
  StoreInviteLinkRedeemInput,
  StoreInviteInput,
  StoreMemberDecisionInput,
  StoreMemberPermissionUpdateInput,
  StoreMemberRoleUpdateInput,
  StoreMembersResult,
  StorePermissionAction,
  StoreSettings,
  StoreSettingsUpdateInput,
  Supplier,
  SupplierInput,
  UpdateOrderInput,
  UpdateInventoryItemInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";

export class RepairDeskApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RepairDeskApiError";
  }
}

export function isRepairDeskAuthorizationError(error: unknown) {
  return error instanceof RepairDeskApiError && (error.status === 401 || error.status === 403);
}

export type RepairDeskRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_REPAIRDESK_REQUEST_TIMEOUT_MS = 30_000;

export type {
  ApprovedStoreRole,
  CreateOrderInput,
  Customer,
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
  DashboardSummary,
  DashboardSummaryInput,
  Device,
  DeviceUnlockInput,
  DeviceUnlockMethod,
  FaultPriceItem,
  MessageLog,
  OrderDetail,
  OrderEvent,
  OrderApprovalFlowStatus,
  OrderExceptionStatus,
  OrderWorkflow,
  OrderWorkflowBucket,
  OrderWorkflowStatusCode,
  OrderWorkflowStatus,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusEnabledInput,
  OrderWorkflowStatusReorderInput,
  OrderWorkflowStatusUpdateInput,
  OrderWorkflowTone,
  OrderWorkflowTransition,
  OrderWorkflowTransitionsUpdateInput,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderQueueSummary,
  OrderQueueSummaryInput,
  OrderStats,
  OrderDataImportApplyResult,
  OrderDataImportMode,
  OrderDataImportPreview,
  OrderApprovalDecisionInput,
  OrderApprovalDecisionResult,
  OrderAttachment,
  OrderAttachmentKind,
  OrderAttachmentUploadInput,
  OrderAttachmentUploadResult,
  OrderNotifyStatus,
  OrderPartsStatus,
  OrderPaymentStatus,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  BatchTransitionResult,
  CustomerCreateInput,
  AccountProfileUpdateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowup,
  CustomerFollowupInput,
  CustomerInteraction,
  CustomerListFilters,
  CustomerListItem,
  CustomerListPageInput,
  CustomerListPageResult,
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
  InventoryAttachment,
  InventoryAttachmentKind,
  InventoryAttachmentUploadInput,
  InventoryAttachmentUploadResult,
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
  InventorySummary,
  InventoryTransaction,
  InventoryTransactionInput,
  InventoryTransactionType,
  KioskDevice,
  KioskDevicePairingInput,
  KioskDevicePairingResult,
  KioskDeviceStatus,
  KioskPairResult,
  KioskPublicSession,
  KioskSession,
  KioskSessionCreateInput,
  KioskSessionReturnInput,
  KioskSessionStatus,
  KioskSessionSubmitInput,
  KioskSessionType,
  MessageTemplate,
  MessageTemplateChannel,
  MessageTemplateDomain,
  MessageTemplateLanguage,
  MessageTemplatePreviewInput,
  MessageTemplatePreviewResult,
  MessageTemplateUpdateInput,
  OnboardingDecisionInput,
  OnboardingRequest,
  OnboardingRequestInput,
  OnboardingRequestStatus,
  OnboardingRequestType,
  OnboardingStatus,
  RepairOrder,
  RepairDeskOptions,
  StoreRole,
  SellInventoryItemInput,
  StoreContext,
  StoreCreateInput,
  StoreInvitation,
  StoreInvitationDecisionInput,
  StoreInviteLinkCreateInput,
  StoreInviteLinkCreateResult,
  StoreInviteLinkDecisionInput,
  StoreInviteLinkRedeemInput,
  StoreInviteInput,
  StoreMember,
  StoreMemberDecisionInput,
  StoreMemberPermissionUpdateInput,
  StoreMemberRoleUpdateInput,
  StoreMembersResult,
  StorePermissionAction,
  StoreSettings,
  StoreSettingsUpdateInput,
  Supplier,
  SupplierInput,
  UpdateOrderInput,
  UpdateInventoryItemInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";

export async function listInventoryItems(
  filters: InventoryListFilters = {},
  options?: RepairDeskRequestOptions,
): Promise<InventoryListItem[]> {
  return postJson<InventoryListItem[]>("inventory/list", filters, options);
}

export async function listInventoryItemsPage(
  filters: InventoryListFilters = {},
  options?: RepairDeskRequestOptions,
): Promise<InventoryListResult> {
  return postJson<InventoryListResult>("inventory/list-page", filters, options);
}

export async function getInventoryStats(
  options?: RepairDeskRequestOptions,
): Promise<InventoryStats> {
  return requestJson<InventoryStats>("inventory/stats", {}, options);
}

export async function getInventorySummary(
  filters: InventoryListFilters = {},
  options?: RepairDeskRequestOptions,
): Promise<InventorySummary> {
  return postJson<InventorySummary>("inventory/summary", filters, options);
}

export async function getInventoryItem(
  id: string,
  options?: RepairDeskRequestOptions,
): Promise<InventoryDetail> {
  return postJson<InventoryDetail>("inventory/get", { id }, options);
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

export async function uploadInventoryAttachment(
  id: string,
  input: InventoryAttachmentUploadInput,
): Promise<InventoryAttachmentUploadResult> {
  return postJson<InventoryAttachmentUploadResult>("inventory/attachment/upload", { id, input });
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

export async function downloadOrderDataTemplate(expectedStoreId: string) {
  return requestFile("orders/data/template", { expectedStoreId });
}

export async function exportOrderData(expectedStoreId: string) {
  return requestFile("orders/data/export", { expectedStoreId });
}

export async function exportCustomerStats(expectedStoreId: string) {
  return requestFile("customers/data/stats-export", { expectedStoreId });
}

export async function previewOrderDataImport(input: {
  file: File;
  expectedStoreId: string;
  mode: OrderDataImportMode;
}): Promise<OrderDataImportPreview> {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("expectedStoreId", input.expectedStoreId);
  formData.set("mode", input.mode);
  const response = await requestRaw(
    "orders/data/import/preview",
    { method: "POST", body: formData },
    { timeoutMs: 60_000 },
    false,
  );
  return readJsonResponse<OrderDataImportPreview>(response);
}

export async function applyOrderDataImport(input: {
  batchId: string;
  expectedStoreId: string;
}): Promise<OrderDataImportApplyResult> {
  return postJson<OrderDataImportApplyResult>("orders/data/import/apply", input, {
    timeoutMs: 60_000,
  });
}

export async function getStoreSettings(options?: RepairDeskRequestOptions): Promise<StoreSettings> {
  return requestJson<StoreSettings>("settings/store", {}, options);
}

export async function listSuppliers(options?: RepairDeskRequestOptions): Promise<Supplier[]> {
  return requestJson<Supplier[]>("settings/suppliers", {}, options);
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  return postJson<Supplier>("settings/suppliers/create", { input });
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  return postJson<Supplier>("settings/suppliers/update", { id, input });
}

export async function archiveSupplier(id: string): Promise<Supplier> {
  return postJson<Supplier>("settings/suppliers/archive", { id });
}

export async function getStoreContext(options?: RepairDeskRequestOptions): Promise<StoreContext> {
  return requestJson<StoreContext>("stores/context", {}, options);
}

export async function getOnboardingStatus(
  options?: RepairDeskRequestOptions,
): Promise<OnboardingStatus> {
  return requestJson<OnboardingStatus>("onboarding/status", {}, options);
}

export async function updateAccountProfile(
  input: AccountProfileUpdateInput,
): Promise<OnboardingStatus> {
  return postJson<OnboardingStatus>("account/profile/update", { input });
}

export async function submitOnboardingRequest(
  input: OnboardingRequestInput,
): Promise<OnboardingRequest> {
  return postJson<OnboardingRequest>("onboarding/request", { input });
}

export async function cancelOnboardingRequest(
  input: OnboardingDecisionInput,
): Promise<OnboardingRequest> {
  return postJson<OnboardingRequest>("onboarding/request/cancel", input);
}

export async function listPlatformOnboardingRequests(): Promise<OnboardingRequest[]> {
  return requestJson<OnboardingRequest[]>("platform/onboarding/requests");
}

export async function approveOnboardingRequest(
  input: OnboardingDecisionInput,
): Promise<OnboardingRequest> {
  return postJson<OnboardingRequest>("platform/onboarding/approve", input);
}

export async function rejectOnboardingRequest(
  input: OnboardingDecisionInput,
): Promise<OnboardingRequest> {
  return postJson<OnboardingRequest>("platform/onboarding/reject", input);
}

export async function getStoreMembers(
  options?: RepairDeskRequestOptions,
): Promise<StoreMembersResult> {
  return requestJson<StoreMembersResult>("stores/members", {}, options);
}

export async function listKioskDevices(options?: RepairDeskRequestOptions): Promise<KioskDevice[]> {
  return requestJson<KioskDevice[]>("kiosk/devices", {}, options);
}

export async function createKioskDevicePairing(
  input: KioskDevicePairingInput,
): Promise<KioskDevicePairingResult> {
  return postJson<KioskDevicePairingResult>("kiosk/devices/pairing", { input });
}

export async function revokeKioskDevice(id: string): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>("kiosk/devices/revoke", { id });
}

export async function createKioskSession(input: KioskSessionCreateInput): Promise<KioskSession> {
  return postJson<KioskSession>("kiosk/sessions/create", { input });
}

export async function listKioskSessions(
  options?: RepairDeskRequestOptions,
): Promise<KioskSession[]> {
  return requestJson<KioskSession[]>("kiosk/sessions", {}, options);
}

export async function acceptKioskSession(id: string): Promise<KioskSession> {
  return postJson<KioskSession>("kiosk/sessions/accept", { id });
}

export async function returnKioskSession(input: KioskSessionReturnInput): Promise<KioskSession> {
  return postJson<KioskSession>("kiosk/sessions/return", input);
}

export async function listStoreAccessRequests(
  options?: RepairDeskRequestOptions,
): Promise<OnboardingRequest[]> {
  return requestJson<OnboardingRequest[]>("stores/access-requests", {}, options);
}

export async function approveStoreAccessRequest(
  input: OnboardingDecisionInput,
): Promise<OnboardingRequest> {
  return postJson<OnboardingRequest>("stores/access-requests/approve", input);
}

export async function rejectStoreAccessRequest(
  input: OnboardingDecisionInput,
): Promise<OnboardingRequest> {
  return postJson<OnboardingRequest>("stores/access-requests/reject", input);
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

export async function updateStoreMemberRole(
  input: StoreMemberRoleUpdateInput,
): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/members/update-role", input);
}

export async function updateStoreMemberPermissions(
  input: StoreMemberPermissionUpdateInput,
): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/members/update-permissions", input);
}

export async function disableStoreMember(
  input: StoreMemberDecisionInput,
): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/members/disable", input);
}

export async function restoreStoreMember(
  input: StoreMemberDecisionInput,
): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/members/restore", input);
}

export async function createStoreInviteLink(
  input: StoreInviteLinkCreateInput,
): Promise<StoreInviteLinkCreateResult> {
  return postJson<StoreInviteLinkCreateResult>("stores/invite-links/create", { input });
}

export async function revokeStoreInviteLink(
  input: StoreInviteLinkDecisionInput,
): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/invite-links/revoke", input);
}

export async function redeemStoreInviteLink(
  input: StoreInviteLinkRedeemInput,
): Promise<StoreInvitation> {
  return postJson<StoreInvitation>("onboarding/invite-links/redeem", input);
}

export async function acceptStoreInvitation(
  input: StoreInvitationDecisionInput,
): Promise<StoreContext> {
  return postJson<StoreContext>("onboarding/invitations/accept", input);
}

export async function revokeStoreInvitation(
  input: StoreInvitationDecisionInput,
): Promise<StoreMembersResult> {
  return postJson<StoreMembersResult>("stores/invitations/revoke", input);
}

export async function updateStoreSettings(input: StoreSettingsUpdateInput): Promise<StoreSettings> {
  return postJson<StoreSettings>("settings/store/update", { input });
}

export async function listMessageTemplates(
  options?: RepairDeskRequestOptions,
): Promise<MessageTemplate[]> {
  return requestJson<MessageTemplate[]>("message-templates", {}, options);
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

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options: RepairDeskRequestOptions = {},
): Promise<T> {
  const response = await requestRaw(path, init, options);
  return readJsonResponse<T>(response);
}

async function requestRaw(
  path: string,
  init: RequestInit = {},
  options: RepairDeskRequestOptions = {},
  includeJsonContentType = true,
) {
  const { signal, timeoutMs = DEFAULT_REPAIRDESK_REQUEST_TIMEOUT_MS } = options;
  const controller = new AbortController();
  let didTimeout = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortRequest = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abortRequest();
  } else if (signal) {
    signal.addEventListener("abort", abortRequest, { once: true });
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(`/api/repairdesk/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(includeJsonContentType ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (didTimeout) {
      throw new Error("请求超时，请稍后重试");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortRequest);
  }

  return response;
}

async function readJsonResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) {
    throw new RepairDeskApiError(payload.error || `请求失败：${response.status}`, response.status);
  }
  return payload.data as T;
}

async function requestFile(path: string, body: unknown) {
  const response = await requestRaw(
    path,
    { method: "POST", body: JSON.stringify(body) },
    { timeoutMs: 60_000 },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new RepairDeskApiError(payload.error || `请求失败：${response.status}`, response.status);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const fallbackName = disposition.match(/filename="([^"]+)"/i)?.[1] ?? "repairdesk-data.xlsx";
  return {
    blob: await response.blob(),
    fileName: encodedName ? decodeURIComponent(encodedName) : fallbackName,
  };
}

function postJson<T>(path: string, body: unknown, options?: RepairDeskRequestOptions): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    options,
  );
}

export async function listOrders(
  filters: OrderListFilters = {},
  options?: RepairDeskRequestOptions,
): Promise<OrderListItem[]> {
  return postJson<OrderListItem[]>("orders/list", filters, options);
}

export async function listOrdersPage(
  input: OrderListPageInput = {},
  options?: RepairDeskRequestOptions,
): Promise<OrderListResult> {
  return postJson<OrderListResult>("orders/list-page", input, options);
}

export async function getOrderQueueSummary(
  input: OrderQueueSummaryInput = {},
  options?: RepairDeskRequestOptions,
): Promise<OrderQueueSummary> {
  return postJson<OrderQueueSummary>("orders/queue-summary", input, options);
}

export async function getOrderStats(options?: RepairDeskRequestOptions): Promise<OrderStats> {
  return requestJson<OrderStats>("order-stats", {}, options);
}

export async function getDashboardSummary(
  input: DashboardSummaryInput = {},
  options?: RepairDeskRequestOptions,
): Promise<DashboardSummary> {
  return postJson<DashboardSummary>("dashboard/summary", input, options);
}

export async function listOrderWorkflow(
  options?: RepairDeskRequestOptions,
): Promise<OrderWorkflow> {
  return requestJson<OrderWorkflow>("order-workflow", {}, options);
}

export async function createOrderWorkflowStatus(
  input: OrderWorkflowStatusCreateInput,
): Promise<OrderWorkflowStatus> {
  return postJson<OrderWorkflowStatus>("order-workflow/status/create", { input });
}

export async function updateOrderWorkflowStatus(
  id: string,
  input: OrderWorkflowStatusUpdateInput,
): Promise<OrderWorkflowStatus> {
  return postJson<OrderWorkflowStatus>("order-workflow/status/update", { id, input });
}

export async function reorderOrderWorkflowStatuses(
  input: OrderWorkflowStatusReorderInput,
): Promise<OrderWorkflow> {
  return postJson<OrderWorkflow>("order-workflow/status/reorder", input);
}

export async function setOrderWorkflowStatusEnabled(
  input: OrderWorkflowStatusEnabledInput,
): Promise<OrderWorkflowStatus> {
  return postJson<OrderWorkflowStatus>("order-workflow/status/enabled", input);
}

export async function updateOrderWorkflowTransitions(
  input: OrderWorkflowTransitionsUpdateInput,
): Promise<OrderWorkflow> {
  return postJson<OrderWorkflow>("order-workflow/transitions/update", input);
}

export async function getOrder(
  id: string,
  options?: RepairDeskRequestOptions,
): Promise<OrderDetail> {
  return postJson<OrderDetail>("order/get", { id }, options);
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
  expectedUpdatedAt?: string,
  idempotencyKey?: string,
): Promise<PaymentResult> {
  if (!idempotencyKey) throw new Error("缺少收款操作标识");
  return postJson<PaymentResult>("order/payment", {
    id,
    amount,
    method,
    expected_updated_at: expectedUpdatedAt,
    idempotency_key: idempotencyKey,
  });
}

export async function sendNotification(id: string, body: string, channel: "whatsapp" | "sms") {
  return postJson("order/notification", { id, body, channel });
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
  recipientPhone?: string,
): Promise<WhatsappNotificationResult> {
  return postJson<WhatsappNotificationResult>("order/whatsapp-notification", {
    id,
    body,
    template_kind: templateKind,
    transition_to: transitionTo,
    recipient_phone: recipientPhone,
  });
}

export async function sendApprovalRequest(id: string, body: string, recipientPhone?: string) {
  return postJson("order/approval-request", { id, body, recipient_phone: recipientPhone });
}

export async function decideOrderApproval(
  id: string,
  input: OrderApprovalDecisionInput,
): Promise<OrderApprovalDecisionResult> {
  return postJson<OrderApprovalDecisionResult>("order/approval-decision", { id, input });
}

export async function uploadOrderAttachment(
  id: string,
  input: OrderAttachmentUploadInput,
): Promise<OrderAttachmentUploadResult> {
  return postJson<OrderAttachmentUploadResult>("order/attachment/upload", { id, input });
}

export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  return postJson<Customer[]>("customers/search", { q, limit });
}

export async function searchCustomerIntakeCandidates(
  q: string,
  limit = 6,
  deviceLimit = 4,
): Promise<CustomerIntakeCandidate[]> {
  return postJson<CustomerIntakeCandidate[]>("customers/intake-search", {
    q,
    limit,
    deviceLimit,
  });
}

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  return postJson<Device[]>("customers/devices", { customerId });
}

export async function listCustomers(
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  return postJson<CustomerListResult>("customers/list", filters);
}

export async function listCustomersPage(
  input: CustomerListPageInput = {},
  options?: RepairDeskRequestOptions,
): Promise<CustomerListPageResult> {
  return postJson<CustomerListPageResult>("customers/list-page", input, options);
}

export async function getCustomerDetail(
  id: string,
  options?: RepairDeskRequestOptions,
): Promise<CustomerDetail> {
  return postJson<CustomerDetail>("customer/get", { id }, options);
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

export async function getRepairDeskOptions(
  options?: RepairDeskRequestOptions,
): Promise<RepairDeskOptions> {
  return requestJson<RepairDeskOptions>("options", {}, options);
}
