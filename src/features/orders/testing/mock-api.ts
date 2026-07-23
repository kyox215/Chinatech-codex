import { CURRENCY_CODE, normalizePositiveCentAmount } from "@/lib/money";
import type {
  AuditActor,
  CorrectTerminalOrderInput,
  CreateOrderInput,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderTerminalOperationResult,
  OrderApprovalDecisionInput,
  OrderApprovalDecisionResult,
  OrderAttachment,
  OrderAttachmentUploadInput,
  OrderAttachmentUploadResult,
  OrderWorkflow,
  OrderWorkflowStatus,
  OrderWorkflowStatusCode,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusEnabledInput,
  OrderWorkflowStatusReorderInput,
  OrderWorkflowStatusUpdateInput,
  OrderWorkflowTransition,
  OrderWorkflowTransitionsUpdateInput,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  PublishOrderQuoteInput,
  PublishOrderQuoteResult,
  ConfirmOrderQuoteSentInput,
  ConfirmOrderQuoteSentResult,
  PaymentResult,
  RepairOrder,
  ReopenOrderInput,
  UpdateOrderCustodyInput,
  UpdateOrderInput,
  VoidOrderInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";
import { repairOrderStatus, statusMeta, type RepairOrderStatus } from "@/lib/mock/enums";
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import { classifyOrderSearchQuery } from "@/features/orders/model/order-search-query";
import { normalizeDeviceUnlockInput } from "@/features/orders/model/device-unlock";
import {
  DEVICE_CUSTODY_WITH_CUSTOMER,
  DEVICE_CUSTODY_WITH_SHOP,
  deviceCustodyAllowsChange,
  deviceCustodyBlocksStatus,
  normalizeUnlockForCustody,
} from "@/features/orders/model/device-custody";
import { isOrderArchivedForQueue } from "@/features/orders/model/order-list-visibility";
import {
  deriveOrderFinancialState,
  isOrderCancelled,
  isOrderCancelledState,
  isOrderCancelledForPayment,
  isOrderPaymentCollectible,
} from "@/features/orders/model/order-payment-state";
import { deviceLabelMatchesSearch, hasOrderAmountAnomaly } from "@/entities/order";
import {
  countOrderQueueGroups,
  getOrderQueueGroup,
} from "@/features/orders/model/order-queue-classification";
import {
  compareOrdersForQueue,
  countOrderResultGroups,
} from "@/features/orders/model/order-list-grouping";
import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  DEFAULT_ORDER_WORKFLOW_TRANSITIONS,
  isApprovalOverdue,
  isPickupOverdue,
} from "@/lib/mock/workflow";
import {
  customers,
  decorate,
  devices,
  extraEvents,
  extraMessages,
  getCustomer,
  getDevice,
  getEvents,
  getMessages,
  getSupplier,
  orders,
} from "@/lib/mock/state";
import { getMockSupplier } from "@/features/suppliers/testing/mock-api";
import { normalizeOrderTagInput } from "@/features/orders/model/order-tags";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";
import { isRepairDeskE2eSystemActor } from "@/shared/lib/e2e-auth-bypass";
import {
  approvalFlowStatusFromLegacyStatus,
  notifyStatusFromLegacyStatus,
  orderWorkflowStatuses,
  partsStatusFromLegacyStatus,
  paymentStatusFromMoney,
  workflowStatusFromLegacyStatus,
} from "@/features/orders/model/canonical-order-status";
import {
  formatWarrantyText,
  normalizeWarrantyPayload,
  parseWarrantyMonths,
  warrantyReasonRequired,
} from "@/features/orders/model/order-warranty";

type MockOperator = string | AuditActor;

function operatorName(operator: MockOperator = "前台") {
  return typeof operator === "string" ? operator : operator.displayName;
}

function mockOrderWorkflowBucket(order: Pick<RepairOrder, "status">) {
  return workflowStatuses.find((status) => status.code === order.status)?.bucket;
}

function isMockTerminalOrder(
  order: Pick<RepairOrder, "status" | "exception_status" | "workflow_status">,
) {
  const workflowBucket = mockOrderWorkflowBucket(order);
  return (
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.exception_status === "cancelled" ||
    workflowBucket === "done" ||
    workflowBucket === "cancelled" ||
    (workflowBucket === undefined && order.workflow_status === "closed")
  );
}

function assertMockOrderNotVoided(order: Pick<RepairOrder, "record_state" | "deleted_at">) {
  if (order.record_state === "voided" || order.deleted_at) {
    throw new Error("该工单记录已作废，只能查看历史证据");
  }
}

function assertMockOrderInActorScope(order: RepairOrder, actor?: AuditActor) {
  const role = actor?.storeRole ?? actor?.role;
  if (!actor || actor.isSystem || role !== "technician") return;
  if (!actor.activeMembershipId || order.assignee_membership_id !== actor.activeMembershipId) {
    throw new ForbiddenError("当前工单未分配给你");
  }
}

function assertMockRoutineMutationAllowed(order: RepairOrder) {
  const workflowBucket = mockOrderWorkflowBucket(order);
  assertMockOrderNotVoided(order);
  if (
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.exception_status === "cancelled" ||
    workflowBucket === "done" ||
    workflowBucket === "cancelled" ||
    (workflowBucket === undefined && order.workflow_status === "closed")
  ) {
    throw new Error("已结束工单必须使用审计化纠正或重新打开操作");
  }
}

// Keep the default order fixtures in the same tenant as the default store
// context used by local E2E auth bypass.
const mockStoreId = "00000000-0000-0000-0000-000000000001";
let extraAttachments: OrderAttachment[] = [];
const paymentOperations = new Map<string, { fingerprint: string; result: PaymentResult }>();
const terminalOperations = new Map<
  string,
  { fingerprint: string; result: OrderTerminalOperationResult }
>();
let workflowStatuses: OrderWorkflowStatus[] = repairOrderStatus.map((code, index) => ({
  id: `mock-status-${code}`,
  store_id: mockStoreId,
  code,
  label: statusMeta[code]?.label ?? code,
  short_label: statusMeta[code]?.shortLabel ?? statusMeta[code]?.label ?? code,
  tone: statusMeta[code]?.tone ?? "neutral",
  bucket:
    code === "cancelled"
      ? "cancelled"
      : code === "completed"
        ? "done"
        : ["repaired", "notified", "waiting_pickup", "unfixed_pickup"].includes(code)
          ? "pickup"
          : ["parts_ordered", "parts_arrived"].includes(code)
            ? "parts"
            : ["mail_in_progress", "repairing"].includes(code)
              ? "repair"
              : ["quoted", "waiting_approval"].includes(code)
                ? "quote"
                : code === "diagnosing"
                  ? "diagnosing"
                  : "intake",
  sort_order: (index + 1) * 10,
  enabled: true,
  show_in_order_filters: ["new", "rework", "mail_in_progress", "diagnosing"].includes(code),
  allowed_for_create: ORDER_STATUS_ALLOWED_FOR_CREATE.includes(code),
  is_default_create_status: code === "new",
  is_system: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}));

let workflowTransitions: OrderWorkflowTransition[] = Object.entries(
  DEFAULT_ORDER_WORKFLOW_TRANSITIONS,
).flatMap(([from, targets]) =>
  targets.map((to, index) => ({
    id: `mock-transition-${from}-${to}`,
    store_id: mockStoreId,
    from_status_code: from,
    to_status_code: to,
    is_primary: index === 0,
    sort_order: (index + 1) * 10,
    enabled: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  })),
);

function cloneWorkflow(storeId = mockStoreId): OrderWorkflow {
  return {
    statuses: workflowStatuses.map((status) => ({ ...status, store_id: storeId })),
    transitions: workflowTransitions.map((transition) => ({ ...transition, store_id: storeId })),
  };
}

function validateMockManualTransitionTarget(from: RepairOrderStatus, to: RepairOrderStatus) {
  if (from === to) return { ok: false, reason: "目标状态与当前一致" };
  const targetStatus = workflowStatuses.find((status) => status.code === to);
  if (!targetStatus) return { ok: false, reason: "目标状态不存在" };
  if (!targetStatus.enabled) {
    return { ok: false, reason: `「${targetStatus.label}」已停用，不能流转到该状态` };
  }
  if (targetStatus.bucket === "custom") {
    return {
      ok: false,
      reason: "自定义状态尚未绑定主流程阶段，当前不能用于工单流转",
    };
  }
  return { ok: true, label: targetStatus.label };
}

function mergeContactPhones(existing: string[], incoming: string[], primaryRaw: string) {
  const result: string[] = [];
  const seen = new Set<string>(primaryRaw ? [primaryRaw] : []);
  for (const phone of [...existing, ...incoming]) {
    const raw = normalizePhoneRaw(phone);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    result.push(phone.trim());
  }
  return result;
}

function assertCustomerPhoneAvailable(
  customerId: string,
  primaryRaw: string,
  contactPhones: string[],
) {
  const raws = new Set([
    primaryRaw,
    ...contactPhones.map((phone) => normalizePhoneRaw(phone)).filter(Boolean),
  ]);
  const conflicts = customers.filter(
    (customer) => customer.id !== customerId && raws.has(customer.phone_raw),
  );
  if (conflicts.length === 0) return;
  if (conflicts.some((customer) => customer.phone_raw === primaryRaw)) {
    throw new Error("该手机号已存在客户档案");
  }
  throw new Error("备用号码已属于其他客户档案，请先确认客户资料");
}

function mockId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createWorkflowCounts(): Record<OrderWorkflowStatusCode | "all", number> {
  return {
    all: 0,
    intake: 0,
    diagnosis: 0,
    quote: 0,
    parts: 0,
    repair: 0,
    pickup: 0,
    closed: 0,
  };
}

function countWorkflowRows(rows: OrderListItem[]) {
  const counts = createWorkflowCounts();
  for (const row of rows) {
    const workflowStatus = row.workflow_status ?? workflowStatusFromLegacyStatus(row.status);
    counts.all += 1;
    counts[workflowStatus] += 1;
  }
  return counts;
}

function filtersForWorkflowCounts(filters: OrderListFilters): OrderListFilters {
  return { ...filters, workflowStatuses: undefined };
}

function filtersForQueueCounts(filters: OrderListFilters): OrderListFilters {
  return { ...filters, queueGroups: undefined };
}

function redactOrderListSecrets(order: OrderListItem): OrderListItem {
  const safeOrder = { ...order };
  delete safeOrder.device_unlock_value;
  delete safeOrder.device_unlock_pattern;
  return safeOrder;
}

export async function listOrders(
  filters: OrderListFilters = {},
  actor?: AuditActor,
): Promise<OrderListItem[]> {
  if (
    filters.financialReview &&
    !can(actor, "finance:aggregate_read") &&
    !isRepairDeskE2eSystemActor(actor)
  ) {
    throw new ForbiddenError("当前角色无权查看整店金额复核结果");
  }
  let result = orders.map(decorate);
  const q = filters.search?.trim().toLowerCase();
  const view = filters.searchScope === "archive_exact" ? "all" : (filters.view ?? "active");
  if (view === "active") result = result.filter((order) => !isOrderArchivedForQueue(order));
  if (view === "archive") result = result.filter(isOrderArchivedForQueue);
  if (q) {
    const phoneQuery = classifyOrderSearchQuery(q) === "phone";
    result = result.filter((o) => {
      if (filters.searchScope === "archive_exact" && isOrderArchivedForQueue(o)) {
        const normalizedPhone = normalizePhoneRaw(q);
        return (
          o.public_no.toLowerCase() === q ||
          o.device_imei.toLowerCase() === q ||
          (phoneQuery &&
            [o.customer_phone, ...o.contact_phones].some(
              (phone) => normalizePhoneRaw(phone) === normalizedPhone,
            ))
        );
      }
      return (
        o.public_no.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (phoneQuery && phoneMatches(o.customer_phone, q)) ||
        (phoneQuery && o.contact_phones.some((phone) => phoneMatches(phone, q))) ||
        o.device_imei.toLowerCase().includes(q) ||
        o.device_label.toLowerCase().includes(q)
      );
    });
  }
  const deviceSearch = filters.deviceSearch?.trim();
  if (deviceSearch) {
    result = result.filter((order) => deviceLabelMatchesSearch(order.device_label, deviceSearch));
  }
  if (filters.statuses?.length) {
    result = result.filter((o) => filters.statuses!.includes(o.status));
  }
  if (filters.workflowStatuses?.length) {
    result = result.filter((o) =>
      filters.workflowStatuses!.includes(
        o.workflow_status ?? workflowStatusFromLegacyStatus(o.status),
      ),
    );
  }
  if (filters.queueGroups?.length) {
    result = result.filter(
      (o) => !isOrderArchivedForQueue(o) && filters.queueGroups!.includes(getOrderQueueGroup(o)),
    );
  }
  if (filters.exceptionStatuses?.length) {
    result = result.filter(
      (o) => o.exception_status && filters.exceptionStatuses!.includes(o.exception_status),
    );
  }
  if (filters.paymentStatuses?.length) {
    result = result.filter(
      (o) =>
        !isOrderCancelledForPayment(o) &&
        o.payment_status &&
        filters.paymentStatuses!.includes(o.payment_status),
    );
  }
  if (filters.partsStatuses?.length) {
    result = result.filter(
      (o) => o.parts_status && filters.partsStatuses!.includes(o.parts_status),
    );
  }
  if (filters.approvalFlowStatuses?.length) {
    result = result.filter(
      (o) =>
        o.approval_flow_status && filters.approvalFlowStatuses!.includes(o.approval_flow_status),
    );
  }
  if (filters.types?.length) {
    result = result.filter((o) => filters.types!.includes(o.order_type));
  }
  if (filters.technicians?.length) {
    result = result.filter((o) => filters.technicians!.includes(o.technician_name));
  }
  if (filters.supplierIds?.length) {
    result = result.filter((o) => o.supplier_id && filters.supplierIds!.includes(o.supplier_id));
  }
  if (filters.paid && filters.paid !== "all") {
    result = result.filter((o) => {
      const financialState = deriveOrderFinancialState(o);
      return filters.paid === "paid"
        ? financialState.settlement === "settled" || financialState.settlement === "zero_charge"
        : financialState.collectible;
    });
  }
  if (filters.overdue) {
    result = result.filter(
      (o) =>
        !isOrderCancelledForPayment(o) &&
        (filters.overdue === "approval"
          ? o.approval_overdue
          : filters.overdue === "pickup"
            ? o.pickup_overdue
            : o.approval_overdue || o.pickup_overdue),
    );
  }
  if (filters.financialReview === "amount_anomaly") {
    result = result.filter((order) =>
      hasOrderAmountAnomaly({
        quotationAmount: order.quotation_amount,
        depositAmount: order.deposit_amount,
        balanceAmount: order.balance_amount,
        isPaid: order.is_paid,
        paymentStatus: order.payment_status,
      }),
    );
  }
  return result.sort(compareOrdersForQueue).map(redactOrderListSecrets);
}

export async function listOrdersPage(
  input: OrderListPageInput = {},
  actor?: AuditActor,
): Promise<OrderListResult> {
  const page = Math.max(1, Math.floor(Number(input.page ?? 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
  const all = await listOrders(input, actor);
  const workflowCounts = countWorkflowRows(
    await listOrders(filtersForWorkflowCounts(input), actor),
  );
  const queueCounts = countOrderQueueGroups(await listOrders(filtersForQueueCounts(input), actor));
  const resultGroupCounts = countOrderResultGroups(all);
  const start = (page - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    total: all.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
    workflowCounts,
    queueCounts,
    resultGroupCounts,
  };
}

// Used to compute KPIs without re-running filters on the same dataset.
export async function getOrderStats(_actor?: AuditActor) {
  const activeOrders = orders.filter((order) => !isOrderArchivedForQueue(order));
  return {
    total: activeOrders.length,
    today: activeOrders.filter(
      (o) => new Date(o.created_at).toDateString() === new Date().toDateString(),
    ).length,
    inProgress: activeOrders.filter((o) =>
      [
        "new",
        "rework",
        "mail_in_progress",
        "diagnosing",
        "quoted",
        "parts_ordered",
        "parts_arrived",
        "repairing",
      ].includes(o.status),
    ).length,
    unpaid: activeOrders.filter((o) => deriveOrderFinancialState(o).collectible).length,
    approvalOverdue: activeOrders.filter(isApprovalOverdue).length,
    pickupOverdue: activeOrders.filter(isPickupOverdue).length,
  };
}

export async function listOrderWorkflow(actor?: AuditActor): Promise<OrderWorkflow> {
  return cloneWorkflow(actor?.storeId);
}

export async function createOrderWorkflowStatus(
  input: OrderWorkflowStatusCreateInput,
  _actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  const code = input.code.trim().toLowerCase();
  if (workflowStatuses.some((status) => status.code === code)) throw new Error("状态代码已存在");
  const now = new Date().toISOString();
  if (input.is_default_create_status) {
    workflowStatuses = workflowStatuses.map((status) => ({
      ...status,
      is_default_create_status: false,
    }));
  }
  const label = input.label.trim();
  const status: OrderWorkflowStatus = {
    id: crypto.randomUUID(),
    store_id: mockStoreId,
    code,
    label,
    short_label: input.short_label?.trim() || label.slice(0, 4),
    tone: input.tone,
    bucket: input.bucket,
    sort_order:
      input.sort_order ?? Math.max(0, ...workflowStatuses.map((item) => item.sort_order)) + 10,
    enabled: input.is_default_create_status ? true : (input.enabled ?? true),
    show_in_order_filters: input.show_in_order_filters ?? true,
    allowed_for_create: input.is_default_create_status ? true : (input.allowed_for_create ?? false),
    is_default_create_status: Boolean(input.is_default_create_status),
    is_system: false,
    created_at: now,
    updated_at: now,
  };
  workflowStatuses = [...workflowStatuses, status].sort((a, b) => a.sort_order - b.sort_order);
  return { ...status };
}

export async function updateOrderWorkflowStatus(
  id: string,
  input: OrderWorkflowStatusUpdateInput,
  _actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  const current = workflowStatuses.find((status) => status.id === id);
  if (!current) throw new Error("状态不存在");
  if (current.is_default_create_status && input.enabled === false) {
    throw new Error("默认新建状态不能停用");
  }
  if (current.is_default_create_status && input.is_default_create_status === false) {
    throw new Error("请先把另一个状态设为默认新建状态");
  }
  if (input.is_default_create_status) {
    workflowStatuses = workflowStatuses.map((status) => ({
      ...status,
      is_default_create_status: false,
    }));
  }
  const now = new Date().toISOString();
  workflowStatuses = workflowStatuses.map((status) =>
    status.id === id
      ? {
          ...status,
          ...input,
          enabled: input.is_default_create_status ? true : (input.enabled ?? status.enabled),
          allowed_for_create: input.is_default_create_status
            ? true
            : (input.allowed_for_create ?? status.allowed_for_create),
          is_default_create_status:
            input.is_default_create_status ?? status.is_default_create_status,
          updated_at: now,
        }
      : status,
  );
  return { ...workflowStatuses.find((status) => status.id === id)! };
}

export async function reorderOrderWorkflowStatuses(
  input: OrderWorkflowStatusReorderInput,
  _actor?: AuditActor,
): Promise<OrderWorkflow> {
  const orderById = new Map(input.items.map((item) => [item.id, item.sort_order]));
  workflowStatuses = workflowStatuses
    .map((status) => ({
      ...status,
      sort_order: orderById.get(status.id) ?? status.sort_order,
      updated_at: orderById.has(status.id) ? new Date().toISOString() : status.updated_at,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
  return cloneWorkflow();
}

export async function setOrderWorkflowStatusEnabled(
  input: OrderWorkflowStatusEnabledInput,
  actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  return updateOrderWorkflowStatus(input.id, { enabled: input.enabled }, actor);
}

export async function updateOrderWorkflowTransitions(
  input: OrderWorkflowTransitionsUpdateInput,
  _actor?: AuditActor,
): Promise<OrderWorkflow> {
  const from = workflowStatuses.find((status) => status.code === input.from_status_code);
  if (!from) throw new Error("来源状态不存在");
  const byTarget = new Map(input.transitions.map((item) => [item.to_status_code, item]));
  const targets = workflowStatuses
    .filter((status) => status.code !== from.code)
    .map((status, index) => ({
      to_status_code: status.code,
      enabled: Boolean(byTarget.get(status.code)?.enabled),
      is_primary: Boolean(
        byTarget.get(status.code)?.enabled && byTarget.get(status.code)?.is_primary,
      ),
      sort_order: byTarget.get(status.code)?.sort_order ?? (index + 1) * 10,
    }));
  const primaryIndex = targets.findIndex((target) => target.enabled && target.is_primary);
  const firstEnabledIndex = targets.findIndex((target) => target.enabled);
  const now = new Date().toISOString();
  workflowTransitions = workflowTransitions.filter(
    (transition) => transition.from_status_code !== from.code,
  );
  workflowTransitions = [
    ...workflowTransitions,
    ...targets.map((target, index) => ({
      id: `mock-transition-${from.code}-${target.to_status_code}`,
      store_id: mockStoreId,
      from_status_code: from.code,
      to_status_code: target.to_status_code,
      enabled: target.enabled,
      is_primary:
        target.enabled &&
        (primaryIndex >= 0 ? index === primaryIndex : index === firstEnabledIndex),
      sort_order: target.sort_order,
      created_at: now,
      updated_at: now,
    })),
  ];
  return cloneWorkflow();
}

// GET /api/orders/[id]
export async function getOrder(id: string, _actor?: AuditActor) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockOrderInActorScope(o, _actor);
  const workflowBucket = mockOrderWorkflowBucket(o);
  const latestQuoteEvent = extraEvents.find(
    (event) =>
      event.order_id === o.id &&
      event.event_type === "quoted" &&
      event.payload.action === "quote_published",
  );
  const orderView = { ...decorate(o), workflow_bucket: workflowBucket };
  const terminal = isMockTerminalOrder(o);
  const voided = o.record_state === "voided" || Boolean(o.deleted_at);
  const hasFinancialEvidence =
    o.is_paid || o.deposit_amount > 0 || o.quotation_amount > o.balance_amount;
  const role = _actor?.storeRole ?? _actor?.role;
  const kioskScopeSatisfied =
    role === "technician" &&
    Boolean(_actor?.activeMembershipId && o.assignee_membership_id === _actor.activeMembershipId);
  return {
    order: orderView,
    customer: getCustomer(o.customer_id),
    device: getDevice(o.device_id),
    supplier: getSupplier(o.supplier_id),
    parts_supplier: getMockSupplier(o.parts_supplier_id, { includeArchived: true }),
    events: [...extraEvents.filter((event) => event.order_id === o.id), ...getEvents(o.id)].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    messages: [
      ...extraMessages.filter((message) => message.order_id === o.id),
      ...getMessages(o.id),
    ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
    attachments: extraAttachments
      .filter((attachment) => attachment.order_id === o.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    latest_quote_event_id: latestQuoteEvent?.id,
    latest_quote_published_at: latestQuoteEvent?.created_at,
    capabilities: {
      canEditIntake: !terminal && !voided,
      canEditRepair: !terminal && !voided,
      canAdjustFinance: !terminal && !voided,
      canPrepareQuote:
        !terminal && !voided && (!_actor || _actor.isSystem || can(_actor, "order:quote_prepare")),
      canSendQuote:
        !terminal &&
        !voided &&
        (!_actor ||
          _actor.isSystem ||
          (can(_actor, "order:quote_prepare") && can(_actor, "customer:message"))),
      canCollectPayment: isOrderPaymentCollectible(orderView),
      canTransition: !terminal && !voided,
      canConfirmCancelledReturn:
        !voided &&
        isOrderCancelledState(orderView) &&
        o.device_custody_status === DEVICE_CUSTODY_WITH_SHOP &&
        !o.delivered_at,
      canCreateKioskSession:
        !voided &&
        (!_actor ||
          _actor.isSystem ||
          can(_actor, "order:update_intake", { scopeSatisfied: kioskScopeSatisfied })),
      canCorrect: terminal && !voided,
      canReopen: terminal && !voided,
      canVoid: terminal && !voided && !hasFinancialEvidence,
      canReadInternalCosts:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        (!_actor ||
          _actor.isSystem ||
          can(_actor, "finance:profit_read") ||
          can(_actor, "finance:cost_manage")),
      canManageInternalCosts:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        (!_actor || _actor.isSystem || can(_actor, "finance:cost_manage")),
      canAllocatePartsCosts:
        process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1" &&
        process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED === "1" &&
        (!_actor || _actor.isSystem || can(_actor, "inventory:cost_allocate")),
      blockedReasons: hasFinancialEvidence
        ? { void: "存在收款或定金证据，必须先完成财务冲销/退款" }
        : {},
    },
  };
}

export async function uploadOrderAttachment(
  id: string,
  input: OrderAttachmentUploadInput,
  actor?: AuditActor,
): Promise<OrderAttachmentUploadResult> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  if (input.file_size > 8 * 1024 * 1024) throw new Error("附件不能超过 8MB");
  if (!input.mime_type.startsWith("image/") && input.mime_type !== "application/pdf") {
    throw new Error("仅支持图片或 PDF");
  }

  const now = new Date().toISOString();
  const attachment: OrderAttachment = {
    id: mockId("att"),
    store_id: mockStoreId,
    order_id: id,
    kind: input.kind,
    file_name: input.file_name,
    mime_type: input.mime_type,
    file_size: input.file_size,
    storage_bucket: "mock-order-attachments",
    storage_path: `${mockStoreId}/${id}/${input.file_name}`,
    signed_url: `data:${input.mime_type};base64,${input.data_base64}`,
    note: input.note,
    uploaded_by: operatorName(actor) || "前台",
    created_at: now,
    updated_at: now,
  };

  extraAttachments = [attachment, ...extraAttachments];
  extraEvents.unshift({
    id: mockId("evt"),
    order_id: id,
    event_type: "note",
    payload: {
      action: "attachment_uploaded",
      attachment_id: attachment.id,
      kind: attachment.kind,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      file_size: attachment.file_size,
    },
    operator_name: attachment.uploaded_by || "前台",
    created_at: now,
  });

  return { attachment };
}

function isApprovalDecisionBypass(
  from: RepairOrderStatus,
  to: RepairOrderStatus,
  approvalStatus?: string,
  approvalFlowStatus?: string,
) {
  if (to === "waiting_approval") return false;
  if (from === "waiting_approval" && approvalFlowStatus !== "approved") return true;
  return from === "quoted" && approvalStatus === "pending";
}

function mockFaultPriceSignature(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return JSON.stringify(
    rows.map((raw) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return {
        name: String(item.name ?? "").trim(),
        price: Number(item.price) || 0,
        note: String(item.note ?? "").trim(),
        currency_code: String(item.currency_code ?? CURRENCY_CODE),
      };
    }),
  );
}

function shouldResetMockQuoteApproval(
  order: RepairOrder,
  nextFaults: unknown[],
  quotation: number,
  deposit: number,
  balance: number,
) {
  const quoteChanged =
    order.quotation_amount !== quotation ||
    order.deposit_amount !== deposit ||
    order.balance_amount !== balance ||
    mockFaultPriceSignature(order.fault_prices) !== mockFaultPriceSignature(nextFaults);
  const approvalWasTouched =
    order.approval_status === "approved" ||
    order.approval_status === "rejected" ||
    order.approval_flow_status === "waiting_customer" ||
    Boolean(order.approval_sent_at) ||
    Boolean(order.approval_confirmed_at);
  return quoteChanged && approvalWasTouched;
}

const quoteReapprovalReopenStatuses = new Set([
  "parts_ordered",
  "parts_arrived",
  "repairing",
  "repaired",
  "notified",
  "waiting_pickup",
]);

function resetMockQuoteApproval(order: RepairOrder) {
  if (quoteReapprovalReopenStatuses.has(order.status)) {
    order.status = "quoted";
    order.workflow_status = workflowStatusFromLegacyStatus("quoted");
    order.exception_status = undefined;
    order.parts_status = partsStatusFromLegacyStatus("quoted");
    order.notify_status = notifyStatusFromLegacyStatus("quoted");
  }
  order.approval_status = "pending";
  order.approval_flow_status = approvalFlowStatusFromLegacyStatus(order.status, "pending");
  order.approval_sent_at = undefined;
  order.approval_confirmed_at = undefined;
}

export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: {
    reason?: string;
    expectedUpdatedAt?: string;
    idempotencyKey?: string;
    operator?: MockOperator;
    storeId?: string;
  } = {},
) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockRoutineMutationAllowed(o);
  if (
    opts.idempotencyKey &&
    extraEvents.some((event) => event.payload.idempotency_key === opts.idempotencyKey)
  ) {
    return { ok: true, from: o.status, to: o.status };
  }
  if (opts.expectedUpdatedAt && o.updated_at !== opts.expectedUpdatedAt) {
    throw new Error("工单已被更新，请刷新后再试");
  }
  const canonicalRequest = orderWorkflowStatuses.includes(to as never);
  if (canonicalRequest) {
    throw new Error("状态流转必须使用具体工单状态，不能使用主流程分组");
  }
  const workflowFrom = o.workflow_status ?? workflowStatusFromLegacyStatus(o.status);
  const workflowTo = workflowStatusFromLegacyStatus(to);
  const legacyTo = to;
  const cleanReason = opts.reason?.trim();
  const targetDefinition = workflowStatuses.find((status) => status.code === legacyTo);
  const requiresPhysicalCustody =
    deviceCustodyBlocksStatus(legacyTo) ||
    targetDefinition?.bucket === "diagnosing" ||
    targetDefinition?.bucket === "repair" ||
    targetDefinition?.bucket === "pickup";
  if (
    !o.device_custody_status &&
    (requiresPhysicalCustody || legacyTo === "completed" || legacyTo === "cancelled")
  ) {
    throw new Error("请先确认设备是留在门店还是由客户带走，再进行此状态流转");
  }
  if (o.device_custody_status !== DEVICE_CUSTODY_WITH_SHOP && requiresPhysicalCustody) {
    throw new Error("设备当前未留店，不能进入诊断、维修或待取机状态");
  }
  const target = validateMockManualTransitionTarget(o.status, legacyTo);
  if (!target.ok) throw new Error(target.reason ?? "状态流转不合法");
  if (isApprovalDecisionBypass(o.status, legacyTo, o.approval_status, o.approval_flow_status)) {
    throw new Error("客户审批阶段必须通过审批处理记录同意或拒绝");
  }
  if (orderTransitionRequiresReason(legacyTo) && !cleanReason) {
    const label = workflowStatuses.find((status) => status.code === legacyTo)?.label ?? legacyTo;
    throw new Error(`流转到「${label}」需要填写原因`);
  }
  const from = o.status;
  const now = new Date().toISOString();
  const custodyBefore = o.device_custody_status;
  const deliveredBefore = o.delivered_at;
  o.status = legacyTo;
  o.workflow_status = workflowTo;
  o.exception_status =
    legacyTo === "cancelled"
      ? "cancelled"
      : legacyTo === "rework"
        ? "rework"
        : legacyTo === "unfixed_pickup"
          ? "returned_unfixed"
          : undefined;
  o.approval_flow_status = approvalFlowStatusFromLegacyStatus(legacyTo);
  o.parts_status = partsStatusFromLegacyStatus(legacyTo);
  o.notify_status = notifyStatusFromLegacyStatus(legacyTo);
  o.updated_at = now;
  if (legacyTo !== "completed" && legacyTo !== "cancelled") {
    o.completed_at = undefined;
    o.delivered_at = undefined;
  }
  if (legacyTo === "cancelled") o.cancel_reason = cleanReason || "未填写";
  if (legacyTo === "unfixed_pickup" && cleanReason) {
    o.diagnosis_result = buildMockTransitionDiagnosisResult(o.diagnosis_result, cleanReason);
  }
  if (legacyTo === "completed") {
    o.completed_at = o.updated_at;
    o.delivered_at = custodyBefore === DEVICE_CUSTODY_WITH_SHOP ? o.updated_at : deliveredBefore;
    o.device_custody_status = DEVICE_CUSTODY_WITH_CUSTOMER;
  }
  if (legacyTo === "waiting_approval") o.approval_sent_at = o.updated_at;
  extraEvents.unshift({
    id: `evt_status_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "status_changed",
    payload: {
      from,
      to: legacyTo,
      workflow_from: workflowFrom,
      workflow_to: workflowTo,
      reason: cleanReason,
      ...(legacyTo === "completed"
        ? {
            handover_confirmed: Boolean(o.delivered_at),
            custody_from: custodyBefore,
            custody_to: DEVICE_CUSTODY_WITH_CUSTOMER,
            custody_outcome: o.delivered_at ? "delivered" : "never_received",
          }
        : legacyTo === "cancelled"
          ? {
              custody_to: o.device_custody_status,
              custody_outcome:
                o.device_custody_status === DEVICE_CUSTODY_WITH_CUSTOMER
                  ? o.delivered_at
                    ? "returned"
                    : "never_received"
                  : "awaiting_return",
            }
          : {}),
      idempotency_key: opts.idempotencyKey,
    },
    operator_name: operatorName(opts.operator),
    created_at: now,
  });
  return { ok: true, from, to: legacyTo };
}

export async function confirmCancelledOrderReturn(
  id: string,
  opts: { expectedUpdatedAt: string; idempotencyKey: string; operator?: MockOperator },
) {
  const order = orders.find((item) => item.id === id);
  if (!order) throw new Error("工单不存在");
  const workflowBucket = mockOrderWorkflowBucket(order);
  if (!isOrderCancelled(order) && workflowBucket !== "cancelled") {
    throw new Error("只有已取消工单可以确认设备退还");
  }
  if (order.record_state === "voided" || order.deleted_at) {
    throw new Error("该工单记录已作废，只能查看历史证据");
  }
  if (!opts.idempotencyKey) throw new Error("缺少退还操作标识");
  const existingEvent = extraEvents.find(
    (event) => event.payload.idempotency_key === opts.idempotencyKey,
  );
  if (existingEvent && order.delivered_at) {
    return { ok: true, alreadyConfirmed: true, delivered_at: order.delivered_at };
  }
  if (!order.device_custody_status) throw new Error("请先确认设备保管状态，再登记退还");
  if (order.delivered_at) {
    return { ok: true, alreadyConfirmed: true, delivered_at: order.delivered_at };
  }
  if (order.device_custody_status === DEVICE_CUSTODY_WITH_CUSTOMER) {
    throw new Error("设备未由门店保管，无需确认退还");
  }
  if (order.updated_at !== opts.expectedUpdatedAt) throw new Error("工单已被更新，请刷新后再试");

  const now = new Date().toISOString();
  order.completed_at = order.completed_at ?? now;
  order.delivered_at = now;
  order.device_custody_status = DEVICE_CUSTODY_WITH_CUSTOMER;
  order.updated_at = now;
  extraEvents.unshift({
    id: `evt_return_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "status_changed",
    payload: {
      from: "cancelled",
      to: "cancelled",
      action: "custody_return_confirmed",
      handover_confirmed: true,
      custody_outcome: "returned",
      idempotency_key: opts.idempotencyKey,
    },
    operator_name: operatorName(opts.operator),
    created_at: now,
  });
  return { ok: true, alreadyConfirmed: false, delivered_at: now };
}

export async function updateOrderCustody(
  id: string,
  input: UpdateOrderCustodyInput,
  operator: MockOperator = "前台",
): Promise<PatchOrderResult> {
  const order = orders.find((item) => item.id === id);
  if (!order) throw new Error("工单不存在");
  const existingEvent = extraEvents.find(
    (event) => event.payload.idempotency_key === input.idempotency_key,
  );
  if (existingEvent) {
    if (existingEvent.order_id !== id || existingEvent.payload.to !== input.device_custody_status) {
      throw new Error("该操作标识已用于不同请求，请刷新后重试");
    }
    return { ok: true, updated_at: existingEvent.created_at };
  }

  const from = order.device_custody_status;
  const to = input.device_custody_status;
  const reason = input.reason?.trim();
  if (from === to) return { ok: true, updated_at: order.updated_at };
  if (order.updated_at !== input.expected_updated_at) {
    throw new Error("工单已被更新，请刷新后再试");
  }
  if (!from && !reason) throw new Error("补录历史设备保管状态时必须填写说明");
  const role = typeof operator === "string" ? undefined : (operator.storeRole ?? operator.role);
  const workflowBucket = mockOrderWorkflowBucket(order);
  const cancelled = isOrderCancelled(order) || workflowBucket === "cancelled";
  const isTerminal =
    order.status === "completed" ||
    cancelled ||
    workflowBucket === "done" ||
    (workflowBucket === undefined && order.workflow_status === "closed");
  if (order.record_state === "voided" || order.deleted_at) {
    throw new Error("该工单记录已作废，只能查看历史证据");
  }
  if (isTerminal && role !== "owner" && role !== "manager") {
    throw new Error("已结束工单只能由店主或经理填写说明后修正设备保管状态");
  }
  if (isTerminal && !reason) {
    throw new Error("已结束工单只能由店主或经理填写说明后修正设备保管状态");
  }
  if (cancelled && from === DEVICE_CUSTODY_WITH_SHOP && to === DEVICE_CUSTODY_WITH_CUSTOMER) {
    throw new Error("已取消工单请使用“确认设备已退还”操作");
  }
  if (
    (order.status === "completed" || workflowBucket === "done") &&
    to === DEVICE_CUSTODY_WITH_SHOP
  ) {
    throw new Error("已完成工单不能直接改为门店保管，请先按返修流程重开");
  }
  if (isTerminal && reason && reason.length < 5) {
    throw new Error("已结束工单修正设备保管状态时，说明至少需要 5 个字符");
  }
  if (
    from !== to &&
    !deviceCustodyAllowsChange({
      current: from,
      target: to,
      status: order.status,
      exceptionStatus: order.exception_status,
      workflowBucket,
    })
  ) {
    throw new Error("当前流程需要设备留在门店，请先完成、取消或流转到允许交还的阶段");
  }

  const now = new Date().toISOString();
  const priorDeliveryRecorded = Boolean(order.delivered_at);
  order.device_custody_status = to;
  if (to === DEVICE_CUSTODY_WITH_CUSTOMER) {
    if (from === DEVICE_CUSTODY_WITH_SHOP) order.delivered_at = now;
  } else if (from === DEVICE_CUSTODY_WITH_CUSTOMER || !from) {
    order.delivered_at = undefined;
  }
  order.updated_at = now;
  extraEvents.unshift({
    id: `evt_custody_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "note",
    payload: {
      action: "device_custody_changed",
      from,
      to,
      reason: reason || null,
      credentials_cleared: false,
      prior_delivery_recorded: priorDeliveryRecorded,
      idempotency_key: input.idempotency_key,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return { ok: true, updated_at: now };
}

function buildMockTransitionDiagnosisResult(current: string | undefined, reason: string) {
  const cleanReason = reason.trim();
  if (!current?.trim() || current.trim() === cleanReason) return cleanReason;
  return `${current.trim()}\n处理结论：${cleanReason}`;
}

const APPROVAL_APPROVED_TARGETS = ["repairing", "parts_ordered", "mail_in_progress"] as const;
const APPROVAL_REJECTED_TARGETS = ["unfixed_pickup", "cancelled"] as const;

export async function decideOrderApproval(
  id: string,
  input: OrderApprovalDecisionInput,
  operator: MockOperator = "前台",
): Promise<OrderApprovalDecisionResult> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const from = o.status;
  const currentApprovalFlow =
    o.approval_flow_status ?? approvalFlowStatusFromLegacyStatus(o.status, o.approval_status);
  const cleanReason = input.reason?.trim();
  if (
    currentApprovalFlow !== "waiting_customer" &&
    !(from === "quoted" && o.approval_status === "pending")
  ) {
    throw new Error("当前工单不在客户审批阶段");
  }

  const target =
    input.next_status ?? (input.decision === "approved" ? "repairing" : "unfixed_pickup");
  const allowedTargets =
    input.decision === "approved" ? APPROVAL_APPROVED_TARGETS : APPROVAL_REJECTED_TARGETS;
  if (!(allowedTargets as readonly string[]).includes(target)) {
    throw new Error(
      input.decision === "approved"
        ? "客户同意后只能进入维修、订件或寄修流程"
        : "客户拒绝后只能进入未修取机或取消流程",
    );
  }
  if (input.decision === "rejected" && !cleanReason) {
    throw new Error("客户拒绝报价需要填写原因");
  }
  const targetStatus = workflowStatuses.find((status) => status.code === target);
  if (!targetStatus) throw new Error("目标状态不存在");
  if (!targetStatus.enabled) {
    throw new Error(`「${targetStatus.label}」已停用，不能流转到该状态`);
  }
  const requiresPhysicalCustody =
    deviceCustodyBlocksStatus(target) ||
    targetStatus.bucket === "diagnosing" ||
    targetStatus.bucket === "repair" ||
    targetStatus.bucket === "pickup";
  if (!o.device_custody_status && (requiresPhysicalCustody || target === "cancelled")) {
    throw new Error("请先确认设备是留在门店还是由客户带走，再进行此状态流转");
  }
  if (o.device_custody_status === DEVICE_CUSTODY_WITH_CUSTOMER && requiresPhysicalCustody) {
    throw new Error("设备当前未留店，不能进入诊断、维修或待取机状态");
  }

  if (input.decision === "approved") {
    const allowed = workflowTransitions.some(
      (transition) =>
        transition.from_status_code === from &&
        transition.to_status_code === target &&
        transition.enabled,
    );
    if (!allowed) {
      const fromLabel = workflowStatuses.find((status) => status.code === from)?.label ?? from;
      const toLabel = targetStatus.label;
      throw new Error(`「${fromLabel}」不能直接流转到「${toLabel}」`);
    }
  }

  const now = new Date().toISOString();
  o.status = target;
  o.workflow_status = workflowStatusFromLegacyStatus(target);
  o.exception_status =
    target === "cancelled"
      ? "cancelled"
      : target === "unfixed_pickup"
        ? "returned_unfixed"
        : undefined;
  o.approval_status = input.decision;
  o.approval_flow_status = input.decision;
  o.approval_confirmed_at = now;
  o.parts_status = partsStatusFromLegacyStatus(target);
  o.notify_status = notifyStatusFromLegacyStatus(target);
  o.updated_at = now;
  if (target === "cancelled") {
    o.cancel_reason = cleanReason || "客户拒绝报价";
  }
  if (target === "unfixed_pickup") {
    o.diagnosis_result = buildMockTransitionDiagnosisResult(
      o.diagnosis_result,
      cleanReason || "客户拒绝报价并取回设备",
    );
  }
  extraEvents.unshift({
    id: `evt_approval_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "approval_result",
    payload: {
      result: input.decision,
      from,
      to: target,
      reason: cleanReason,
      approval_flow_status: input.decision,
      ...(target === "cancelled"
        ? {
            custody_outcome:
              o.device_custody_status === DEVICE_CUSTODY_WITH_CUSTOMER
                ? o.delivered_at
                  ? "returned"
                  : "never_received"
                : "awaiting_return",
          }
        : {}),
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return {
    ok: true,
    decision: input.decision,
    from,
    to: target,
    approval_flow_status: input.decision,
  };
}

// POST /api/orders/batch-transition
export async function batchTransition(
  ids: string[],
  to: RepairOrderStatus,
  operator: MockOperator = "前台",
) {
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to, { operator });
      count++;
    } catch (e) {
      failures.push({ id, reason: (e as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

// POST /api/orders/[id]/payment
export async function recordPayment(
  id: string,
  amount: number,
  method = "现金",
  operator: MockOperator = "前台",
  expectedUpdatedAt?: string,
  idempotencyKey?: string,
) {
  const normalizedAmount = normalizePositiveCentAmount(amount);
  if (normalizedAmount === undefined) {
    throw new Error("收款金额必须大于 0，且最多保留两位小数");
  }
  if (!idempotencyKey) throw new Error("缺少收款操作标识");
  const fingerprint = JSON.stringify({
    id,
    amount: normalizedAmount,
    method,
    operator: typeof operator === "string" ? operator : operator.id,
    expectedUpdatedAt,
  });
  const existingOperation = paymentOperations.get(idempotencyKey);
  if (existingOperation) {
    if (existingOperation.fingerprint !== fingerprint) {
      throw new Error("该收款操作标识已用于不同请求，请刷新后重试");
    }
    return { ...existingOperation.result, code: "idempotent_replay" as const };
  }
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  if (!expectedUpdatedAt) throw new Error("缺少工单版本时间");
  if (isOrderCancelledForPayment(o)) throw new Error("已取消工单不能登记收款");
  if (o.updated_at !== expectedUpdatedAt) throw new Error("工单已被更新，请刷新后再试");
  if (o.balance_amount <= 0 || o.is_paid) throw new Error("该工单已结清");
  if (normalizedAmount > o.balance_amount) throw new Error("收款金额不能超过未结清尾款");
  o.balance_amount = Math.max(0, o.balance_amount - normalizedAmount);
  if (o.balance_amount === 0) o.is_paid = true;
  o.payment_status = paymentStatusFromMoney({
    isPaid: o.is_paid,
    depositAmount: normalizedAmount,
    balanceAmount: o.balance_amount,
  });
  const now = new Date().toISOString();
  o.updated_at = now;
  extraEvents.unshift({
    id: `event_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "payment",
    payload: {
      amount: normalizedAmount,
      method,
      balance: o.balance_amount,
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  const result: PaymentResult = {
    ok: true,
    code: "recorded",
    payment_id: idempotencyKey,
    balance: o.balance_amount,
    is_paid: o.is_paid,
    updated_at: now,
  };
  paymentOperations.set(idempotencyKey, { fingerprint, result });
  return result;
}

const PATCH_FIELD_LABELS: Record<keyof PatchOrderInput["changes"], string> = {
  customer_name: "客户姓名",
  customer_phone: "手机号",
  device_brand: "设备品牌",
  device_model: "设备型号",
  device_imei: "IMEI/序列号",
  device_notes: "设备备注",
  issue_description: "故障描述",
  diagnosis_result: "诊断结果",
  internal_tag: "内部标签",
  accessory_notes: "随附物品",
  device_unlock: "手机密码",
  warranty_text: "质保",
  warranty_months: "质保期限",
  warranty_change_reason: "质保变更原因",
  parts_supplier_id: "配件供应商",
  assignee_membership_id: "负责人",
};

function applyDeviceUnlock(order: RepairOrder, input: PatchOrderInput["changes"]["device_unlock"]) {
  const unlock = normalizeDeviceUnlockInput(input);
  order.device_unlock_method = unlock.method ?? undefined;
  order.device_unlock_value = unlock.value ?? undefined;
  order.device_unlock_pattern = unlock.pattern ?? undefined;
}

function normalizeFaultPriceInput(input: PatchOrderFinanceInput["fault_prices"]) {
  return input.map((item) => {
    const name = item.name.trim();
    const price = Number(item.price);
    if (!name) throw new Error("报价项目名称不能为空");
    if (!Number.isFinite(price) || price < 0) throw new Error("报价金额不能为负数");
    return {
      name,
      price,
      currency_code: CURRENCY_CODE,
      ...(item.note?.trim() ? { note: item.note.trim() } : {}),
    };
  });
}

function writeMergedPatchEvent(
  orderId: string,
  changedFields: string[],
  now: string,
  operator: MockOperator,
) {
  const name = operatorName(operator);
  const cutoff = Date.now() - 5 * 60 * 1000;
  const previous = extraEvents.find(
    (event) =>
      event.order_id === orderId &&
      event.event_type === "note" &&
      event.payload.action === "order_patched" &&
      new Date(event.created_at).getTime() >= cutoff,
  );

  if (previous) {
    const existingFields = Array.isArray(previous.payload.changed_fields)
      ? previous.payload.changed_fields.filter(
          (field): field is string => typeof field === "string",
        )
      : [];
    previous.payload = {
      ...previous.payload,
      changed_fields: Array.from(new Set([...existingFields, ...changedFields])),
      currency_code: CURRENCY_CODE,
    };
    previous.created_at = now;
    previous.operator_name = name;
    return;
  }

  extraEvents.unshift({
    id: `evt_patch_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: orderId,
    event_type: "note",
    payload: {
      action: "order_patched",
      changed_fields: changedFields,
      currency_code: CURRENCY_CODE,
    },
    operator_name: name,
    created_at: now,
  });
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
  operator: MockOperator = "前台",
): Promise<{ ok: boolean }> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockRoutineMutationAllowed(o);
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");
  if (o.updated_at !== input.expected_updated_at) throw new Error("工单已被更新，请刷新后再试");
  const customer = getCustomer(o.customer_id);
  const device = getDevice(o.device_id);
  if (!customer || !device) throw new Error("工单缺少客户或设备关联");

  const customerName = input.customer_name.trim();
  const customerPhone = input.customer_phone.trim();
  const deviceBrand = input.device_brand.trim();
  const deviceModel = input.device_model.trim();
  const issueDescription = input.issue_description.trim();
  if (!customerName || !customerPhone) throw new Error("客户姓名和手机号不能为空");
  if (!deviceBrand || !deviceModel) throw new Error("设备品牌和型号不能为空");
  if (!issueDescription) throw new Error("故障描述不能为空");

  const validFaults = input.fault_prices
    .filter((item) => item.name.trim() && Number(item.price) >= 0)
    .map((item) => ({
      name: item.name.trim(),
      price: Number(item.price),
      currency_code: CURRENCY_CODE,
      ...(item.note?.trim() ? { note: item.note.trim() } : {}),
    }));
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const paidAmount = Math.max(0, o.quotation_amount - o.deposit_amount - o.balance_amount);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const approvalReset = shouldResetMockQuoteApproval(
    o,
    validFaults,
    quotation,
    deposit,
    nextBalance,
  );
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const deviceUnlock = input.device_unlock
    ? normalizeDeviceUnlockInput(input.device_unlock)
    : undefined;
  const now = new Date().toISOString();
  const warranty = normalizeWarrantyPayload({
    warranty_months: input.warranty_months,
    warranty_text: input.warranty_text,
    warranty_change_reason: input.warranty_change_reason,
    defaultWarrantyMonths: 6,
  });
  const previousWarrantyMonths =
    typeof o.warranty_months === "number"
      ? o.warranty_months
      : parseWarrantyMonths(o.warranty_text, 6);
  const previousWarrantyReason = o.warranty_change_reason;
  const warrantyChanged =
    previousWarrantyMonths !== warranty.warranty_months ||
    (previousWarrantyReason ?? "") !== (warranty.warranty_change_reason ?? "");
  const phoneBook = normalizePhoneBook(customerPhone);
  if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
  const customerContactPhones = mergeContactPhones([], phoneBook.contacts, phoneBook.primaryRaw);
  assertCustomerPhoneAvailable(customer.id, phoneBook.primaryRaw, customerContactPhones);

  customer.name = customerName;
  customer.phone_e164 = phoneBook.primary;
  customer.phone_raw = phoneBook.primaryRaw;
  customer.contact_phones = customerContactPhones;

  o.issue_description = issueDescription;
  o.diagnosis_result = input.diagnosis_result?.trim() || undefined;
  o.internal_tag = tagInput.internalTag;
  o.accessory_notes = tagInput.accessoryNotes;
  if (deviceUnlock) {
    o.device_unlock_method = deviceUnlock.method ?? undefined;
    o.device_unlock_value = deviceUnlock.value ?? undefined;
    o.device_unlock_pattern = deviceUnlock.pattern ?? undefined;
  }
  o.warranty_text = warranty.warranty_text;
  o.warranty_months = warranty.warranty_months;
  o.warranty_change_reason = warranty.warranty_change_reason;
  if (warrantyChanged) {
    o.warranty_changed_by = typeof operator === "string" ? undefined : operator.id;
    o.warranty_changed_at = now;
  }
  o.contact_phones = customerContactPhones;
  o.quotation_amount = quotation;
  o.deposit_amount = deposit;
  o.balance_amount = nextBalance;
  o.is_paid = nextBalance === 0;
  o.payment_status = paymentStatusFromMoney({
    isPaid: nextBalance === 0,
    depositAmount: deposit,
    balanceAmount: nextBalance,
  });
  o.fault_prices = validFaults;
  o.currency_code = CURRENCY_CODE;
  if (approvalReset) resetMockQuoteApproval(o);
  o.device_snapshot = {
    brand: deviceBrand,
    model: deviceModel,
    serial_or_imei: input.device_imei?.trim() ?? "",
    ...(input.device_notes?.trim() ? { device_notes: input.device_notes.trim() } : {}),
  };
  o.updated_at = now;

  extraEvents.unshift({
    id: `evt_update_${Date.now()}`,
    order_id: id,
    event_type: "note",
    payload: {
      action: "order_updated",
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      internal_tag: tagInput.internalTag,
      accessory_notes: tagInput.accessoryNotes,
      device_unlock_changed: Boolean(deviceUnlock),
      device_unlock_method: deviceUnlock?.method ?? null,
      warranty_months: warranty.warranty_months,
      warranty_text: warranty.warranty_text,
      approval_reset: approvalReset,
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });

  if (warrantyChanged) {
    extraEvents.unshift({
      id: `evt_warranty_${Date.now()}`,
      order_id: id,
      event_type: "note",
      payload: {
        action: "warranty_changed",
        from_months: previousWarrantyMonths,
        from_text: formatWarrantyText(previousWarrantyMonths),
        to_months: warranty.warranty_months,
        to_text: warranty.warranty_text,
        reason: warranty.warranty_change_reason ?? null,
        default_months: 6,
      },
      operator_name: operatorName(operator),
      created_at: now,
    });
  }

  return { ok: true };
}

export async function patchOrder(
  id: string,
  input: PatchOrderInput,
  operator: MockOperator = "前台",
): Promise<PatchOrderResult> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockRoutineMutationAllowed(o);
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");
  if (o.updated_at !== input.expected_updated_at) throw new Error("工单已被更新，请刷新后再试");

  const rawEntries = Object.entries(input.changes).filter(([, value]) => value !== undefined);
  const unsupportedField = rawEntries.find(([field]) => !(field in PATCH_FIELD_LABELS))?.[0];
  if (unsupportedField) throw new Error(`${unsupportedField} 不可通过快速编辑修改`);
  const entries = rawEntries as [
    keyof PatchOrderInput["changes"],
    PatchOrderInput["changes"][keyof PatchOrderInput["changes"]],
  ][];
  if (entries.length === 0) throw new Error("没有可保存的字段");

  const customer = getCustomer(o.customer_id);
  const device = getDevice(o.device_id);
  if (!customer || !device) throw new Error("工单缺少客户或设备关联");

  const nextSnapshot = {
    brand: o.device_snapshot?.brand || device.brand,
    model: o.device_snapshot?.model || device.model,
    serial_or_imei: o.device_snapshot?.serial_or_imei || device.serial_or_imei,
    device_notes: o.device_snapshot?.device_notes || device.device_notes,
  };
  const changedFields: string[] = [];

  for (const [field, rawValue] of entries) {
    changedFields.push(PATCH_FIELD_LABELS[field]);
    if (field === "assignee_membership_id") {
      const membershipId = typeof rawValue === "string" ? rawValue.trim() : "";
      o.assignee_membership_id = membershipId || undefined;
      o.technician_name = membershipId ? "Hexiang" : "未分配";
      continue;
    }
    if (field === "device_unlock") {
      applyDeviceUnlock(o, rawValue as PatchOrderInput["changes"]["device_unlock"]);
      continue;
    }
    if (field === "parts_supplier_id") {
      const supplierId = typeof rawValue === "string" ? rawValue.trim() : null;
      if (supplierId && !getMockSupplier(supplierId)) {
        throw new Error("配件供应商不存在或不属于当前店铺");
      }
      o.parts_supplier_id = supplierId || undefined;
      continue;
    }
    if (field === "warranty_months") {
      const months = Number(rawValue);
      if (!Number.isInteger(months) || months < 0 || months > 36) {
        throw new Error("质保期限必须是 0 到 36 个月的整数");
      }
      o.warranty_months = months;
      continue;
    }
    if (typeof rawValue !== "string") throw new Error(`${PATCH_FIELD_LABELS[field]}格式不正确`);
    const value = rawValue.trim();
    switch (field) {
      case "customer_name":
        if (!value) throw new Error("客户姓名不能为空");
        customer.name = value;
        break;
      case "customer_phone":
        if (!value) throw new Error("手机号不能为空");
        {
          const phoneBook = normalizePhoneBook(value, customer.contact_phones);
          if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
          const contactPhones = mergeContactPhones(
            customer.contact_phones,
            phoneBook.contacts,
            phoneBook.primaryRaw,
          );
          assertCustomerPhoneAvailable(customer.id, phoneBook.primaryRaw, contactPhones);
          customer.phone_e164 = phoneBook.primary;
          customer.phone_raw = phoneBook.primaryRaw;
          customer.contact_phones = contactPhones;
          o.contact_phones = contactPhones;
        }
        break;
      case "device_brand":
        if (!value) throw new Error("设备品牌不能为空");
        nextSnapshot.brand = value;
        break;
      case "device_model":
        if (!value) throw new Error("设备型号不能为空");
        nextSnapshot.model = value;
        break;
      case "device_imei":
        if (!value) throw new Error("IMEI / 序列号不能为空");
        nextSnapshot.serial_or_imei = value;
        break;
      case "device_notes":
        nextSnapshot.device_notes = value || undefined;
        break;
      case "issue_description":
        if (!value) throw new Error("故障描述不能为空");
        o.issue_description = value;
        break;
      case "diagnosis_result":
        o.diagnosis_result = value || undefined;
        break;
      case "internal_tag": {
        const tagInput = normalizeOrderTagInput({ internalTag: value });
        o.internal_tag = tagInput.internalTag;
        break;
      }
      case "accessory_notes": {
        const tagInput = normalizeOrderTagInput({ accessoryNotes: value });
        o.accessory_notes = tagInput.accessoryNotes;
        break;
      }
      case "warranty_text":
        o.warranty_text = value || undefined;
        break;
      case "warranty_change_reason":
        o.warranty_change_reason = value || undefined;
        break;
    }
  }

  if (
    entries.some(([field]) =>
      ["device_brand", "device_model", "device_imei", "device_notes"].includes(field),
    )
  ) {
    if (!nextSnapshot.brand || !nextSnapshot.model) throw new Error("设备品牌和型号不能为空");
    o.device_snapshot = nextSnapshot;
  }

  const now = new Date().toISOString();
  o.updated_at = now;
  writeMergedPatchEvent(id, changedFields, now, operator);
  return { ok: true, updated_at: now };
}

export async function patchOrderFinance(
  id: string,
  input: PatchOrderFinanceInput,
  operator: MockOperator = "前台",
): Promise<PatchOrderResult> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockRoutineMutationAllowed(o);
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");
  if (o.updated_at !== input.expected_updated_at) throw new Error("工单已被更新，请刷新后再试");

  const validFaults = normalizeFaultPriceInput(input.fault_prices);
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const paidAmount = Math.max(0, o.quotation_amount - o.deposit_amount - o.balance_amount);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const approvalReset = shouldResetMockQuoteApproval(
    o,
    validFaults,
    quotation,
    deposit,
    nextBalance,
  );
  const now = new Date().toISOString();

  o.quotation_amount = quotation;
  o.deposit_amount = deposit;
  o.balance_amount = nextBalance;
  o.is_paid = nextBalance === 0;
  o.payment_status = paymentStatusFromMoney({
    isPaid: nextBalance === 0,
    depositAmount: deposit,
    balanceAmount: nextBalance,
  });
  o.fault_prices = validFaults;
  o.currency_code = CURRENCY_CODE;
  if (approvalReset) resetMockQuoteApproval(o);
  o.updated_at = now;

  extraEvents.unshift({
    id: `evt_finance_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "note",
    payload: {
      action: "order_finance_updated",
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      approval_reset: approvalReset,
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });

  return { ok: true, updated_at: now };
}

function readMockTerminalRequest(
  id: string,
  input: { expected_updated_at: string; idempotency_key: string; reason: string },
  operation: "correction" | "reopen" | "void",
  fingerprintInput: unknown,
  operator: MockOperator,
) {
  const fingerprint = JSON.stringify({
    id,
    operation,
    fingerprintInput,
    actor: operatorName(operator),
  });
  const existing = terminalOperations.get(input.idempotency_key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new Error("该操作标识已用于不同请求，请刷新后重试");
    }
    return { replay: { ...existing.result, code: "idempotent_replay" as const, replayed: true } };
  }
  const order = orders.find((item) => item.id === id);
  if (!order) throw new Error("工单不存在");
  if (order.updated_at !== input.expected_updated_at) {
    throw new Error("工单已被更新，请刷新后再试");
  }
  if ((input.reason.trim().length ?? 0) < 5) throw new Error("原因至少需要 5 个字符");
  if (order.record_state === "voided" || order.deleted_at)
    throw new Error("当前工单状态不允许执行该操作");
  if (!isMockTerminalOrder(order)) {
    throw new Error("当前工单状态不允许执行该操作");
  }
  return { order, fingerprint };
}

function saveMockTerminalResult(
  idempotencyKey: string,
  fingerprint: string,
  order: RepairOrder,
): OrderTerminalOperationResult {
  const result: OrderTerminalOperationResult = {
    ok: true,
    code: "recorded",
    operation_id: idempotencyKey,
    order_id: order.id,
    status: order.status,
    record_state: order.record_state === "voided" ? "voided" : "active",
    updated_at: order.updated_at,
    replayed: false,
  };
  terminalOperations.set(idempotencyKey, { fingerprint, result });
  return result;
}

export async function correctTerminalOrder(
  id: string,
  input: CorrectTerminalOrderInput,
  operator: MockOperator = "前台",
): Promise<OrderTerminalOperationResult> {
  const request = readMockTerminalRequest(id, input, "correction", input, operator);
  if (request.replay) return request.replay;
  const order = request.order!;
  const before = JSON.stringify(
    Object.fromEntries(
      Object.keys(input.changes).map((field) => [
        field,
        (order as unknown as Record<string, unknown>)[field],
      ]),
    ),
  );
  for (const [field, rawValue] of Object.entries(input.changes)) {
    if (field === "warranty_months") {
      const months = Number(rawValue);
      if (!Number.isInteger(months) || months < 0 || months > 36) throw new Error("质保期限无效");
      order.warranty_months = months;
      continue;
    }
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (field === "issue_description" && !value) throw new Error("故障描述不能为空");
    if (field === "issue_description") order.issue_description = value;
    if (field === "diagnosis_result") order.diagnosis_result = value || undefined;
    if (field === "internal_tag") order.internal_tag = value || undefined;
    if (field === "accessory_notes") order.accessory_notes = value || undefined;
    if (field === "warranty_text") order.warranty_text = value || undefined;
    if (field === "warranty_change_reason") order.warranty_change_reason = value || undefined;
  }
  const after = JSON.stringify(
    Object.fromEntries(
      Object.keys(input.changes).map((field) => [
        field,
        (order as unknown as Record<string, unknown>)[field],
      ]),
    ),
  );
  if (before === after) throw new Error("没有实际变化");
  const now = new Date().toISOString();
  order.updated_at = now;
  extraEvents.unshift({
    id: `evt_terminal_${input.idempotency_key}`,
    order_id: id,
    event_type: "note",
    payload: { action: "terminal_correction", reason: input.reason },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return saveMockTerminalResult(input.idempotency_key, request.fingerprint!, order);
}

export async function reopenOrder(
  id: string,
  input: ReopenOrderInput,
  operator: MockOperator = "前台",
): Promise<OrderTerminalOperationResult> {
  const request = readMockTerminalRequest(id, input, "reopen", input, operator);
  if (request.replay) return request.replay;
  const order = request.order!;
  const target = workflowStatuses.find((item) => item.code === input.to_status && item.enabled);
  if (!target || ["done", "cancelled", "custom"].includes(target.bucket)) {
    throw new Error("重新打开的目标状态无效或已停用");
  }
  const from = order.status;
  const now = new Date().toISOString();
  order.status = input.to_status;
  order.workflow_status = workflowStatusFromLegacyStatus(input.to_status);
  order.exception_status = undefined;
  order.completed_at = undefined;
  order.delivered_at = undefined;
  order.updated_at = now;
  extraEvents.unshift({
    id: `evt_terminal_${input.idempotency_key}`,
    order_id: id,
    event_type: "status_changed",
    payload: { action: "terminal_reopen", from, to: input.to_status, reason: input.reason },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return saveMockTerminalResult(input.idempotency_key, request.fingerprint!, order);
}

export async function voidOrder(
  id: string,
  input: VoidOrderInput,
  operator: MockOperator = "前台",
): Promise<OrderTerminalOperationResult> {
  const request = readMockTerminalRequest(id, input, "void", input, operator);
  if (request.replay) return request.replay;
  const order = request.order!;
  if (input.confirm_public_no.trim() !== order.public_no) throw new Error("输入的工单号不一致");
  if (order.is_paid || order.deposit_amount > 0 || order.quotation_amount > order.balance_amount) {
    throw new Error("存在收款或定金证据，必须先完成财务冲销/退款");
  }
  const now = new Date().toISOString();
  order.record_state = "voided";
  order.voided_at = now;
  order.void_reason = input.reason.trim();
  order.deleted_at = now;
  order.updated_at = now;
  extraEvents.unshift({
    id: `evt_terminal_${input.idempotency_key}`,
    order_id: id,
    event_type: "note",
    payload: { action: "terminal_void", reason: input.reason },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return saveMockTerminalResult(input.idempotency_key, request.fingerprint!, order);
}

// POST /api/orders/[id]/notify
export async function sendNotification(
  id: string,
  body: string,
  channel: "whatsapp" | "sms" = "whatsapp",
  operator: MockOperator = "前台",
) {
  const message = body.trim();
  if (!message) throw new Error("通知内容不能为空");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockOrderNotVoided(o);
  const now = new Date().toISOString();
  const messageId = `msg_${Date.now()}`;
  o.updated_at = now;
  o.notify_status = "sent";
  extraMessages.unshift({
    id: messageId,
    order_id: id,
    channel,
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  extraEvents.unshift({
    id: `evt_message_${Date.now()}`,
    order_id: id,
    event_type: "message_sent",
    payload: { channel, message_id: messageId },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return { ok: true, id: messageId, channel, body: message };
}

function writeMockWhatsappMessage({
  id,
  body,
  templateKind,
  eventType,
  transitionTo,
  operator = "前台",
  recipientPhone,
  allowInvalidTransition = false,
  markApprovalPending = false,
}: {
  id: string;
  body: string;
  templateKind: OrderWhatsappTemplateKind;
  eventType: "message_sent" | "approval_sent";
  transitionTo?: RepairOrderStatus;
  operator?: MockOperator;
  recipientPhone?: string;
  allowInvalidTransition?: boolean;
  markApprovalPending?: boolean;
}): WhatsappNotificationResult {
  const message = body.trim();
  const cleanRecipientPhone = recipientPhone?.trim();
  if (!message) throw new Error("通知内容不能为空");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  assertMockOrderNotVoided(o);
  const now = new Date().toISOString();
  const messageId = `msg_whatsapp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const from = o.status;
  let statusChanged = false;
  let to: RepairOrderStatus | undefined;

  if (markApprovalPending && from !== "quoted" && from !== "waiting_approval") {
    throw new Error("只有报价或待审批阶段可以发送客户审批");
  }

  if (
    !transitionTo &&
    o.device_custody_status !== DEVICE_CUSTODY_WITH_SHOP &&
    (templateKind === "pickup_ready" || templateKind === "unfixed_pickup")
  ) {
    throw new Error("设备未留店，不能发送取机通知");
  }

  if (transitionTo) {
    if (transitionTo === "completed" || transitionTo === "cancelled") {
      throw new Error("完成或取消工单必须使用专用状态操作，不能随通知一起流转");
    }
    const targetValidation = validateMockManualTransitionTarget(from, transitionTo);
    if (!targetValidation.ok) throw new Error(targetValidation.reason);
    const targetStatus = workflowStatuses.find((status) => status.code === transitionTo);
    if (targetStatus && !targetStatus.enabled) {
      throw new Error(`「${targetStatus.label}」已停用，不能流转到该状态`);
    }
    const allowed = workflowTransitions.some(
      (transition) =>
        transition.from_status_code === from &&
        transition.to_status_code === transitionTo &&
        transition.enabled,
    );
    if (!allowed) {
      if (!allowInvalidTransition) {
        const fromLabel = workflowStatuses.find((status) => status.code === from)?.label ?? from;
        const toLabel =
          workflowStatuses.find((status) => status.code === transitionTo)?.label ?? transitionTo;
        throw new Error(`「${fromLabel}」不能直接流转到「${toLabel}」`);
      }
    } else {
      if (
        o.device_custody_status !== DEVICE_CUSTODY_WITH_SHOP &&
        (deviceCustodyBlocksStatus(transitionTo) ||
          targetStatus?.bucket === "diagnosing" ||
          targetStatus?.bucket === "repair" ||
          targetStatus?.bucket === "pickup")
      ) {
        throw new Error("设备当前未留店，不能进入诊断、维修或待取机状态");
      }
      statusChanged = true;
      to = transitionTo;
      o.status = to;
      o.workflow_status = workflowStatusFromLegacyStatus(to);
      o.exception_status =
        to === "cancelled"
          ? "cancelled"
          : to === "rework"
            ? "rework"
            : to === "unfixed_pickup"
              ? "returned_unfixed"
              : undefined;
      o.approval_flow_status = approvalFlowStatusFromLegacyStatus(to, o.approval_status);
      o.parts_status = partsStatusFromLegacyStatus(to);
      o.notify_status = notifyStatusFromLegacyStatus(to);
      if (to === "waiting_approval") o.approval_sent_at = now;
    }
  }

  if (markApprovalPending) {
    o.approval_status = "pending";
    o.approval_sent_at = now;
    o.approval_flow_status = "waiting_customer";
  }
  if (!markApprovalPending) o.notify_status = "sent";
  o.updated_at = now;

  extraMessages.unshift({
    id: messageId,
    order_id: id,
    channel: "whatsapp",
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  extraEvents.unshift({
    id: `evt_whatsapp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: eventType,
    payload: {
      channel: "whatsapp",
      message_id: messageId,
      template_kind: templateKind,
      status_changed: statusChanged,
      currency_code: CURRENCY_CODE,
      ...(cleanRecipientPhone ? { recipient_phone: cleanRecipientPhone } : {}),
      ...(transitionTo ? { from, to: statusChanged && to ? to : from } : {}),
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return {
    ok: true,
    id: messageId,
    channel: "whatsapp",
    body: message,
    template_kind: templateKind,
    recipient_phone: cleanRecipientPhone,
    statusChanged,
    from,
    to,
  };
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
  operator: MockOperator = "前台",
  recipientPhone?: string,
) {
  return writeMockWhatsappMessage({
    id,
    body,
    templateKind,
    eventType: "message_sent",
    transitionTo,
    operator,
    recipientPhone,
  });
}

export async function sendApprovalRequest(
  id: string,
  body: string,
  operator: MockOperator = "前台",
  recipientPhone?: string,
) {
  return writeMockWhatsappMessage({
    id,
    body,
    templateKind: "approval_request",
    eventType: "approval_sent",
    transitionTo: "waiting_approval",
    operator,
    recipientPhone,
    allowInvalidTransition: true,
    markApprovalPending: true,
  });
}

export async function publishOrderQuote(
  id: string,
  input: PublishOrderQuoteInput,
  operator: MockOperator = "前台",
): Promise<PublishOrderQuoteResult> {
  const order = orders.find((item) => item.id === id);
  if (!order) throw new Error("工单不存在");
  assertMockRoutineMutationAllowed(order);
  if (typeof operator !== "string" && !operator.isSystem && !can(operator, "order:quote_prepare")) {
    throw new ForbiddenError("当前员工没有发布报价权限");
  }

  const fingerprint = JSON.stringify({
    actor: typeof operator === "string" ? operator : operator.id,
    order: id,
    expected: input.expected_updated_at,
    diagnosis: input.diagnosis_result.trim(),
    items: input.fault_prices.map((item) => ({
      name: item.name.trim(),
      price: Number(item.price),
      currency_code: item.currency_code ?? CURRENCY_CODE,
      note: item.note?.trim() ?? "",
    })),
    exception: input.price_exception ?? null,
  });
  const replay = extraEvents.find(
    (event) =>
      event.order_id === id &&
      event.event_type === "quoted" &&
      event.payload.idempotency_key === input.idempotency_key,
  );
  if (replay) {
    if (replay.payload.request_fingerprint !== fingerprint) {
      throw new Error("该操作标识已用于不同请求，请刷新后重试");
    }
    return {
      ok: true,
      code: "idempotent_replay",
      quote_event_id: replay.id,
      updated_at: String(replay.payload.updated_at_after),
      quotation_amount: Number(replay.payload.quotation_amount),
      deposit_amount: Number(replay.payload.deposit_amount),
      paid_amount: Number(replay.payload.paid_amount),
      balance_amount: Number(replay.payload.balance_amount),
      is_paid: Boolean(replay.payload.is_paid),
      payment_status: String(
        replay.payload.payment_status,
      ) as PublishOrderQuoteResult["payment_status"],
      status: String(replay.payload.to),
      approval_status: "pending",
      approval_flow_status: "not_required",
      approval_reset: Boolean(replay.payload.approval_reset),
      replayed: true,
    };
  }
  if (order.updated_at !== input.expected_updated_at) {
    throw new Error("工单已被其他操作更新，请刷新后比较并重试");
  }

  const diagnosis = input.diagnosis_result.trim();
  if (!diagnosis || diagnosis.length > 8000) throw new Error("检测结论无效");
  const faults = input.fault_prices.map((item) => ({
    name: item.name.trim(),
    price: Number(item.price),
    currency_code: CURRENCY_CODE,
    ...(item.note?.trim() ? { note: item.note.trim() } : {}),
  }));
  if (
    faults.length < 1 ||
    faults.length > 50 ||
    faults.some(
      (item) =>
        !item.name ||
        item.name.length > 120 ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        Math.abs(item.price * 100 - Math.round(item.price * 100)) >= 1e-8,
    )
  ) {
    throw new Error("报价项目无效");
  }
  const hasZero = faults.some((item) => item.price === 0);
  if (hasZero && (!input.price_exception || input.price_exception.reason.trim().length < 4)) {
    throw new Error("零元项目必须填写价格例外原因");
  }
  if (!hasZero && input.price_exception) throw new Error("没有零元项目时不能提交价格例外");

  const quotation = faults.reduce((sum, item) => sum + item.price, 0);
  const paidAmount = Math.max(
    0,
    order.quotation_amount - order.deposit_amount - order.balance_amount,
  );
  const received = order.deposit_amount + paidAmount;
  if (quotation < received) throw new Error("新报价不能低于已经收取的定金和款项");

  const now = new Date().toISOString();
  const quoteEventId = crypto.randomUUID();
  const from = order.status;
  const approvalReset =
    order.approval_flow_status !== "not_required" ||
    Boolean(order.approval_sent_at || order.approval_confirmed_at);
  order.diagnosis_result = diagnosis;
  order.fault_prices = faults;
  order.quotation_amount = quotation;
  order.balance_amount = quotation - received;
  order.is_paid = order.balance_amount === 0;
  order.payment_status = paymentStatusFromMoney({
    isPaid: order.is_paid,
    depositAmount: order.deposit_amount,
    balanceAmount: order.balance_amount,
  });
  order.status = "quoted";
  order.workflow_status = "quote";
  order.approval_status = "pending";
  order.approval_flow_status = "not_required";
  order.approval_sent_at = undefined;
  order.approval_confirmed_at = undefined;
  order.notify_status = "not_sent";
  order.updated_at = now;

  extraEvents.unshift({
    id: quoteEventId,
    order_id: id,
    event_type: "quoted",
    payload: {
      action: "quote_published",
      idempotency_key: input.idempotency_key,
      request_fingerprint: fingerprint,
      diagnosis_hash: mockQuoteFingerprint(diagnosis),
      fault_prices_hash: mockQuoteFingerprint(JSON.stringify(faults)),
      updated_at_before: input.expected_updated_at,
      updated_at_after: now,
      quotation_amount: quotation,
      deposit_amount: order.deposit_amount,
      paid_amount: paidAmount,
      balance_amount: order.balance_amount,
      is_paid: order.is_paid,
      payment_status: order.payment_status,
      item_count: faults.length,
      price_exception_kind: input.price_exception?.kind ?? null,
      approval_reset: approvalReset,
      from,
      to: "quoted",
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });

  return {
    ok: true,
    code: "published",
    quote_event_id: quoteEventId,
    updated_at: now,
    quotation_amount: quotation,
    deposit_amount: order.deposit_amount,
    paid_amount: paidAmount,
    balance_amount: order.balance_amount,
    is_paid: order.is_paid,
    payment_status: order.payment_status ?? "unpaid",
    status: order.status,
    approval_status: order.approval_status,
    approval_flow_status: order.approval_flow_status ?? "not_required",
    approval_reset: approvalReset,
    replayed: false,
  };
}

export async function confirmOrderQuoteSent(
  id: string,
  input: ConfirmOrderQuoteSentInput,
  operator: MockOperator = "前台",
): Promise<ConfirmOrderQuoteSentResult> {
  const order = orders.find((item) => item.id === id);
  if (!order) throw new Error("工单不存在");
  assertMockRoutineMutationAllowed(order);
  if (
    typeof operator !== "string" &&
    !operator.isSystem &&
    (!can(operator, "order:quote_prepare") || !can(operator, "customer:message"))
  ) {
    throw new ForbiddenError("当前员工没有发送报价权限");
  }
  const fingerprint = JSON.stringify({
    actor: typeof operator === "string" ? operator : operator.id,
    order: id,
    quote: input.quote_event_id,
    expected: input.expected_updated_at,
    body: input.message_body.trim(),
  });
  const replay = extraEvents.find(
    (event) =>
      event.order_id === id &&
      event.event_type === "approval_sent" &&
      event.payload.idempotency_key === input.idempotency_key,
  );
  if (replay) {
    if (replay.payload.request_fingerprint !== fingerprint) {
      throw new Error("该操作标识已用于不同请求，请刷新后重试");
    }
    return {
      ok: true,
      code: "idempotent_replay",
      message_id: String(replay.payload.message_id),
      quote_event_id: input.quote_event_id,
      updated_at: String(replay.payload.updated_at_after),
      from: String(replay.payload.from),
      to: String(replay.payload.to),
      replayed: true,
    };
  }
  if (order.updated_at !== input.expected_updated_at) {
    throw new Error("工单已被其他操作更新，请刷新后比较并重试");
  }
  const latestQuote = [...extraEvents, ...getEvents(id)]
    .filter(
      (event) =>
        event.order_id === id &&
        event.event_type === "quoted" &&
        event.payload.action === "quote_published",
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!latestQuote || latestQuote.id !== input.quote_event_id) {
    throw new Error("该报价已不是最新版本，请刷新后重新打开通知");
  }
  if (
    latestQuote.payload.diagnosis_hash !==
      mockQuoteFingerprint((order.diagnosis_result ?? "").trim()) ||
    latestQuote.payload.fault_prices_hash !==
      mockQuoteFingerprint(JSON.stringify(order.fault_prices))
  ) {
    throw new Error("报价内容已变化，请刷新后重新发布报价");
  }
  const message = input.message_body.trim();
  if (!message || message.length > 8000) throw new Error("通知内容无效");
  const from = order.status;
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();
  order.status = "waiting_approval";
  order.workflow_status = "quote";
  order.approval_status = "pending";
  order.approval_flow_status = "waiting_customer";
  order.approval_sent_at = now;
  order.approval_confirmed_at = undefined;
  order.notify_status = "sent";
  order.updated_at = now;
  extraMessages.unshift({
    id: messageId,
    order_id: id,
    channel: "whatsapp",
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  extraEvents.unshift({
    id: crypto.randomUUID(),
    order_id: id,
    event_type: "approval_sent",
    payload: {
      action: "quote_sent_confirmed",
      idempotency_key: input.idempotency_key,
      request_fingerprint: fingerprint,
      quote_event_id: input.quote_event_id,
      message_id: messageId,
      updated_at_after: now,
      from,
      to: "waiting_approval",
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return {
    ok: true,
    code: "confirmed",
    message_id: messageId,
    quote_event_id: input.quote_event_id,
    updated_at: now,
    from,
    to: "waiting_approval",
    replayed: false,
  };
}

function mockQuoteFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// GET /api/customers/suggest?q=
export async function createOrder(
  input: CreateOrderInput,
  operator: MockOperator = "前台",
): Promise<{ id: string; replayed?: boolean }> {
  const operationId = input.operation_id?.trim();
  if (operationId) {
    const existing = findCreatedOrderByOperationId(operationId);
    if (existing) return { id: existing.id, replayed: true };
  }
  const requestedStatus = workflowStatuses.find((status) => status.code === input.status);
  if (requestedStatus && (!requestedStatus.enabled || !requestedStatus.allowed_for_create)) {
    throw new Error(`「${requestedStatus.label}」不能作为新建工单状态`);
  }
  const resolvedStatus =
    requestedStatus ??
    workflowStatuses.find((item) => item.enabled && item.is_default_create_status);
  if (!resolvedStatus) throw new Error("店铺没有可用于新建工单的状态");
  if (resolvedStatus.bucket === "custom") {
    throw new Error("自定义状态尚未绑定主流程阶段，当前不能用于新建工单");
  }
  const status = resolvedStatus.code;
  if (input.device_id && !input.customer_id) throw new Error("选择现有设备时必须同时选择客户");
  const deviceCustodyStatus = input.device_custody_status ?? DEVICE_CUSTODY_WITH_SHOP;

  let customer = input.customer_id ? getCustomer(input.customer_id) : undefined;
  let customerSnapshotSource: NonNullable<RepairOrder["customer_identity_snapshot_source"]> =
    customer ? "selected" : "created";
  if (input.customer_id && !customer) throw new Error("读取客户失败");
  let customerContactPhones = customer?.contact_phones ?? [];
  if (customer && input.customer_phone?.trim()) {
    const phoneBook = normalizePhoneBook(input.customer_phone, customer.contact_phones);
    const primaryRaw = phoneBook.primaryRaw || customer.phone_raw;
    customerContactPhones = mergeContactPhones(
      customer.contact_phones,
      phoneBook.contacts,
      primaryRaw,
    );
    customer.contact_phones = customerContactPhones;
  }
  if (!customer) {
    if (!input.customer_phone?.trim()) {
      throw new Error("客户手机号不能为空");
    }
    const phoneBook = normalizePhoneBook(input.customer_phone);
    const raw = phoneBook.primaryRaw;
    if (!raw) throw new Error("手机号格式不正确");
    const phoneCandidates = customers.filter((item) => item.phone_raw === raw);
    const resolution = input.customer_identity_resolution ?? { mode: "auto" as const };
    const normalizedName = input.customer_name?.trim().toLocaleLowerCase("it-IT") ?? "";
    if (resolution.mode === "use_existing") {
      customer = phoneCandidates.find((item) => item.id === resolution.customer_id);
      if (!customer) throw new Error("客户身份确认已失效，请重新检查");
      customerSnapshotSource = "selected";
    } else if (resolution.mode === "create_distinct_shared_phone") {
      customer = undefined;
      customerSnapshotSource = "shared_phone";
    } else if (
      phoneCandidates.length === 1 &&
      (!normalizedName ||
        phoneCandidates[0]?.name.trim().toLocaleLowerCase("it-IT") === normalizedName)
    ) {
      customer = phoneCandidates[0];
      customerSnapshotSource = "selected";
    } else if (phoneCandidates.length > 0) {
      throw Object.assign(new Error("电话号码与客户姓名不一致"), {
        status: 409,
        code: "CUSTOMER_IDENTITY_CONFLICT",
        details: {
          conflictToken: crypto.randomUUID(),
          allowedResolutions: ["use_existing", "create_distinct_shared_phone"],
          candidates: phoneCandidates.map((item) => ({
            customerId: item.id,
            displayName: item.name,
          })),
        },
      });
    }
    if (!customer) {
      customer = {
        id: mockId("cus_new"),
        name: input.customer_name?.trim() ?? "",
        phone_raw: raw,
        phone_e164: phoneBook.primary,
        contact_phones: phoneBook.contacts,
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
      };
      customers.push(customer);
      customerContactPhones = phoneBook.contacts;
    } else {
      customerContactPhones = mergeContactPhones(customer.contact_phones, phoneBook.contacts, raw);
      customer.contact_phones = customerContactPhones;
    }
  }
  let device = input.device_id ? getDevice(input.device_id) : undefined;
  if (input.device_id && !device) throw new Error("读取设备失败");
  if (device && device.customer_id !== customer.id) throw new Error("设备不属于当前客户");
  if (!device) {
    if (!input.device_brand?.trim() || !input.device_model?.trim()) {
      throw new Error("设备品牌和型号不能为空");
    }
    device = {
      id: mockId("dev_new"),
      customer_id: customer.id,
      brand: input.device_brand.trim(),
      model: input.device_model.trim(),
      serial_or_imei: input.device_imei?.trim() ?? "",
      device_notes: input.device_notes?.trim() || undefined,
    };
    devices.push(device);
  }
  const validFaults = input.fault_prices
    .filter((item) => item.name.trim() && Number(item.price) >= 0)
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      price: Number(item.price),
      currency_code: CURRENCY_CODE,
    }));
  const quotation = validFaults.reduce((s, f) => s + (f.price || 0), 0);
  const deposit = input.deposit_amount ?? 0;
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");
  const id = mockId("ord_new");
  const seq = orders.length + 1;
  const now = new Date().toISOString();
  const balance = Math.max(0, quotation - deposit);
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const deviceUnlock = normalizeDeviceUnlockInput(
    normalizeUnlockForCustody(deviceCustodyStatus, input.device_unlock),
  );
  const warranty = normalizeWarrantyPayload({
    warranty_months: input.warranty_months,
    warranty_text: input.warranty_text,
    warranty_change_reason: input.warranty_change_reason,
    defaultWarrantyMonths: 6,
  });
  const warrantyChangedFromDefault = warrantyReasonRequired(warranty.warranty_months, 6);
  const newOrder: RepairOrder = {
    id,
    public_no: `R${(2026000 + seq).toString().padStart(7, "0")}`,
    order_type: input.order_type,
    status,
    legacy_status: status,
    workflow_status: workflowStatusFromLegacyStatus(status),
    exception_status: undefined,
    payment_status: paymentStatusFromMoney({
      isPaid: balance === 0,
      depositAmount: deposit,
      balanceAmount: balance,
    }),
    approval_flow_status: approvalFlowStatusFromLegacyStatus(status),
    parts_status: partsStatusFromLegacyStatus(status),
    notify_status: notifyStatusFromLegacyStatus(status),
    customer_id: customer.id,
    customer_name_snapshot: customer.name,
    customer_phone_snapshot: customer.phone_e164,
    customer_identity_snapshot_source: customerSnapshotSource,
    device_id: device.id,
    issue_description: input.issue_description,
    quotation_amount: quotation,
    deposit_amount: deposit,
    balance_amount: balance,
    currency_code: CURRENCY_CODE,
    is_paid: balance === 0,
    approval_status: "pending",
    technician_name: operatorName(operator),
    internal_tag: tagInput.internalTag,
    accessory_notes: tagInput.accessoryNotes,
    device_custody_status: deviceCustodyStatus,
    device_unlock_method: deviceUnlock.method ?? undefined,
    device_unlock_value: deviceUnlock.value ?? undefined,
    device_unlock_pattern: deviceUnlock.pattern ?? undefined,
    warranty_text: warranty.warranty_text,
    warranty_months: warranty.warranty_months,
    warranty_change_reason: warranty.warranty_change_reason,
    warranty_changed_by:
      warrantyChangedFromDefault && typeof operator !== "string" ? operator.id : undefined,
    warranty_changed_at: warrantyChangedFromDefault ? now : undefined,
    contact_phones: customerContactPhones,
    fault_prices: validFaults,
    device_snapshot: {
      brand: device.brand,
      model: device.model,
      serial_or_imei: device.serial_or_imei,
      ...(device.device_notes ? { device_notes: device.device_notes } : {}),
    },
    created_at: now,
    updated_at: now,
  };
  orders.unshift(newOrder);
  extraEvents.unshift({
    id: `evt_created_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    order_id: id,
    event_type: "created",
    payload: {
      type: input.order_type,
      ...(operationId ? { operation_id: operationId } : {}),
      device_custody_status: deviceCustodyStatus,
      device_unlock_method: deviceUnlock.method,
      warranty_months: warranty.warranty_months,
      warranty_text: warranty.warranty_text,
      warranty_change_reason: warranty.warranty_change_reason ?? null,
    },
    operator_name: operatorName(operator),
    created_at: now,
  });
  return { id };
}

export async function getOrderCreateOperationStatus(
  operationId: string,
): Promise<{ status: "pending" } | { status: "created"; id: string }> {
  const existing = findCreatedOrderByOperationId(operationId);
  return existing ? { status: "created", id: existing.id } : { status: "pending" };
}

function findCreatedOrderByOperationId(operationId: string): { id: string } | null {
  const event = extraEvents.find(
    (item) =>
      item.event_type === "created" &&
      typeof item.payload === "object" &&
      item.payload !== null &&
      !Array.isArray(item.payload) &&
      (item.payload as Record<string, unknown>).operation_id === operationId,
  );
  return event?.order_id ? { id: event.order_id } : null;
}
