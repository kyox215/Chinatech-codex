import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  isApprovalOverdue,
  isPickupOverdue,
} from "@/lib/mock/workflow";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { CURRENCY_CODE, normalizePositiveCentAmount } from "@/lib/money";
import { resolveWhatsappPhone } from "@/shared/lib/whatsapp-phone";
import type {
  AuditActor,
  CorrectTerminalOrderInput,
  CreateOrderInput,
  DeviceSnapshot,
  DeviceCustodyStatus,
  OrderDetail,
  OrderCapabilities,
  OrderListFilters,
  OrderListItem,
  OrderAssigneeOption,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
  OrderTerminalOperationResult,
  OrderApprovalDecisionInput,
  OrderApprovalDecisionResult,
  OrderAttachment,
  OrderAttachmentUploadInput,
  OrderAttachmentUploadResult,
  OrderWorkflowStatusCode,
  OrderWorkflow,
  OrderWorkflowStatus,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusEnabledInput,
  OrderWorkflowStatusReorderInput,
  OrderWorkflowStatusUpdateInput,
  OrderWorkflowTransition,
  OrderWorkflowTransitionsUpdateInput,
  OrderWhatsappTemplateKind,
  PaymentResult,
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  RepairDeskOptions,
  ReopenOrderInput,
  Supplier,
  UpdateOrderInput,
  VoidOrderInput,
  UpdateOrderCustodyInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { normalizeDeviceUnlockInput } from "@/features/orders/model/device-unlock";
import {
  DEVICE_CUSTODY_WITH_CUSTOMER,
  DEVICE_CUSTODY_WITH_SHOP,
  deviceCustodyAllowsChange,
  deviceCustodyAllowsStatus,
  deviceCustodyBlocksStatus,
  isDeviceCustodyStatus,
  normalizeUnlockForCustody,
} from "@/features/orders/model/device-custody";
import { normalizeOrderTagInput } from "@/features/orders/model/order-tags";
import { assertNewOrderExpectedStore } from "@/features/orders/model/new-order-store-session";
import {
  deriveOrderFinancialState,
  isOrderCancelled,
  isOrderCancelledState,
  isOrderCancelledForPayment,
  isOrderPaymentCollectible,
} from "@/features/orders/model/order-payment-state";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
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
  normalizeWarrantyMonths,
  normalizeWarrantyPayload,
  parseWarrantyMonths,
  warrantyReasonRequired,
} from "@/features/orders/model/order-warranty";
import {
  createFallbackRepairOrderPublicNo,
  isRepairOrderPublicNoInsertError,
  normalizeGeneratedRepairOrderPublicNo,
} from "@/features/orders/model/order-public-no";
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import {
  canRunExactArchiveOrderSearch,
  classifyOrderSearchQuery,
} from "@/features/orders/model/order-search-query";
import {
  ORDER_SELECT,
  REPAIR_ORDER_CUSTOMER_EMBED,
  REPAIR_ORDER_DEVICE_EMBED,
  type DbRecord,
  attachmentFromRow,
  customerFromRow,
  decorate,
  deviceFromRow,
  eventFromRow,
  fail,
  failStorageOperation,
  fetchOrderListIndexRows,
  fetchOrderRows,
  fetchOrderRowsByIds,
  isMissingRepairOrderColumnError,
  maybeString,
  messageFromRow,
  money,
  operatorNameFromActor,
  orderFromRow,
  requiredString,
  snapshotFromDevice,
  requireStoreIdFromActor,
  stringArray,
  supplierFromRow,
} from "@/server/repairdesk-shared";
import { assertStaffRole, ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";
import { isRepairDeskE2eSystemActor } from "@/shared/lib/e2e-auth-bypass";
import {
  deviceLabelMatchesSearch,
  hasOrderAmountAnomaly,
  resolveRepairServiceCatalogItem,
} from "@/entities/order";
import {
  isOrderCostsEnabled,
  isPartsProcurementEnabled,
} from "@/features/orders/server/order-cost-feature";
import { isOrderArchivedForQueue } from "@/features/orders/model/order-list-visibility";
import {
  countOrderQueueGroups,
  getOrderQueueGroup,
} from "@/features/orders/model/order-queue-classification";
import {
  compareOrdersForQueue,
  countOrderResultGroups,
} from "@/features/orders/model/order-list-grouping";

function isTechnicianActor(actor?: AuditActor) {
  return !actor?.isSystem && (actor?.storeRole ?? actor?.role) === "technician";
}

export function isOrderInActorScope(
  order: Pick<OrderListItem, "assignee_membership_id">,
  actor?: AuditActor,
) {
  if (!isTechnicianActor(actor)) return true;
  return Boolean(
    actor?.activeMembershipId && order.assignee_membership_id === actor.activeMembershipId,
  );
}

function assertOrderInActorScope(
  order:
    | (Pick<OrderListItem, "assignee_membership_id"> & {
        technician_name?: string;
        __assignment_supported?: boolean;
      })
    | DbRecord,
  actor?: AuditActor,
) {
  if (!isTechnicianActor(actor)) return;
  if (!actor?.activeMembershipId) throw new ForbiddenError("当前工单未分配给你");
  const hasStableAssignment =
    order.__assignment_supported === true ||
    Object.prototype.hasOwnProperty.call(order, "assignee_membership_id");
  const inScope =
    hasStableAssignment && maybeString(order.assignee_membership_id) === actor.activeMembershipId;
  if (!inScope) throw new ForbiddenError("当前工单未分配给你");
}

function scopeOrderRowsForActor<T extends DbRecord>(rows: T[], actor?: AuditActor) {
  if (!isTechnicianActor(actor)) return rows;
  if (!actor?.activeMembershipId) return [];

  return rows.filter((row) => {
    const hasStableAssignment =
      row.__assignment_supported === true ||
      Object.prototype.hasOwnProperty.call(row, "assignee_membership_id");
    return (
      hasStableAssignment && maybeString(row.assignee_membership_id) === actor.activeMembershipId
    );
  });
}

type ActorOrderListFilters = OrderListFilters;

function canSearchOrderArchive(actor?: AuditActor) {
  return can(actor, "order:archive_search", {
    scopeSatisfied: !isTechnicianActor(actor) || Boolean(actor?.activeMembershipId),
  });
}

function resolveOrderListView(filters: OrderListFilters, actor?: AuditActor) {
  const requestedView = filters.view ?? "active";

  if (requestedView !== "active") {
    if (!can(actor, "order:archive_browse")) {
      throw new ForbiddenError("当前角色无权浏览历史归档");
    }
    return requestedView;
  }
  if (filters.searchScope === "archive_exact") {
    if (!canRunExactArchiveOrderSearch(filters.search)) return "active" as const;
    if (!canSearchOrderArchive(actor)) {
      throw new ForbiddenError("当前角色无权精确搜索历史工单");
    }
    return "all" as const;
  }
  return requestedView;
}

function filtersForActor(filters: OrderListFilters, actor?: AuditActor): ActorOrderListFilters {
  if (
    filters.financialReview &&
    !can(actor, "finance:aggregate_read") &&
    !isRepairDeskE2eSystemActor(actor)
  ) {
    throw new ForbiddenError("当前角色无权查看整店金额复核结果");
  }
  const canReadSuppliers = can(actor, "supplier:read");
  return {
    ...filtersForSupplierAccess(filters, canReadSuppliers),
    view: resolveOrderListView(filters, actor),
  };
}

function filterOrders(rows: OrderListItem[], filters: ActorOrderListFilters = {}) {
  let result = rows;
  const view = filters.view ?? "active";
  if (view === "active") result = result.filter((order) => !isOrderArchivedForQueue(order));
  if (view === "archive") result = result.filter(isOrderArchivedForQueue);
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    const queryKind = classifyOrderSearchQuery(q);
    const phoneQuery = queryKind === "phone";
    result = result.filter((o) => {
      if (filters.searchScope === "archive_exact" && isOrderArchivedForQueue(o)) {
        const normalizedQueryPhone = normalizePhoneRaw(q);
        return (
          o.public_no.toLowerCase() === q ||
          o.device_imei.toLowerCase() === q ||
          (phoneQuery &&
            normalizedQueryPhone.length >= 6 &&
            [o.customer_phone, ...o.contact_phones].some(
              (phone) => normalizePhoneRaw(phone) === normalizedQueryPhone,
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

  if (filters.completedOnly) {
    result = result.filter((order) => Boolean(order.completed_at));
  }

  if (filters.repairServiceGroups?.length) {
    const groups = new Set<string>(filters.repairServiceGroups);
    result = result.filter((order) =>
      order.fault_prices.some((line) => {
        const catalog = resolveRepairServiceCatalogItem({
          catalogKey: line.catalog_key,
          name: line.name,
        });
        return Boolean(catalog && groups.has(catalog.groupKey));
      }),
    );
  }

  if (filters.dateField && (filters.dateFrom || filters.dateTo)) {
    const timeZone = filters.dateTimeZone?.trim() || "Europe/Rome";
    result = result.filter((order) => {
      const value = order[filters.dateField!];
      if (!value) return false;
      const localDate = toOrderLocalCalendarDate(value, timeZone);
      return (
        (!filters.dateFrom || localDate >= filters.dateFrom) &&
        (!filters.dateTo || localDate <= filters.dateTo)
      );
    });
  }

  if (filters.sortDateField) {
    const field = filters.sortDateField;
    return result.sort((left, right) => {
      const byDate = String(right[field] ?? "").localeCompare(String(left[field] ?? ""));
      return byDate || compareOrdersForQueue(left, right);
    });
  }
  return result.sort(compareOrdersForQueue);
}

function toOrderLocalCalendarDate(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = byType.get("year");
  const month = byType.get("month");
  const day = byType.get("day");
  if (!year || !month || !day) throw new Error("工单日期无法按门店时区解析");
  return `${year}-${month}-${day}`;
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

function filtersForSupplierAccess(filters: OrderListFilters, canReadSuppliers: boolean) {
  if (canReadSuppliers || !filters.supplierIds?.length) return filters;
  return { ...filters, supplierIds: undefined };
}

function applySupplierVisibility<T extends OrderListItem>(order: T, canReadSuppliers: boolean): T {
  if (canReadSuppliers) return order;
  return {
    ...order,
    supplier_id: undefined,
    parts_supplier_id: undefined,
    supplier_name: undefined,
    supplier_color: undefined,
  };
}

function maskContactValue(value: string | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function canReadOrderFinance(actor?: AuditActor, includeRestrictedDetail = false) {
  if (!can(actor, "finance:order_read")) return false;
  return includeRestrictedDetail || can(actor, "finance:aggregate_read");
}

function canReadOrderCustomerContact(actor?: AuditActor) {
  return can(actor, "customer:detail");
}

function canReadOrderUnlock(actor?: AuditActor) {
  return can(actor, "unlock:read");
}

function canReadOrderMessages(actor?: AuditActor) {
  return can(actor, "customer:message");
}

function canReadOrderAttachments(actor?: AuditActor) {
  return can(actor, "attachment:read");
}

export function projectOrderListItemForActor<T extends OrderListItem>(
  order: T,
  actor?: AuditActor,
  options: { includeUnlockSecret?: boolean; includeRestrictedFinance?: boolean } = {},
): T {
  let projected = applySupplierVisibility(order, can(actor, "supplier:read"));

  if (!canReadOrderCustomerContact(actor)) {
    projected = {
      ...projected,
      customer_phone: maskContactValue(projected.customer_phone),
      contact_phones: projected.contact_phones.map(maskContactValue).filter(Boolean),
      customer_contact_redacted: true,
    };
  }

  if (!canReadOrderFinance(actor, options.includeRestrictedFinance)) {
    const {
      quotation_amount: _quotationAmount,
      deposit_amount: _depositAmount,
      balance_amount: _balanceAmount,
      payment_status: _paymentStatus,
      is_paid: _isPaid,
      ...visible
    } = projected;
    projected = {
      ...visible,
      fault_prices: [],
      is_paid: false,
      payment_status: undefined,
      finance_redacted: true,
    } as unknown as T;
  }

  if (!canReadOrderUnlock(actor)) {
    projected = {
      ...projected,
      device_unlock_method: undefined,
      device_unlock_value: undefined,
      device_unlock_pattern: undefined,
      sensitive_redacted: true,
    };
  } else if (!options.includeUnlockSecret) {
    projected = {
      ...projected,
      device_unlock_value: undefined,
      device_unlock_pattern: undefined,
    };
  }

  if (!canReadOrderAttachments(actor)) {
    projected = {
      ...projected,
      customer_signature: undefined,
      sensitive_redacted: true,
    };
  }

  return projected;
}

function projectCustomerForActor(
  customer: OrderDetail["customer"],
  actor?: AuditActor,
): OrderDetail["customer"] {
  if (!customer || canReadOrderCustomerContact(actor)) return customer;
  return {
    ...customer,
    phone_e164: maskContactValue(customer.phone_e164),
    phone_raw: maskContactValue(customer.phone_raw),
    contact_phones: customer.contact_phones.map(maskContactValue).filter(Boolean),
    email: undefined,
    notes: undefined,
    marketing_notes: undefined,
    blacklisted_at: undefined,
    consent_marketing: false,
    consent_sms: false,
  };
}

function projectEventsForActor(events: OrderDetail["events"], actor?: AuditActor) {
  const canReadPayloads =
    canReadOrderFinance(actor, true) &&
    canReadOrderMessages(actor) &&
    canReadOrderUnlock(actor) &&
    canReadOrderAttachments(actor);
  if (canReadPayloads) return events;
  return events.map((event) => ({ ...event, payload: {} }));
}

interface OrderCapabilityProjectionOptions {
  hasPaymentLedgerEvidence?: boolean;
  paymentLedgerCheckFailed?: boolean;
}

export function projectOrderDetailForActor(
  detail: OrderDetail,
  actor?: AuditActor,
  capabilityOptions: OrderCapabilityProjectionOptions = {},
): OrderDetail {
  const canReadAttachments = canReadOrderAttachments(actor);
  return {
    ...detail,
    order: projectOrderListItemForActor(detail.order, actor, {
      includeUnlockSecret: true,
      includeRestrictedFinance: true,
    }),
    customer: projectCustomerForActor(detail.customer, actor),
    supplier: can(actor, "supplier:read") ? detail.supplier : undefined,
    parts_supplier: can(actor, "supplier:read") ? detail.parts_supplier : undefined,
    events: projectEventsForActor(detail.events, actor),
    messages: canReadOrderMessages(actor) ? detail.messages : [],
    attachments: canReadAttachments
      ? detail.attachments
      : detail.attachments.map((attachment) => ({
          ...attachment,
          public_url: undefined,
          signed_url: undefined,
          storage_path: "",
        })),
    capabilities: projectOrderCapabilities(detail.order, actor, capabilityOptions),
  };
}

export function projectOrderCapabilities(
  order: OrderListItem,
  actor?: AuditActor,
  options: OrderCapabilityProjectionOptions = {},
): OrderCapabilities {
  const role = actor?.storeRole ?? actor?.role;
  const scopeSatisfied = role === "technician" ? isOrderInActorScope(order, actor) : false;
  const permitted = (action: Parameters<typeof can>[1]) => can(actor, action, { scopeSatisfied });
  const voided = order.record_state === "voided" || Boolean(order.deleted_at);
  const terminal =
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.exception_status === "cancelled" ||
    (order.workflow_bucket !== undefined
      ? order.workflow_bucket === "done" || order.workflow_bucket === "cancelled"
      : order.workflow_status === "closed");
  const routine = !voided && !terminal;
  const quotationAmount = Number(order.quotation_amount ?? 0);
  const depositAmount = Number(order.deposit_amount ?? 0);
  const balanceAmount = Number(order.balance_amount ?? 0);
  const hasPristineFinance =
    !order.is_paid &&
    depositAmount === 0 &&
    quotationAmount >= 0 &&
    balanceAmount >= 0 &&
    quotationAmount === balanceAmount &&
    (order.payment_status ?? "unpaid") === "unpaid";
  const hasVisibleFinancialEvidence = !hasPristineFinance;
  const hasFinancialEvidence =
    hasVisibleFinancialEvidence ||
    Boolean(options.hasPaymentLedgerEvidence) ||
    Boolean(options.paymentLedgerCheckFailed);
  const blockedReasons: OrderCapabilities["blockedReasons"] = {};

  if (voided) {
    for (const key of [
      "editIntake",
      "editRepair",
      "adjustFinance",
      "prepareQuote",
      "sendQuote",
      "collectPayment",
      "transition",
      "confirmCancelledReturn",
      "correct",
      "reopen",
      "void",
    ] as const) {
      blockedReasons[key] = "该记录已作废，历史证据仅供查看";
    }
  } else if (terminal) {
    blockedReasons.editIntake = "已结束工单请使用“纠正记录”";
    blockedReasons.editRepair = "已结束工单请使用“纠正记录”";
    blockedReasons.adjustFinance = "终态财务只能通过后续冲销/退款流程处理";
    blockedReasons.prepareQuote = "已结束工单请先按审计流程重新打开";
    blockedReasons.sendQuote = "已结束工单不能发送新报价";
    blockedReasons.transition = "已结束工单请使用“重新打开”";
  }
  if (isOrderCancelledForPayment(order) && !voided) {
    blockedReasons.collectPayment = "已取消工单的余额仅保留为历史，不能登记收款";
  }
  if (permitted("order:void") && hasFinancialEvidence) {
    blockedReasons.void = "存在财务记录或金额异常，必须先完成核对与冲销/退款";
  }

  return {
    canEditIntake: routine && permitted("order:update_intake"),
    canEditRepair: routine && permitted("order:update_repair"),
    canAdjustFinance: routine && permitted("payment:adjust"),
    canPrepareQuote: routine && permitted("order:quote_prepare"),
    canSendQuote: routine && permitted("order:quote_prepare") && permitted("customer:message"),
    canCollectPayment: isOrderPaymentCollectible(order) && permitted("payment:collect"),
    canTransition: routine && permitted("order:transition"),
    canConfirmCancelledReturn:
      !voided &&
      isOrderCancelledState(order) &&
      order.device_custody_status === DEVICE_CUSTODY_WITH_SHOP &&
      !order.delivered_at &&
      permitted("order:transition"),
    canCreateKioskSession: !voided && permitted("order:update_intake"),
    canCorrect: terminal && !voided && permitted("order:correct"),
    canReopen: terminal && !voided && permitted("order:reopen"),
    canVoid: terminal && !voided && !hasFinancialEvidence && permitted("order:void"),
    canReadInternalCosts:
      !voided &&
      isOrderCostsEnabled() &&
      (permitted("finance:profit_read") || permitted("finance:cost_manage")),
    canManageInternalCosts: !voided && isOrderCostsEnabled() && permitted("finance:cost_manage"),
    canAllocatePartsCosts:
      !voided && isPartsProcurementEnabled() && permitted("inventory:cost_allocate"),
    blockedReasons,
  };
}

function workflowStatusFromRow(row: DbRecord): OrderWorkflowStatus {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    code: requiredString(row.code),
    label: requiredString(row.label),
    short_label: maybeString(row.short_label) || requiredString(row.label),
    tone: (maybeString(row.tone) || "neutral") as OrderWorkflowStatus["tone"],
    bucket: (maybeString(row.bucket) || "custom") as OrderWorkflowStatus["bucket"],
    sort_order: Number(row.sort_order ?? 0),
    enabled: Boolean(row.enabled),
    show_in_order_filters: Boolean(row.show_in_order_filters),
    allowed_for_create: Boolean(row.allowed_for_create),
    is_default_create_status: Boolean(row.is_default_create_status),
    is_system: Boolean(row.is_system),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function workflowTransitionFromRow(row: DbRecord): OrderWorkflowTransition {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    from_status_code: requiredString(row.from_status_code),
    to_status_code: requiredString(row.to_status_code),
    is_primary: Boolean(row.is_primary),
    sort_order: Number(row.sort_order ?? 0),
    enabled: Boolean(row.enabled),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

async function readWorkflowStatuses(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
) {
  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  fail(error, "读取工单状态流失败");
  return ((data ?? []) as DbRecord[]).map(workflowStatusFromRow);
}

async function readWorkflowTransitions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
) {
  const { data, error } = await supabase
    .from("order_workflow_transitions")
    .select("*")
    .eq("store_id", storeId)
    .order("from_status_code", { ascending: true })
    .order("sort_order", { ascending: true });
  fail(error, "读取工单流转关系失败");
  return ((data ?? []) as DbRecord[]).map(workflowTransitionFromRow);
}

async function readWorkflowStatusLabel(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  code: string,
) {
  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .select("label")
    .eq("store_id", storeId)
    .eq("code", code)
    .maybeSingle();
  fail(error, "读取状态名称失败");
  return maybeString((data as DbRecord | null)?.label) || code;
}

async function readWorkflowStatusBucket(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  code: string,
) {
  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .select("bucket")
    .eq("store_id", storeId)
    .eq("code", code)
    .maybeSingle();
  fail(error, "读取当前状态分类失败");
  return maybeString((data as DbRecord | null)?.bucket);
}

function isCanonicalWorkflowStatus(status: string): status is OrderWorkflowStatusCode {
  return orderWorkflowStatuses.includes(status as OrderWorkflowStatusCode);
}

function orderBalanceAmount(row: { balance_amount?: unknown }) {
  return money(row.balance_amount);
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

function faultPriceSignature(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return JSON.stringify(
    rows.map((raw) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return {
        name: String(item.name ?? "").trim(),
        price: money(item.price),
        note: String(item.note ?? "").trim(),
        currency_code: String(item.currency_code ?? CURRENCY_CODE),
      };
    }),
  );
}

function quoteApprovalWasTouched(row: DbRecord) {
  const approvalStatus = maybeString(row.approval_status);
  return (
    approvalStatus === "approved" ||
    approvalStatus === "rejected" ||
    maybeString(row.approval_flow_status) === "waiting_customer" ||
    Boolean(row.approval_sent_at) ||
    Boolean(row.approval_confirmed_at)
  );
}

const quoteReapprovalReopenStatuses = new Set([
  "parts_ordered",
  "parts_arrived",
  "repairing",
  "repaired",
  "notified",
  "waiting_pickup",
]);

function buildQuoteApprovalResetUpdate({
  currentRow,
  nextFaults,
  quotation,
  deposit,
  balance,
}: {
  currentRow: DbRecord;
  nextFaults: unknown[];
  quotation: number;
  deposit: number;
  balance: number;
}): DbRecord {
  const quoteChanged =
    money(currentRow.quotation_amount) !== quotation ||
    money(currentRow.deposit_amount) !== deposit ||
    money(currentRow.balance_amount) !== balance ||
    faultPriceSignature(currentRow.fault_prices) !== faultPriceSignature(nextFaults);

  if (!quoteChanged || !quoteApprovalWasTouched(currentRow)) return {};

  const currentStatus = requiredString(currentRow.status) as RepairOrderStatus;
  const resetUpdate: DbRecord = {
    approval_status: "pending",
    approval_flow_status: approvalFlowStatusFromLegacyStatus(currentStatus, "pending"),
    approval_sent_at: null,
    approval_confirmed_at: null,
  };

  if (quoteReapprovalReopenStatuses.has(currentStatus)) {
    Object.assign(resetUpdate, {
      status: "quoted",
      ...deriveCanonicalUpdateFromLegacyStatus("quoted", new Date().toISOString()),
      approval_status: "pending",
      approval_sent_at: null,
      approval_confirmed_at: null,
    });
  }

  return resetUpdate;
}

function canonicalWorkflowStatusFromBucket(
  bucket: OrderWorkflowStatus["bucket"],
  status: RepairOrderStatus,
): OrderWorkflowStatusCode {
  switch (bucket) {
    case "intake":
      return "intake";
    case "diagnosing":
      return "diagnosis";
    case "quote":
      return "quote";
    case "parts":
      return "parts";
    case "repair":
      return "repair";
    case "pickup":
      return "pickup";
    case "done":
    case "cancelled":
      return "closed";
    case "custom":
      return "intake";
    default:
      return workflowStatusFromLegacyStatus(status);
  }
}

function deriveCanonicalUpdateFromLegacyStatus(
  status: RepairOrderStatus,
  now: string,
  bucket?: OrderWorkflowStatus["bucket"],
) {
  const workflowStatus = bucket
    ? canonicalWorkflowStatusFromBucket(bucket, status)
    : workflowStatusFromLegacyStatus(status);
  const cancelled = status === "cancelled" || bucket === "cancelled";
  const completed = status === "completed" || bucket === "done";
  return {
    workflow_status: workflowStatus,
    exception_status: cancelled
      ? "cancelled"
      : status === "rework"
        ? "rework"
        : status === "unfixed_pickup"
          ? "returned_unfixed"
          : null,
    approval_flow_status: approvalFlowStatusFromLegacyStatus(status),
    parts_status: partsStatusFromLegacyStatus(status),
    notify_status: completed ? "sent" : notifyStatusFromLegacyStatus(status),
    ...(!completed && !cancelled ? { completed_at: null, delivered_at: null } : {}),
    ...(status === "waiting_approval" ? { approval_sent_at: now } : {}),
  };
}

type OrderTransitionValidationResult =
  | { ok: true; label?: string; bucket: OrderWorkflowStatus["bucket"] }
  | { ok: false; reason: string };

async function validateManualOrderTransitionTarget(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  from: RepairOrderStatus,
  to: RepairOrderStatus,
): Promise<OrderTransitionValidationResult> {
  if (from === to) return { ok: false, reason: "目标状态与当前一致" };

  const { data: target, error: targetError } = await supabase
    .from("order_workflow_statuses")
    .select("code,label,bucket,enabled")
    .eq("store_id", storeId)
    .eq("code", to)
    .maybeSingle();
  fail(targetError, "读取目标状态失败");
  if (!target) return { ok: false, reason: "目标状态不存在" };
  if (!(target as DbRecord).enabled) {
    const toLabel = maybeString((target as DbRecord).label) || to;
    return { ok: false, reason: `「${toLabel}」已停用，不能流转到该状态` };
  }
  const bucket = (maybeString((target as DbRecord).bucket) ||
    "custom") as OrderWorkflowStatus["bucket"];
  if (bucket === "custom") {
    return {
      ok: false,
      reason: "自定义状态尚未绑定主流程阶段，当前不能用于工单流转",
    };
  }
  return {
    ok: true,
    label: maybeString((target as DbRecord).label) || to,
    bucket,
  };
}

async function validateConfiguredOrderTransition(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  from: RepairOrderStatus,
  to: RepairOrderStatus,
): Promise<OrderTransitionValidationResult> {
  const target = await validateManualOrderTransitionTarget(supabase, storeId, from, to);
  if (!target.ok) return target;

  const { data: transition, error } = await supabase
    .from("order_workflow_transitions")
    .select("enabled")
    .eq("store_id", storeId)
    .eq("from_status_code", from)
    .eq("to_status_code", to)
    .maybeSingle();
  fail(error, "检查状态流转失败");
  if (!transition || !(transition as DbRecord).enabled) {
    const fromLabel = await readWorkflowStatusLabel(supabase, storeId, from);
    const toLabel = target.label;
    return { ok: false, reason: `「${fromLabel}」不能直接流转到「${toLabel}」` };
  }
  return target;
}

async function assertWorkflowTargetEnabled(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  code: RepairOrderStatus,
) {
  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .select("label,bucket,enabled")
    .eq("store_id", storeId)
    .eq("code", code)
    .maybeSingle();
  fail(error, "读取目标状态失败");
  if (!data) throw new Error("目标状态不存在");
  const row = data as DbRecord;
  if (!row.enabled) {
    const label = maybeString(row.label) || code;
    throw new Error(`「${label}」已停用，不能流转到该状态`);
  }
  return {
    bucket: (maybeString(row.bucket) || "custom") as OrderWorkflowStatus["bucket"],
    label: maybeString(row.label) || code,
  };
}

async function resolveInitialOrderStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  requested: RepairOrderStatus,
) {
  const { data: requestedStatus, error } = await supabase
    .from("order_workflow_statuses")
    .select("code,bucket,allowed_for_create,enabled")
    .eq("store_id", storeId)
    .eq("code", requested)
    .maybeSingle();
  fail(error, "检查初始状态失败");

  if (requestedStatus) {
    const row = requestedStatus as DbRecord;
    if (Boolean(row.enabled) && Boolean(row.allowed_for_create)) {
      const bucket = (maybeString(row.bucket) || "custom") as OrderWorkflowStatus["bucket"];
      if (bucket === "custom") {
        throw new Error("自定义状态尚未绑定主流程阶段，当前不能用于新建工单");
      }
      return {
        code: requiredString(row.code) as RepairOrderStatus,
        bucket,
      };
    }
    throw new Error("初始状态不允许用于新建工单");
  }

  const { data: defaultStatus, error: defaultError } = await supabase
    .from("order_workflow_statuses")
    .select("code,bucket")
    .eq("store_id", storeId)
    .eq("enabled", true)
    .eq("allowed_for_create", true)
    .order("is_default_create_status", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  fail(defaultError, "读取默认初始状态失败");

  if (defaultStatus) {
    const row = defaultStatus as DbRecord;
    const bucket = (maybeString(row.bucket) || "custom") as OrderWorkflowStatus["bucket"];
    if (bucket === "custom") {
      throw new Error("自定义状态尚未绑定主流程阶段，当前不能用于新建工单");
    }
    return {
      code: requiredString(row.code) as RepairOrderStatus,
      bucket,
    };
  }
  if (ORDER_STATUS_ALLOWED_FOR_CREATE.includes(requested)) {
    return {
      code: requested,
      bucket: "intake" as const,
    };
  }
  throw new Error("店铺没有可用于新建工单的状态");
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

function contactPhonesChanged(left: string[], right: string[]) {
  if (left.length !== right.length) return true;
  return left.some((phone, index) => phone !== right[index]);
}

async function assertCustomerPhoneAvailable(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerId: string,
  primaryRaw: string,
  contactPhones: string[],
) {
  const raws = Array.from(
    new Set([
      primaryRaw,
      ...contactPhones.map((phone) => normalizePhoneRaw(phone)).filter(Boolean),
    ]),
  );
  if (raws.length === 0) return;
  const { data, error } = await supabase
    .from("customers")
    .select("id,phone_raw")
    .eq("store_id", storeId)
    .in("phone_raw", raws);
  fail(error, "检查客户手机号失败");
  const conflicts = ((data ?? []) as DbRecord[]).filter(
    (row) => requiredString(row.id) !== customerId,
  );
  if (conflicts.length === 0) return;
  if (conflicts.some((row) => requiredString(row.phone_raw) === primaryRaw)) {
    throw new Error("该手机号已存在客户档案");
  }
  throw new Error("备用号码已属于其他客户档案，请先确认客户资料");
}

function normalizePageInput(input: OrderListPageInput = {}) {
  const page = Math.max(1, Math.floor(Number(input.page ?? 1)));
  const pageSize = Math.min(50, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
  return { page, pageSize };
}

function deriveOrderStatsFromRows(rows: OrderListItem[]): OrderStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  return {
    total: rows.length,
    today: rows.filter((order) => new Date(order.created_at).getTime() >= todayMs).length,
    inProgress: rows.filter(
      (order) =>
        (order.workflow_status ?? workflowStatusFromLegacyStatus(order.status)) !== "closed",
    ).length,
    unpaid: rows.filter((order) => deriveOrderFinancialState(order).collectible).length,
    approvalOverdue: rows.filter((order) => order.approval_overdue).length,
    pickupOverdue: rows.filter((order) => order.pickup_overdue).length,
  };
}

export async function listOrders(
  filters: OrderListFilters = {},
  actor?: AuditActor,
): Promise<OrderListItem[]> {
  const storeId = requireStoreIdFromActor(actor);
  const safeFilters = filtersForActor(filters, actor);
  const rows = scopeOrderRowsForActor(await fetchOrderRows(storeId), actor).map(decorate);
  const filtered = filterOrders(rows, safeFilters);
  const bounded = safeFilters.searchScope === "archive_exact" ? filtered.slice(0, 20) : filtered;
  return bounded.map((order) => projectOrderListItemForActor(order, actor));
}

export async function listOrdersPage(
  input: OrderListPageInput = {},
  actor?: AuditActor,
): Promise<OrderListResult> {
  const storeId = requireStoreIdFromActor(actor);
  const { page, pageSize } = normalizePageInput(input);
  const filters: OrderListFilters = {
    search: input.search,
    searchScope: input.searchScope,
    deviceSearch: input.deviceSearch,
    view: input.view,
    statuses: input.statuses,
    workflowStatuses: input.workflowStatuses,
    queueGroups: input.queueGroups,
    exceptionStatuses: input.exceptionStatuses,
    paymentStatuses: input.paymentStatuses,
    partsStatuses: input.partsStatuses,
    approvalFlowStatuses: input.approvalFlowStatuses,
    types: input.types,
    technicians: input.technicians,
    supplierIds: input.supplierIds,
    paid: input.paid,
    overdue: input.overdue,
    financialReview: input.financialReview,
    dateField: input.dateField,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    dateTimeZone: input.dateTimeZone,
    repairServiceGroups: input.repairServiceGroups,
    completedOnly: input.completedOnly,
    sortDateField: input.sortDateField,
  };
  const safeFilters = filtersForActor(filters, actor);
  const technicianMembershipId = isTechnicianActor(actor) ? actor?.activeMembershipId : undefined;
  const indexRows =
    isTechnicianActor(actor) && !technicianMembershipId
      ? []
      : await fetchOrderListIndexRows(storeId, {
          view: safeFilters.view ?? "active",
          assigneeMembershipId: technicianMembershipId,
        });
  const rows = scopeOrderRowsForActor(indexRows, actor).map(decorate);
  const filtered = filterOrders(rows, safeFilters);
  const bounded = safeFilters.searchScope === "archive_exact" ? filtered.slice(0, 20) : filtered;
  const workflowCounts = countWorkflowRows(
    filterOrders(rows, filtersForWorkflowCounts(safeFilters)),
  );
  const queueCounts = countOrderQueueGroups(filterOrders(rows, filtersForQueueCounts(safeFilters)));
  const resultGroupCounts = countOrderResultGroups(bounded);
  const effectivePage = safeFilters.searchScope === "archive_exact" ? 1 : page;
  const effectivePageSize = safeFilters.searchScope === "archive_exact" ? 20 : pageSize;
  const start = (effectivePage - 1) * effectivePageSize;
  const pageIndexRows = bounded.slice(start, start + effectivePageSize);
  const pageIds = pageIndexRows.map((order) => order.id);
  const pageRows = scopeOrderRowsForActor(
    await fetchOrderRowsByIds(storeId, pageIds, technicianMembershipId),
    actor,
  ).map(decorate);
  const pageRowsById = new Map(pageRows.map((order) => [order.id, order]));
  const items = pageIds
    .map((id) => pageRowsById.get(id))
    .filter((order): order is OrderListItem => Boolean(order))
    .map((order) => projectOrderListItemForActor(order, actor));

  return {
    items,
    total: bounded.length,
    page: effectivePage,
    pageSize: effectivePageSize,
    pageCount:
      safeFilters.searchScope === "archive_exact"
        ? 1
        : Math.max(1, Math.ceil(bounded.length / effectivePageSize)),
    workflowCounts,
    queueCounts,
    resultGroupCounts,
  };
}

export async function getOrderStats(actor?: AuditActor): Promise<OrderStats> {
  const storeId = requireStoreIdFromActor(actor);
  const scopedRows = scopeOrderRowsForActor(await fetchOrderRows(storeId), actor).map(decorate);
  return deriveOrderStatsFromRows(scopedRows.filter((order) => !isOrderArchivedForQueue(order)));
}

export async function listOrderWorkflow(actor?: AuditActor): Promise<OrderWorkflow> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const [statuses, transitions] = await Promise.all([
    readWorkflowStatuses(supabase, storeId),
    readWorkflowTransitions(supabase, storeId),
  ]);
  return { statuses, transitions };
}

export async function createOrderWorkflowStatus(
  input: OrderWorkflowStatusCreateInput,
  actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  assertStaffRole(actor ?? { displayName: "系统", isSystem: true }, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const code = input.code.trim().toLowerCase();
  const label = input.label.trim();
  const isDefault = Boolean(input.is_default_create_status);
  const enabled = input.enabled ?? true;

  const sortOrder =
    input.sort_order ??
    (await readWorkflowStatuses(supabase, storeId)).reduce(
      (max, status) => Math.max(max, status.sort_order),
      0,
    ) + 10;

  if (isDefault) {
    const { error } = await supabase
      .from("order_workflow_statuses")
      .update({ is_default_create_status: false, updated_at: now, updated_by: actor?.id ?? null })
      .eq("store_id", storeId);
    fail(error, "更新默认状态失败");
  }

  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      code,
      label,
      short_label: input.short_label?.trim() || label.slice(0, 4),
      tone: input.tone,
      bucket: input.bucket,
      sort_order: sortOrder,
      enabled: isDefault ? true : enabled,
      show_in_order_filters: input.show_in_order_filters ?? true,
      allowed_for_create: isDefault ? true : (input.allowed_for_create ?? false),
      is_default_create_status: isDefault,
      is_system: false,
      created_by: actor?.id ?? null,
      updated_by: actor?.id ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  fail(error, "创建工单状态失败");
  return workflowStatusFromRow(data as DbRecord);
}

export async function updateOrderWorkflowStatus(
  id: string,
  input: OrderWorkflowStatusUpdateInput,
  actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  assertStaffRole(actor ?? { displayName: "系统", isSystem: true }, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();

  const { data: current, error: readError } = await supabase
    .from("order_workflow_statuses")
    .select("*")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取状态失败");
  const currentStatus = workflowStatusFromRow(current as DbRecord);
  if (currentStatus.is_default_create_status && input.enabled === false) {
    throw new Error("默认新建状态不能停用");
  }
  if (currentStatus.is_default_create_status && input.is_default_create_status === false) {
    throw new Error("请先把另一个状态设为默认新建状态");
  }

  const now = new Date().toISOString();
  if (input.is_default_create_status) {
    const { error } = await supabase
      .from("order_workflow_statuses")
      .update({ is_default_create_status: false, updated_at: now, updated_by: actor?.id ?? null })
      .eq("store_id", storeId)
      .neq("id", id);
    fail(error, "更新默认状态失败");
  }

  const update: DbRecord = { updated_at: now, updated_by: actor?.id ?? null };
  if (input.label !== undefined) update.label = input.label.trim();
  if (input.short_label !== undefined) update.short_label = input.short_label.trim();
  if (input.tone !== undefined) update.tone = input.tone;
  if (input.bucket !== undefined) update.bucket = input.bucket;
  if (input.sort_order !== undefined) update.sort_order = input.sort_order;
  if (input.enabled !== undefined)
    update.enabled = input.is_default_create_status ? true : input.enabled;
  if (input.show_in_order_filters !== undefined)
    update.show_in_order_filters = input.show_in_order_filters;
  if (input.allowed_for_create !== undefined)
    update.allowed_for_create = input.is_default_create_status ? true : input.allowed_for_create;
  if (input.is_default_create_status !== undefined) {
    update.is_default_create_status = input.is_default_create_status;
    if (input.is_default_create_status) {
      update.enabled = true;
      update.allowed_for_create = true;
    }
  }

  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .update(update)
    .eq("store_id", storeId)
    .eq("id", id)
    .select("*")
    .single();
  fail(error, "保存状态失败");
  return workflowStatusFromRow(data as DbRecord);
}

export async function reorderOrderWorkflowStatuses(
  input: OrderWorkflowStatusReorderInput,
  actor?: AuditActor,
): Promise<OrderWorkflow> {
  assertStaffRole(actor ?? { displayName: "系统", isSystem: true }, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  for (const item of input.items) {
    const { error } = await supabase
      .from("order_workflow_statuses")
      .update({ sort_order: item.sort_order, updated_at: now, updated_by: actor?.id ?? null })
      .eq("store_id", storeId)
      .eq("id", item.id);
    fail(error, "更新状态排序失败");
  }

  return listOrderWorkflow(actor);
}

export async function setOrderWorkflowStatusEnabled(
  input: OrderWorkflowStatusEnabledInput,
  actor?: AuditActor,
): Promise<OrderWorkflowStatus> {
  return updateOrderWorkflowStatus(input.id, { enabled: input.enabled }, actor);
}

export async function updateOrderWorkflowTransitions(
  input: OrderWorkflowTransitionsUpdateInput,
  actor?: AuditActor,
): Promise<OrderWorkflow> {
  assertStaffRole(actor ?? { displayName: "系统", isSystem: true }, ["owner", "manager"]);
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const statuses = await readWorkflowStatuses(supabase, storeId);
  const from = statuses.find((status) => status.code === input.from_status_code);
  if (!from) throw new Error("来源状态不存在");

  const byTarget = new Map(input.transitions.map((item) => [item.to_status_code, item]));
  const enabledTargets = statuses
    .filter((status) => status.code !== from.code)
    .map((status, index) => {
      const requested = byTarget.get(status.code);
      return {
        to_status_code: status.code,
        enabled: Boolean(requested?.enabled),
        is_primary: Boolean(requested?.enabled && requested?.is_primary),
        sort_order: requested?.sort_order ?? (index + 1) * 10,
      };
    });
  const primaryIndex = enabledTargets.findIndex((target) => target.enabled && target.is_primary);
  const firstEnabledIndex = enabledTargets.findIndex((target) => target.enabled);
  enabledTargets.forEach((target, index) => {
    target.is_primary =
      target.enabled && (primaryIndex >= 0 ? index === primaryIndex : index === firstEnabledIndex);
  });

  const { error: disableError } = await supabase
    .from("order_workflow_transitions")
    .update({ enabled: false, is_primary: false, updated_at: now, updated_by: actor?.id ?? null })
    .eq("store_id", storeId)
    .eq("from_status_code", from.code);
  fail(disableError, "更新流转关系失败");

  const rows = enabledTargets.map((target) => ({
    id: crypto.randomUUID(),
    store_id: storeId,
    from_status_code: from.code,
    to_status_code: target.to_status_code,
    enabled: target.enabled,
    is_primary: target.is_primary,
    sort_order: target.sort_order,
    created_by: actor?.id ?? null,
    updated_by: actor?.id ?? null,
    created_at: now,
    updated_at: now,
  }));

  if (rows.length) {
    const { error } = await supabase.from("order_workflow_transitions").upsert(rows, {
      onConflict: "store_id,from_status_code,to_status_code",
      ignoreDuplicates: false,
    });
    fail(error, "保存流转关系失败");
  }

  return listOrderWorkflow(actor);
}

export async function getOrder(id: string, actor?: AuditActor): Promise<OrderDetail> {
  const storeId = requireStoreIdFromActor(actor);
  const canReadSuppliers = can(actor, "supplier:read");
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("repair_orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(orderError, "读取工单详情失败");
  assertOrderInActorScope(orderRow as DbRecord, actor);

  const [
    { data: eventRows, error: eventError },
    { data: messageRows, error: messageError },
    { data: attachmentRows, error: attachmentError },
    { count: paymentLedgerCount, error: paymentLedgerError },
    { data: workflowStatusRow, error: workflowStatusError },
  ] = await Promise.all([
    supabase
      .from("order_events")
      .select("*")
      .eq("store_id", storeId)
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("message_logs")
      .select("*")
      .eq("store_id", storeId)
      .eq("order_id", id)
      .order("sent_at", { ascending: false }),
    supabase
      .from("order_attachments")
      .select("*")
      .eq("store_id", storeId)
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_payment_ledger")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("order_id", id),
    supabase
      .from("order_workflow_statuses")
      .select("bucket")
      .eq("store_id", storeId)
      .eq("code", requiredString((orderRow as DbRecord).status))
      .maybeSingle(),
  ]);

  fail(eventError, "读取时间线失败");
  fail(messageError, "读取通知历史失败");
  if (attachmentError && !isMissingOrderAttachmentsTableError(attachmentError)) {
    fail(attachmentError, "读取工单附件失败");
  }
  fail(workflowStatusError, "读取工单状态口径失败");

  const row = orderRow as DbRecord;
  const latestQuoteRow = ((eventRows ?? []) as DbRecord[]).find(
    (event) =>
      requiredString(event.event_type) === "quoted" &&
      event.payload &&
      typeof event.payload === "object" &&
      !Array.isArray(event.payload) &&
      requiredString((event.payload as DbRecord).action) === "quote_published",
  );
  const decoratedOrder = {
    ...decorate(row),
    workflow_bucket:
      (requiredString(
        (workflowStatusRow as DbRecord | null)?.bucket,
      ) as OrderListItem["workflow_bucket"]) || undefined,
  };
  return projectOrderDetailForActor(
    {
      order: applySupplierVisibility(decoratedOrder, canReadSuppliers),
      customer: customerFromRow(row.customer),
      device: deviceFromRow(row.device),
      supplier: canReadSuppliers ? supplierFromRow(row.supplier) : undefined,
      parts_supplier: canReadSuppliers ? supplierFromRow(row.parts_supplier) : undefined,
      events: ((eventRows ?? []) as DbRecord[]).map(eventFromRow),
      messages: ((messageRows ?? []) as DbRecord[]).map(messageFromRow),
      attachments: attachmentError
        ? []
        : await attachSignedUrls(supabase, (attachmentRows ?? []) as DbRecord[], storeId, id),
      latest_quote_event_id: latestQuoteRow ? requiredString(latestQuoteRow.id) : undefined,
      latest_quote_published_at: latestQuoteRow
        ? requiredString(latestQuoteRow.created_at)
        : undefined,
    },
    actor,
    {
      hasPaymentLedgerEvidence: Number(paymentLedgerCount ?? 0) > 0,
      paymentLedgerCheckFailed: Boolean(paymentLedgerError),
    },
  );
}

export async function uploadOrderAttachment(
  id: string,
  input: OrderAttachmentUploadInput,
  actor?: AuditActor,
): Promise<OrderAttachmentUploadResult> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const supabase = getSupabaseAdmin();
  const accessRow = await readOrderStatusRow(supabase, storeId, id, actor, "读取工单失败");
  assertOrderRecordNotVoided(accessRow);

  const bytes = attachmentPayloadFromInput(input);
  const attachmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = sanitizeAttachmentFileName(input.file_name);
  const extension = extensionFromAttachment(input);
  const storagePath = `${storeId}/${id}/${attachmentId}.${extension}`;
  const bucket = ORDER_ATTACHMENT_BUCKET;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: input.mime_type,
    upsert: false,
  });
  failStorageOperation(uploadError, "上传工单附件失败", bucket);

  const row = {
    id: attachmentId,
    store_id: storeId,
    order_id: id,
    kind: normalizeAttachmentKind(input.kind),
    file_name: safeName,
    mime_type: input.mime_type,
    file_size: bytes.byteLength,
    storage_bucket: bucket,
    storage_path: storagePath,
    note: input.note?.trim() || null,
    uploaded_by: operatorName,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from("order_attachments").insert(row).select("*").single();
  if (error) {
    await supabase.storage
      .from(bucket)
      .remove([storagePath])
      .catch(() => undefined);
    fail(error, "保存工单附件失败");
  }

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "note",
    payload: {
      action: "attachment_uploaded",
      attachment_id: attachmentId,
      kind: row.kind,
      file_name: safeName,
      mime_type: input.mime_type,
      file_size: bytes.byteLength,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入附件操作记录失败");

  const [attachment] = await attachSignedUrls(supabase, [data as DbRecord], storeId, id);
  return { attachment };
}

export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: {
    reason?: string;
    expectedUpdatedAt?: string;
    idempotencyKey?: string;
    operator?: string | AuditActor;
  } = {},
) {
  const storeId = requireStoreIdFromActor(
    typeof opts.operator === "string" ? undefined : opts.operator,
  );
  const supabase = getSupabaseAdmin();
  const actor = typeof opts.operator === "string" ? undefined : opts.operator;
  const currentRow = await readOrderCustodyRow(supabase, storeId, id, actor);
  await assertRoutineOrderMutationAllowed(supabase, storeId, currentRow);
  const currentCustodyStatus = custodyStatusFromRow(currentRow);
  const from = currentRow.status as RepairOrderStatus;
  const workflowFrom =
    (maybeString(currentRow.workflow_status) as OrderWorkflowStatusCode | undefined) ??
    workflowStatusFromLegacyStatus(from);
  const canonicalRequest = isCanonicalWorkflowStatus(to);
  if (canonicalRequest) {
    throw new Error("状态流转必须使用具体工单状态，不能使用主流程分组");
  }
  const legacyTo = to;
  const cleanReason = opts.reason?.trim();

  const validation = await validateManualOrderTransitionTarget(supabase, storeId, from, to);
  if (!validation.ok) throw new Error(validation.reason ?? "状态流转不合法");
  const workflowTo = canonicalWorkflowStatusFromBucket(validation.bucket, to);
  assertCustodyAllowsTransition(currentRow, legacyTo, validation.bucket);
  if (
    isApprovalDecisionBypass(
      from,
      legacyTo,
      maybeString(currentRow.approval_status),
      maybeString(currentRow.approval_flow_status),
    )
  ) {
    throw new Error("客户审批阶段必须通过审批处理记录同意或拒绝");
  }
  if (
    (orderTransitionRequiresReason(legacyTo) || validation.bucket === "cancelled") &&
    !cleanReason
  ) {
    throw new Error(`流转到「${validation.label ?? legacyTo}」需要填写原因`);
  }
  const now = new Date().toISOString();
  const update: DbRecord = {
    status: legacyTo,
    updated_at: now,
    ...deriveCanonicalUpdateFromLegacyStatus(legacyTo, now, validation.bucket),
    workflow_status: workflowTo,
  };
  if (legacyTo === "completed" || validation.bucket === "done") {
    update.completed_at = now;
    if (currentCustodyStatus === DEVICE_CUSTODY_WITH_SHOP) update.delivered_at = now;
    update.device_custody_status = DEVICE_CUSTODY_WITH_CUSTOMER;
  }
  if (legacyTo === "cancelled" || validation.bucket === "cancelled") {
    update.cancel_reason = cleanReason || "未填写";
  }
  if (legacyTo === "unfixed_pickup" && cleanReason) {
    update.diagnosis_result = buildTransitionDiagnosisResult(
      maybeString(currentRow.diagnosis_result),
      cleanReason,
    );
  }

  const expectedUpdatedAt = opts.expectedUpdatedAt ?? maybeString(currentRow.updated_at);
  if (!expectedUpdatedAt) throw new Error("缺少工单版本，请刷新后重试");

  await applyAtomicOrderMutation({
    supabase,
    id,
    storeId,
    actor,
    expectedUpdatedAt,
    update,
    eventType: "status_changed",
    eventPayload: {
      from,
      to: legacyTo,
      workflow_from: workflowFrom,
      workflow_to: workflowTo,
      reason: cleanReason,
      ...(legacyTo === "completed" || validation.bucket === "done"
        ? {
            handover_confirmed: currentCustodyStatus === DEVICE_CUSTODY_WITH_SHOP,
            custody_from: currentCustodyStatus,
            custody_to: DEVICE_CUSTODY_WITH_CUSTOMER,
            custody_outcome:
              currentCustodyStatus === DEVICE_CUSTODY_WITH_SHOP ||
              Boolean(maybeString(currentRow.delivered_at))
                ? "delivered"
                : "never_received",
          }
        : legacyTo === "cancelled" || validation.bucket === "cancelled"
          ? {
              custody_from: currentCustodyStatus,
              custody_to: currentCustodyStatus,
              custody_outcome:
                currentCustodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER
                  ? maybeString(currentRow.delivered_at)
                    ? "returned"
                    : "never_received"
                  : "awaiting_return",
            }
          : {}),
    },
    idempotencyKey: opts.idempotencyKey ?? crypto.randomUUID(),
    context: "更新工单状态失败",
  });

  return { ok: true, from, to: legacyTo };
}

export async function confirmCancelledOrderReturn(
  id: string,
  opts: {
    expectedUpdatedAt: string;
    idempotencyKey: string;
    operator?: string | AuditActor;
  },
) {
  const actor = typeof opts.operator === "string" ? undefined : opts.operator;
  const storeId = requireStoreIdFromActor(actor);
  if (!actor?.id) throw new Error("确认设备退还需要已登录员工身份");
  const supabase = getSupabaseAdmin();
  const current = await readOrderCustodyRow(supabase, storeId, id, actor);
  const currentCustodyStatus = custodyStatusFromRow(current);
  const status = requiredString(current.status);
  const workflowBucket = await readWorkflowStatusBucket(supabase, storeId, status);
  const cancelled =
    isOrderCancelled({
      status,
      exception_status: maybeString(current.exception_status),
    }) || workflowBucket === "cancelled";

  assertOrderRecordNotVoided(current);

  if (!cancelled) throw new Error("只有已取消工单可以确认设备退还");
  if (!opts.expectedUpdatedAt) throw new Error("缺少工单版本，请刷新后重试");
  if (!opts.idempotencyKey) throw new Error("缺少退还操作标识");
  if (!currentCustodyStatus) throw new Error("请先确认设备保管状态，再登记退还");
  if (currentCustodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER) {
    if (maybeString(current.delivered_at)) {
      return {
        ok: true,
        alreadyConfirmed: true,
        delivered_at: maybeString(current.delivered_at),
      };
    }
    throw new Error("设备未由门店保管，无需确认退还");
  }
  if (maybeString(current.delivered_at)) {
    throw new Error("设备保管状态与交付时间冲突，请先修正保管记录");
  }
  const { data, error } = await supabase.rpc("repairdesk_confirm_cancelled_order_return", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: actor.id,
    p_expected_updated_at: opts.expectedUpdatedAt,
    p_idempotency_key: opts.idempotencyKey,
  });
  fail(error, "确认设备退还失败");
  if (!data || typeof data !== "object") throw new Error("确认设备退还失败：数据库返回无效");
  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    const code = requiredString(result.code);
    const messages: Record<string, string> = {
      actor_forbidden: "当前账号没有确认设备退还的权限",
      order_not_found: "工单不存在或不属于当前店铺",
      invalid_state: "只有未作废的已取消工单可以确认设备退还",
      stale_version: "工单已被其他操作更新，请刷新后重试",
      missing_expected_version: "缺少工单版本，请刷新后重试",
      invalid_idempotency_key: "退还操作标识无效，请重试",
      custody_unknown: "请先确认设备保管状态，再登记退还",
      return_not_required: "设备未由门店保管，无需确认退还",
      custody_conflict: "设备保管状态与交付时间冲突，请先修正保管记录",
    };
    throw new Error(messages[code] ?? "确认设备退还失败");
  }
  const deliveredAt = maybeString(result.delivered_at);
  if (!deliveredAt) throw new Error("确认设备退还失败：数据库返回无效");
  return {
    ok: true,
    alreadyConfirmed: Boolean(result.already_confirmed),
    delivered_at: deliveredAt,
  };
}

export async function updateOrderCustody(
  id: string,
  input: UpdateOrderCustodyInput,
  operator: string | AuditActor = "前台",
): Promise<PatchOrderResult> {
  const actor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const current = await readOrderCustodyRow(supabase, storeId, id, actor);
  const from = custodyStatusFromRow(current);
  const to = input.device_custody_status;
  const reason = input.reason?.trim();
  const status = requiredString(current.status);
  const exceptionStatus = maybeString(current.exception_status);
  const currentWorkflowBucket = await readWorkflowStatusBucket(supabase, storeId, status);
  const cancelled =
    isOrderCancelled({ status, exception_status: exceptionStatus }) ||
    currentWorkflowBucket === "cancelled";
  const isTerminal =
    status === "completed" ||
    cancelled ||
    currentWorkflowBucket === "done" ||
    (currentWorkflowBucket === undefined && maybeString(current.workflow_status) === "closed");

  assertOrderRecordNotVoided(current);

  if (!from && !reason) throw new Error("补录历史设备保管状态时必须填写说明");
  if (isTerminal && (!canCorrectTerminalCustody(actor) || !reason)) {
    throw new ForbiddenError("已结束工单只能由店主或经理填写说明后修正设备保管状态");
  }
  if (cancelled && from === DEVICE_CUSTODY_WITH_SHOP && to === DEVICE_CUSTODY_WITH_CUSTOMER) {
    throw new Error("已取消工单请使用“确认设备已退还”操作");
  }
  if (
    (status === "completed" || currentWorkflowBucket === "done") &&
    to === DEVICE_CUSTODY_WITH_SHOP
  ) {
    throw new Error("已完成工单不能直接改为门店保管，请先按返修流程重开");
  }

  if (isTerminal) {
    if (!actor?.id) throw new Error("修正已结束工单的设备保管状态需要已登录员工身份");
    if (!reason || reason.length < 5) {
      throw new Error("已结束工单修正设备保管状态时，说明至少需要 5 个字符");
    }
    const { data, error } = await supabase.rpc("repairdesk_correct_terminal_order_custody", {
      p_store_id: storeId,
      p_order_id: id,
      p_actor_id: actor.id,
      p_expected_updated_at: input.expected_updated_at,
      p_idempotency_key: input.idempotency_key,
      p_device_custody_status: to,
      p_reason: reason,
    });
    fail(error, "修正已结束工单的设备保管状态失败");
    if (!data || typeof data !== "object") {
      throw new Error("修正已结束工单的设备保管状态失败：数据库返回无效");
    }
    const result = data as Record<string, unknown>;
    if (result.ok !== true) {
      const code = requiredString(result.code);
      const messages: Record<string, string> = {
        actor_forbidden: "只有店主或经理可以修正已结束工单的设备保管状态",
        order_not_found: "工单不存在或不属于当前店铺",
        stale_version: "工单已被其他操作更新，请刷新后重试",
        order_voided: "该工单记录已作废，只能查看历史证据",
        invalid_state: "当前工单不是可审计修正的已结束工单",
        invalid_reason: "修正说明至少需要 5 个字符",
        idempotency_conflict: "该操作标识已用于不同请求，请刷新后重试",
        terminal_reopen_required: "设备重新回店前，请先按返修流程重新打开工单",
        use_cancelled_return: "已取消工单请使用“确认设备已退还”操作",
        custody_conflict: "设备保管状态与交付时间冲突，请先修正保管记录",
      };
      throw new Error(messages[code] ?? "修正已结束工单的设备保管状态失败");
    }
    const updatedAt = maybeString(result.updated_at);
    if (!updatedAt) {
      throw new Error("修正已结束工单的设备保管状态失败：数据库返回无效");
    }
    return { ok: true, updated_at: updatedAt };
  }

  const workflowBucket =
    from === DEVICE_CUSTODY_WITH_SHOP && to === DEVICE_CUSTODY_WITH_CUSTOMER
      ? currentWorkflowBucket
      : undefined;
  if (
    from !== to &&
    !deviceCustodyAllowsChange({
      current: from,
      target: to,
      status,
      exceptionStatus,
      workflowBucket,
    })
  ) {
    throw new Error("当前流程需要设备留在门店，请先完成、取消或流转到允许交还的阶段");
  }

  const now = new Date().toISOString();
  const update: DbRecord = {
    device_custody_status: to,
    updated_at: now,
  };
  if (to === DEVICE_CUSTODY_WITH_CUSTOMER) {
    if (from === DEVICE_CUSTODY_WITH_SHOP) update.delivered_at = now;
  } else {
    update.delivered_at = null;
  }

  const updatedAtAfter = await applyAtomicOrderMutation({
    supabase,
    id,
    storeId,
    actor,
    expectedUpdatedAt: input.expected_updated_at,
    update,
    eventType: "note",
    eventPayload: {
      action: "device_custody_changed",
      to,
      reason: reason || null,
      credentials_cleared: false,
      prior_delivery_recorded: Boolean(maybeString(current.delivered_at)),
    },
    idempotencyKey: input.idempotency_key,
    context: "更新设备保管状态失败",
  });

  return { ok: true, updated_at: updatedAtAfter };
}

function buildTransitionDiagnosisResult(current: string | undefined, reason: string) {
  const cleanReason = reason.trim();
  if (!current?.trim() || current.trim() === cleanReason) return cleanReason;
  return `${current.trim()}\n处理结论：${cleanReason}`;
}

export async function batchTransition(
  ids: string[],
  to: RepairOrderStatus,
  operator: string | AuditActor = "前台",
) {
  requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to, { operator });
      count++;
    } catch (error) {
      failures.push({ id, reason: (error as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

const APPROVAL_APPROVED_TARGETS = ["repairing", "parts_ordered", "mail_in_progress"] as const;
const APPROVAL_REJECTED_TARGETS = ["unfixed_pickup", "cancelled"] as const;

export async function decideOrderApproval(
  id: string,
  input: OrderApprovalDecisionInput,
  operator: string | AuditActor = "前台",
): Promise<OrderApprovalDecisionResult> {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const supabase = getSupabaseAdmin();
  const actor = typeof operator === "string" ? undefined : operator;
  const currentRow = await readOrderCustodyRow(
    supabase,
    storeId,
    id,
    actor,
    "读取审批与设备保管状态失败",
  );
  const from = currentRow.status as RepairOrderStatus;
  const currentApprovalFlow =
    maybeString(currentRow.approval_flow_status) ??
    approvalFlowStatusFromLegacyStatus(from, maybeString(currentRow.approval_status));
  const cleanReason = input.reason?.trim();

  if (
    currentApprovalFlow !== "waiting_customer" &&
    !(from === "quoted" && maybeString(currentRow.approval_status) === "pending")
  ) {
    throw new Error("当前工单不在客户审批阶段");
  }

  const defaultTarget = input.decision === "approved" ? "repairing" : "unfixed_pickup";
  const target = input.next_status ?? defaultTarget;
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

  let targetBucket: OrderWorkflowStatus["bucket"];
  if (input.decision === "approved") {
    const validation = await validateConfiguredOrderTransition(supabase, storeId, from, target);
    if (!validation.ok) throw new Error(validation.reason ?? "状态流转不合法");
    targetBucket = validation.bucket;
    assertCustodyAllowsTransition(currentRow, target, targetBucket);
  } else {
    targetBucket = (await assertWorkflowTargetEnabled(supabase, storeId, target)).bucket;
    assertCustodyAllowsTransition(currentRow, target, targetBucket);
  }

  const now = new Date().toISOString();
  const update: DbRecord = {
    status: target,
    updated_at: now,
    ...deriveCanonicalUpdateFromLegacyStatus(target, now, targetBucket),
    approval_status: input.decision,
    approval_flow_status: input.decision,
    approval_confirmed_at: now,
  };
  if (input.decision === "rejected" && target === "cancelled") {
    update.cancel_reason = cleanReason || "客户拒绝报价";
  }
  if (input.decision === "rejected" && target === "unfixed_pickup") {
    update.diagnosis_result = buildTransitionDiagnosisResult(
      maybeString(currentRow.diagnosis_result),
      cleanReason || "客户拒绝报价并取回设备",
    );
  }

  await applyAtomicOrderMutation({
    supabase,
    id,
    storeId,
    actor,
    expectedUpdatedAt: requiredString(currentRow.updated_at),
    update,
    eventType: "approval_result",
    eventPayload: {
      result: input.decision,
      from,
      to: target,
      reason: cleanReason,
      approval_flow_status: input.decision,
      ...(target === "cancelled"
        ? {
            custody_outcome:
              custodyStatusFromRow(currentRow) === DEVICE_CUSTODY_WITH_CUSTOMER
                ? maybeString(currentRow.delivered_at)
                  ? "returned"
                  : "never_received"
                : "awaiting_return",
          }
        : {}),
    },
    idempotencyKey: crypto.randomUUID(),
    context: "更新客户审批结果失败",
  });

  return {
    ok: true,
    decision: input.decision,
    from,
    to: target,
    approval_flow_status: input.decision,
  };
}

export async function recordPayment(
  id: string,
  amount: number,
  method = "现金",
  operator: string | AuditActor = "前台",
  expectedUpdatedAt?: string,
  idempotencyKey?: string,
): Promise<PaymentResult> {
  const actor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(actor);
  if (!actor?.id) throw new Error("登记收款需要已登录员工身份");
  const normalizedAmount = normalizePositiveCentAmount(amount);
  if (normalizedAmount === undefined) {
    throw new Error("收款金额必须大于 0，且最多保留两位小数");
  }
  if (!expectedUpdatedAt) throw new Error("缺少工单版本时间");
  if (!idempotencyKey) throw new Error("缺少收款操作标识");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("repairdesk_record_order_payment", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: actor.id,
    p_amount: normalizedAmount,
    p_method: method.trim() || "现金",
    p_expected_updated_at: expectedUpdatedAt,
    p_idempotency_key: idempotencyKey,
  });
  fail(error, "登记收款失败");

  if (!data || typeof data !== "object") throw new Error("登记收款失败：数据库返回无效");
  const result = data as Record<string, unknown>;
  if (result.ok !== true) throw new Error(paymentFailureMessage(requiredString(result.code)));

  return {
    ok: true,
    code: result.code === "idempotent_replay" ? "idempotent_replay" : "recorded",
    payment_id: requiredString(result.payment_id) || undefined,
    balance: money(result.balance),
    is_paid: Boolean(result.is_paid),
    updated_at: requiredString(result.updated_at) || undefined,
  };
}

function paymentFailureMessage(code: string) {
  const messages: Record<string, string> = {
    actor_forbidden: "当前员工没有收款权限",
    invalid_target: "工单目标无效",
    invalid_idempotency_key: "收款操作标识无效",
    missing_expected_version: "缺少工单版本时间",
    invalid_amount: "收款金额必须大于 0，且最多保留两位小数",
    invalid_method: "支付方式无效",
    idempotency_conflict: "该收款操作标识已用于不同请求，请刷新后重试",
    order_not_found: "工单不存在",
    order_cancelled: "已取消工单不能登记收款",
    order_voided: "已作废或删除的工单不能登记收款",
    stale_version: "工单已被更新，请刷新后再试",
    already_settled: "该工单已结清",
    overpayment: "收款金额不能超过未结清尾款",
  };
  return messages[code] ?? "登记收款失败";
}

export class OrderTerminalOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OrderTerminalOperationError";
  }
}

export class OrderCustomerIdentityError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OrderCustomerIdentityError";
  }
}

function orderCustomerIdentityFailure(code: string) {
  const messages: Record<string, string> = {
    actor_forbidden: "当前员工没有创建工单权限",
    idempotency_conflict: "本次创建标识已用于不同请求，请刷新后重试",
    invalid_customer_phone: "客户手机号格式不正确",
    customer_name_required: "新客户姓名不能为空",
    customer_not_found: "所选客户不存在或已变更",
    identity_challenge_invalid: "客户身份确认已失效，请重新检查",
    identity_challenge_stale: "客户资料已发生变化，请重新检查",
    identity_resolution_invalid: "客户身份确认选项无效",
    device_customer_mismatch: "设备不属于本次确认的客户",
    invalid_device: "设备品牌和型号不能为空",
  };
  const status = code === "actor_forbidden" ? 403 : code.includes("not_found") ? 404 : 409;
  return new OrderCustomerIdentityError(
    messages[code] ?? "创建工单失败，请重新检查客户资料",
    code,
    status,
  );
}

function terminalOperationFailure(code: string, details?: Record<string, unknown>) {
  const messages: Record<string, string> = {
    actor_forbidden: "当前员工没有执行该操作的权限",
    invalid_target: "工单目标无效",
    invalid_idempotency_key: "操作标识无效",
    missing_expected_version: "缺少工单版本时间",
    invalid_reason: "请填写 5 到 1000 个字符的操作原因",
    invalid_changes: "纠正字段无效或没有实际变化",
    invalid_reopen_target: "重新打开的目标状态无效或已停用",
    invalid_confirmation: "输入的工单号与当前工单不一致",
    idempotency_conflict: "该操作标识已用于不同请求，请刷新后重试",
    order_not_found: "工单不存在",
    stale_version: "工单已被更新，请刷新后再试",
    invalid_state: "当前工单状态不允许执行该操作",
    financial_history_requires_resolution: "存在收款或定金证据，必须先完成财务冲销/退款",
  };
  const status =
    code === "actor_forbidden"
      ? 403
      : code === "order_not_found"
        ? 404
        : code === "financial_history_requires_resolution"
          ? 422
          : ["stale_version", "invalid_state", "idempotency_conflict"].includes(code)
            ? 409
            : 422;
  throw new OrderTerminalOperationError(
    messages[code] ?? "工单终态操作失败",
    code.toUpperCase(),
    status,
    details,
  );
}

function terminalOperationResult(data: unknown): OrderTerminalOperationResult {
  if (!data || typeof data !== "object") {
    throw new OrderTerminalOperationError("数据库返回无效", "INVALID_RESPONSE", 500);
  }
  const row = data as Record<string, unknown>;
  if (row.ok !== true) {
    terminalOperationFailure(
      requiredString(row.code),
      row.details && typeof row.details === "object"
        ? (row.details as Record<string, unknown>)
        : undefined,
    );
  }
  const code = row.code === "idempotent_replay" ? "idempotent_replay" : "recorded";
  return {
    ok: true,
    code,
    operation_id: requiredString(row.operation_id),
    order_id: requiredString(row.order_id),
    status: requiredString(row.status) as RepairOrderStatus,
    record_state: row.record_state === "voided" ? "voided" : "active",
    updated_at: requiredString(row.updated_at),
    replayed: code === "idempotent_replay",
  };
}

function terminalActorId(actor: AuditActor) {
  if (!actor.id) terminalOperationFailure("actor_forbidden");
  return actor.id!;
}

export async function correctTerminalOrder(
  id: string,
  input: CorrectTerminalOrderInput,
  actor: AuditActor,
): Promise<OrderTerminalOperationResult> {
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_correct_terminal_order", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: terminalActorId(actor),
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_changes: input.changes,
    p_reason: input.reason.trim(),
  });
  fail(error, "纠正已结束工单失败");
  return terminalOperationResult(data);
}

export async function reopenOrder(
  id: string,
  input: ReopenOrderInput,
  actor: AuditActor,
): Promise<OrderTerminalOperationResult> {
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_reopen_terminal_order", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: terminalActorId(actor),
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_to_status: input.to_status,
    p_reason: input.reason.trim(),
  });
  if (error?.message.includes("physical-work reopen requires shop custody")) {
    throw new Error("设备当前未留店；请先重开到接待或报价阶段，再确认收机后进入维修流程");
  }
  fail(error, "重新打开工单失败");
  return terminalOperationResult(data);
}

export async function voidOrder(
  id: string,
  input: VoidOrderInput,
  actor: AuditActor,
): Promise<OrderTerminalOperationResult> {
  const storeId = requireStoreIdFromActor(actor);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_void_order", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: terminalActorId(actor),
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_reason: input.reason.trim(),
    p_confirm_public_no: input.confirm_public_no.trim(),
  });
  if (error?.message.includes("custody status must be confirmed before void")) {
    throw new Error("作废前必须先确认设备由门店还是客人保管");
  }
  if (error?.message.includes("shop-held device must be returned before void")) {
    throw new Error("设备仍由门店保管，必须先完成退还才能作废工单");
  }
  fail(error, "作废工单失败");
  return terminalOperationResult(data);
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const assignableOrderRoles = new Set(["owner", "manager", "technician", "sales"]);

async function readAssignableOrderMember(
  supabase: SupabaseAdmin,
  storeId: string,
  membershipId: string,
) {
  const { data, error } = await supabase
    .from("store_memberships")
    .select("id,display_name,email,role,status")
    .eq("store_id", storeId)
    .eq("id", membershipId)
    .eq("status", "active")
    .maybeSingle();
  fail(error, "校验工单负责人失败");
  if (!data) throw new Error("负责人不存在、已停用或不属于当前店铺");
  const row = data as DbRecord;
  const role = requiredString(row.role);
  if (!assignableOrderRoles.has(role)) throw new Error("该成员不能被设为工单负责人");
  const email = requiredString(row.email);
  return {
    id: requiredString(row.id),
    displayName: maybeString(row.display_name) ?? email.split("@")[0] ?? "员工",
  };
}

const ORDER_ATTACHMENT_BUCKET = "repairdesk-order-attachments";
const ORDER_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const ORDER_ATTACHMENT_KINDS = [
  "device_front",
  "device_back",
  "screen_on",
  "fault_photo",
  "signature",
  "other",
] as const;
const ORDER_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function isMissingOrderAttachmentsTableError(error: { message: string } | null | undefined) {
  const message = error?.message;
  if (!message || !/order_attachments/i.test(message)) {
    return false;
  }
  return (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /Could not find/i.test(message)
  );
}

function normalizeAttachmentKind(kind: string): OrderAttachment["kind"] {
  return (ORDER_ATTACHMENT_KINDS as readonly string[]).includes(kind)
    ? (kind as OrderAttachment["kind"])
    : "other";
}

function sanitizeAttachmentFileName(fileName: string) {
  const trimmed = fileName
    .trim()
    .replace(/[^\w.\-()\s]/g, "_")
    .replace(/\s+/g, " ");
  return trimmed.slice(0, 160) || `attachment-${Date.now()}`;
}

function extensionFromAttachment(
  input: Pick<OrderAttachmentUploadInput, "file_name" | "mime_type">,
) {
  const nameExtension = input.file_name.match(/\.([a-z0-9]{2,8})$/i)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension;
  if (input.mime_type === "image/jpeg") return "jpg";
  if (input.mime_type === "image/png") return "png";
  if (input.mime_type === "image/webp") return "webp";
  if (input.mime_type === "image/heic") return "heic";
  if (input.mime_type === "image/heif") return "heif";
  if (input.mime_type === "application/pdf") return "pdf";
  return "bin";
}

function attachmentPayloadFromInput(input: OrderAttachmentUploadInput) {
  if (!ORDER_ATTACHMENT_MIME_TYPES.has(input.mime_type)) {
    throw new Error("仅支持 JPG、PNG、WebP、HEIC 或 PDF 附件");
  }
  const bytes = Buffer.from(input.data_base64, "base64");
  if (bytes.byteLength === 0) throw new Error("附件内容为空");
  if (bytes.byteLength > ORDER_ATTACHMENT_MAX_BYTES) throw new Error("附件不能超过 8MB");
  if (input.file_size > ORDER_ATTACHMENT_MAX_BYTES) throw new Error("附件不能超过 8MB");
  if (input.file_size !== bytes.byteLength) throw new Error("附件大小与实际内容不一致");
  assertAttachmentMagicBytes(bytes, input.mime_type);
  return bytes;
}

function assertAttachmentMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return;
  }
  if (
    mimeType === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return;
  }
  if (mimeType === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF") {
    if (bytes.subarray(8, 12).toString("ascii") === "WEBP") return;
  }
  if (mimeType === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return;
  }
  if (
    (mimeType === "image/heic" || mimeType === "image/heif") &&
    bytes.byteLength >= 12 &&
    bytes.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    return;
  }
  throw new Error("附件内容与文件类型不匹配");
}

async function attachSignedUrls(
  supabase: SupabaseAdmin,
  rows: DbRecord[] | null | undefined,
  storeId: string,
  orderId: string,
): Promise<OrderAttachment[]> {
  const attachments = (rows ?? []).map(attachmentFromRow);
  return Promise.all(
    attachments.map(async (attachment) => {
      if (!isOrderAttachmentStorageScoped(attachment, storeId, orderId)) {
        return { ...attachment, public_url: undefined, signed_url: undefined };
      }
      if (attachment.public_url || !attachment.storage_path) return attachment;
      const bucket = attachment.storage_bucket || ORDER_ATTACHMENT_BUCKET;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(attachment.storage_path, 60 * 60);
      if (error || !data?.signedUrl) return attachment;
      return { ...attachment, signed_url: data.signedUrl };
    }),
  );
}

export function isOrderAttachmentStorageScoped(
  attachment: Pick<OrderAttachment, "store_id" | "order_id" | "storage_bucket" | "storage_path">,
  storeId: string,
  orderId: string,
) {
  const bucket = attachment.storage_bucket || ORDER_ATTACHMENT_BUCKET;
  return (
    attachment.store_id === storeId &&
    attachment.order_id === orderId &&
    bucket === ORDER_ATTACHMENT_BUCKET &&
    attachment.storage_path.startsWith(`${storeId}/${orderId}/`)
  );
}

const OPTIONAL_ORDER_WRITE_FIELDS = [
  "assignee_membership_id",
  "workflow_status",
  "exception_status",
  "payment_status",
  "approval_flow_status",
  "parts_status",
  "notify_status",
  "device_unlock_method",
  "device_unlock_value",
  "device_unlock_pattern",
  "record_state",
  "voided_at",
  "voided_by",
  "void_reason",
  "deleted_at",
] as const;

function stripOptionalOrderWriteFields(row: DbRecord) {
  const stripped: DbRecord = {};
  let removed = false;
  for (const [key, value] of Object.entries(row)) {
    if ((OPTIONAL_ORDER_WRITE_FIELDS as readonly string[]).includes(key)) {
      removed = true;
      continue;
    }
    stripped[key] = value;
  }
  return { stripped, removed };
}

async function readOrderStatusRow(
  supabase: SupabaseAdmin,
  storeId: string,
  id: string,
  actor?: AuditActor,
  context = "读取当前状态失败",
): Promise<DbRecord> {
  const canonical = await supabase
    .from("repair_orders")
    .select(
      "id,status,assignee_membership_id,workflow_status,parts_status,exception_status,diagnosis_result,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,notify_status,completed_at,delivered_at,record_state,deleted_at,updated_at",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  if (!canonical.error || !isMissingRepairOrderColumnError(canonical.error)) {
    fail(canonical.error, context);
    const row: DbRecord = { ...(canonical.data as DbRecord), __assignment_supported: true };
    assertOrderInActorScope(row, actor);
    return row;
  }

  const preLifecycle = await supabase
    .from("repair_orders")
    .select(
      "id,status,assignee_membership_id,workflow_status,parts_status,exception_status,diagnosis_result,balance_amount,is_paid,payment_status,approval_status,approval_flow_status,notify_status,completed_at,delivered_at,updated_at",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  if (!preLifecycle.error || !isMissingRepairOrderColumnError(preLifecycle.error)) {
    fail(preLifecycle.error, context);
    const row: DbRecord = { ...(preLifecycle.data as DbRecord), __assignment_supported: true };
    assertOrderInActorScope(row, actor);
    return row;
  }

  const legacy = await supabase
    .from("repair_orders")
    .select(
      "id,status,technician_name,balance_amount,is_paid,approval_status,completed_at,delivered_at,updated_at",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(legacy.error, context);
  const row: DbRecord = { ...(legacy.data as DbRecord), __assignment_supported: false };
  assertOrderInActorScope(row, actor);
  return row;
}

async function readOrderCustodyRow(
  supabase: SupabaseAdmin,
  storeId: string,
  id: string,
  actor?: AuditActor,
  context = "读取设备保管状态失败",
): Promise<DbRecord> {
  const result = await supabase
    .from("repair_orders")
    .select(
      "id,status,assignee_membership_id,workflow_status,exception_status,approval_status,approval_flow_status,parts_status,notify_status,approval_sent_at,diagnosis_result,cancel_reason,device_custody_status,device_unlock_method,device_unlock_value,device_unlock_pattern,completed_at,delivered_at,record_state,deleted_at,updated_at",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  if (result.error && isMissingRepairOrderColumnError(result.error)) {
    throw new Error("设备保管功能尚未完成数据库迁移，请联系店主");
  }
  fail(result.error, context);
  const row: DbRecord = { ...(result.data as DbRecord), __assignment_supported: true };
  assertOrderInActorScope(row, actor);
  return row;
}

function custodyStatusFromRow(row: DbRecord): DeviceCustodyStatus | null {
  return isDeviceCustodyStatus(row.device_custody_status) ? row.device_custody_status : null;
}

function assertCustodyAllowsTransition(row: DbRecord, to: RepairOrderStatus, bucket?: string) {
  const custodyStatus = custodyStatusFromRow(row);
  const requiresPhysicalCustody =
    deviceCustodyBlocksStatus(to) ||
    bucket === "diagnosing" ||
    bucket === "repair" ||
    bucket === "pickup";
  if (
    !custodyStatus &&
    (requiresPhysicalCustody ||
      to === "completed" ||
      to === "cancelled" ||
      bucket === "done" ||
      bucket === "cancelled")
  ) {
    throw new Error("请先确认设备是留在门店还是由客户带走，再进行此状态流转");
  }
  if (custodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER && requiresPhysicalCustody) {
    throw new Error("设备当前未留店，不能进入诊断、维修或待取机状态");
  }
}

function canCorrectTerminalCustody(actor?: AuditActor) {
  if (actor?.isSystem) return true;
  const role = actor?.storeRole ?? actor?.role;
  return role === "owner" || role === "manager";
}

async function applyAtomicOrderMutation({
  supabase,
  storeId,
  id,
  actor,
  expectedUpdatedAt,
  update,
  eventType,
  eventPayload,
  idempotencyKey,
  context,
}: {
  supabase: SupabaseAdmin;
  storeId: string;
  id: string;
  actor?: AuditActor;
  expectedUpdatedAt: string;
  update: DbRecord;
  eventType: "status_changed" | "approval_result" | "note";
  eventPayload: Record<string, unknown>;
  idempotencyKey: string;
  context: string;
}) {
  if (!actor?.id) throw new Error(`${context}：缺少已登录员工身份`);
  const safeUpdate = Object.fromEntries(
    Object.entries(update).filter(([key, value]) => key !== "updated_at" && value !== undefined),
  );
  const { data, error } = await supabase.rpc("repairdesk_apply_order_atomic_mutation", {
    p_store_id: storeId,
    p_order_id: id,
    p_actor_id: actor.id,
    p_expected_updated_at: expectedUpdatedAt,
    p_update: safeUpdate,
    p_event_type: eventType,
    p_event_payload: eventPayload,
    p_idempotency_key: idempotencyKey,
  });
  const atomicMutationUnavailable = Boolean(
    error &&
    (("code" in error && (error.code === "PGRST202" || error.code === "42883")) ||
      error.message.includes("repairdesk_apply_order_atomic_mutation") ||
      error.message.toLowerCase().includes("schema cache")),
  );
  if (atomicMutationUnavailable) {
    throw new Error("设备保管数据库迁移尚未应用，请联系店主");
  }
  if (error && isMissingRepairOrderColumnError(error)) {
    throw new Error("设备保管功能尚未完成数据库迁移，请联系店主");
  }
  fail(error, context);
  if (!data || typeof data !== "object") throw new Error(`${context}：数据库返回无效`);
  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    const code = requiredString(result.code);
    if (code === "actor_forbidden") throw new ForbiddenError("当前员工无权更新此工单");
    if (code === "order_not_found") throw new Error("工单不存在");
    if (code === "stale_version") throw new Error("工单已被更新，请刷新后再试");
    if (code === "idempotency_conflict") {
      throw new Error("该操作标识已用于不同请求，请刷新后重试");
    }
    if (code === "missing_expected_version") throw new Error("缺少工单版本，请刷新后再试");
    if (code === "order_voided") throw new Error("该工单记录已作废，只能查看历史证据");
    if (code === "terminal_operation_required") {
      throw new Error("已结束工单必须使用审计化设备保管修正操作");
    }
    if (code === "invalid_status") throw new Error("目标工单状态不存在或已停用");
    if (code === "completed_reopen_required") {
      throw new Error("已完成工单不能直接改为门店保管，请先按返修流程重开");
    }
    if (code === "custody_handover_requires_flow_change") {
      throw new Error("当前流程需要设备留在门店，请先完成、取消或流转到允许交还的阶段");
    }
    throw new Error(`${context}：请求无效（${code || "unknown"}）`);
  }
  const updatedAt = requiredString(result.updated_at);
  if (!updatedAt) throw new Error(`${context}：缺少更新时间`);
  return updatedAt;
}

async function updateOrderRow({
  supabase,
  id,
  storeId,
  update,
  context,
}: {
  supabase: SupabaseAdmin;
  id: string;
  storeId: string;
  update: DbRecord;
  context: string;
}) {
  const { error } = await supabase
    .from("repair_orders")
    .update(update)
    .eq("store_id", storeId)
    .eq("id", id);
  if (error && isMissingRepairOrderColumnError(error)) {
    const { stripped, removed } = stripOptionalOrderWriteFields(update);
    if (removed) {
      const retry = await supabase
        .from("repair_orders")
        .update(stripped)
        .eq("store_id", storeId)
        .eq("id", id);
      fail(retry.error, context);
      return;
    }
  }
  fail(error, context);
}

async function updateOrderRowWhileShopHoldsDevice({
  supabase,
  id,
  storeId,
  expectedUpdatedAt,
  update,
  context,
}: {
  supabase: SupabaseAdmin;
  id: string;
  storeId: string;
  expectedUpdatedAt: string;
  update: DbRecord;
  context: string;
}) {
  const { data, error } = await supabase
    .from("repair_orders")
    .update(update)
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .eq("device_custody_status", DEVICE_CUSTODY_WITH_SHOP)
    .select("id")
    .maybeSingle();
  if (error && isMissingRepairOrderColumnError(error)) {
    throw new Error("设备保管功能尚未完成数据库迁移，请联系店主");
  }
  fail(error, context);
  if (!data) throw new Error("工单已被更新或设备已不在门店，请刷新后重试");
}

async function insertOrderRow({
  supabase,
  row,
  context,
}: {
  supabase: SupabaseAdmin;
  row: DbRecord;
  context: string;
}) {
  const { data, error } = await supabase
    .from("repair_orders")
    .insert(row)
    .select("id,public_no")
    .single();
  if (error && isMissingRepairOrderColumnError(error)) {
    const { stripped, removed } = stripOptionalOrderWriteFields(row);
    if (removed) {
      const retry = await supabase
        .from("repair_orders")
        .insert(stripped)
        .select("id,public_no")
        .single();
      fail(retry.error, context);
      return retry.data as DbRecord;
    }
  }
  fail(error, context);
  return data as DbRecord;
}

async function generateRepairOrderPublicNo(supabase: SupabaseAdmin, attempt: number) {
  const { data, error } = await supabase.rpc("generate_repair_order_public_no");
  if (!error) {
    const publicNo = normalizeGeneratedRepairOrderPublicNo(data);
    if (publicNo) return publicNo;
  }
  return createFallbackRepairOrderPublicNo({ attempt });
}

async function readDefaultOrderWarrantyMonths(supabase: SupabaseAdmin, storeId: string) {
  const { data, error } = await supabase
    .from("store_settings")
    .select("default_order_warranty_months,default_order_warranty_text")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) return 6;
  const row = data as DbRecord | null;
  if (!row) return 6;
  if (
    row.default_order_warranty_months !== undefined &&
    row.default_order_warranty_months !== null
  ) {
    return normalizeWarrantyMonths(Number(row.default_order_warranty_months));
  }
  return parseWarrantyMonths(maybeString(row.default_order_warranty_text), 6);
}

function currentWarrantyMonths(row: DbRecord, defaultMonths: number) {
  if (row.warranty_months !== undefined && row.warranty_months !== null) {
    return normalizeWarrantyMonths(Number(row.warranty_months), defaultMonths);
  }
  return parseWarrantyMonths(maybeString(row.warranty_text), defaultMonths);
}

async function assertRoutineOrderMutationAllowed(
  supabase: SupabaseAdmin,
  storeId: string,
  row: DbRecord,
) {
  assertOrderRecordNotVoided(row);
  const { data: workflowStatus, error } = await supabase
    .from("order_workflow_statuses")
    .select("bucket")
    .eq("store_id", storeId)
    .eq("code", requiredString(row.status))
    .maybeSingle();
  fail(error, "读取工单状态口径失败");
  const workflowBucket = maybeString((workflowStatus as DbRecord | null)?.bucket);
  if (
    ["completed", "cancelled"].includes(requiredString(row.status)) ||
    requiredString(row.exception_status) === "cancelled" ||
    (workflowBucket
      ? ["done", "cancelled"].includes(workflowBucket)
      : requiredString(row.workflow_status) === "closed")
  ) {
    throw new ForbiddenError("已结束工单必须使用审计化纠正或重新打开操作");
  }
}

function assertOrderRecordNotVoided(row: DbRecord) {
  if (requiredString(row.record_state) === "voided" || Boolean(row.deleted_at)) {
    throw new ForbiddenError("该工单记录已作废，只能查看历史证据");
  }
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

function deviceUnlockUpdateFromInput(input: PatchOrderInput["changes"]["device_unlock"]) {
  const unlock = normalizeDeviceUnlockInput(input);
  return {
    device_unlock_method: unlock.method,
    device_unlock_value: unlock.value,
    device_unlock_pattern: unlock.pattern,
  };
}

function normalizeFaultPriceInput(
  input: PatchOrderFinanceInput["fault_prices"],
  options: { generateLineIds?: boolean } = {},
) {
  return input.map((item) => {
    const name = item.name.trim();
    const price = Number(item.price);
    if (!name) throw new Error("报价项目名称不能为空");
    if (!Number.isFinite(price) || price < 0) throw new Error("报价金额不能为负数");
    const catalog = item.catalog_key ? resolveRepairServiceCatalogItem(item) : undefined;
    return {
      ...(item.line_id
        ? { line_id: item.line_id }
        : options.generateLineIds
          ? { line_id: crypto.randomUUID() }
          : {}),
      ...(catalog ? { catalog_key: catalog.catalogKey } : {}),
      name,
      price,
      currency_code: CURRENCY_CODE,
      ...(item.note?.trim() ? { note: item.note.trim() } : {}),
    };
  });
}

function snapshotFromRecord(value: unknown, device?: DeviceSnapshot): DeviceSnapshot {
  const row =
    value && typeof value === "object" && !Array.isArray(value) ? (value as DbRecord) : {};
  return {
    brand: requiredString(row.brand) || device?.brand || "",
    model: requiredString(row.model) || device?.model || "",
    serial_or_imei: requiredString(row.serial_or_imei) || device?.serial_or_imei || "",
    device_notes: maybeString(row.device_notes) ?? device?.device_notes,
  };
}

async function updateVersionedOrderRow({
  supabase,
  id,
  storeId,
  expectedUpdatedAt,
  update,
  context,
}: {
  supabase: SupabaseAdmin;
  id: string;
  storeId: string;
  expectedUpdatedAt: string;
  update: DbRecord;
  context: string;
}) {
  const { data, error } = await supabase
    .from("repair_orders")
    .update(update)
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();

  if (error && isMissingRepairOrderColumnError(error)) {
    const { stripped, removed } = stripOptionalOrderWriteFields(update);
    if (removed) {
      const retry = await supabase
        .from("repair_orders")
        .update(stripped)
        .eq("store_id", storeId)
        .eq("id", id)
        .eq("updated_at", expectedUpdatedAt)
        .select("updated_at")
        .maybeSingle();
      fail(retry.error, context);
      if (!retry.data) throw new Error("工单已被更新，请刷新后再试");
      return requiredString((retry.data as DbRecord).updated_at);
    }
  }

  fail(error, context);
  if (!data) throw new Error("工单已被更新，请刷新后再试");
  return requiredString((data as DbRecord).updated_at);
}

async function writeMergedPatchEvent(
  supabase: SupabaseAdmin,
  orderId: string,
  changedFields: string[],
  now: string,
  operator: string,
  storeId: string,
) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: previous, error: previousError } = await supabase
    .from("order_events")
    .select("id,payload")
    .eq("store_id", storeId)
    .eq("order_id", orderId)
    .eq("event_type", "note")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(previousError, "读取编辑时间线失败");

  const previousPayload =
    previous && typeof (previous as DbRecord).payload === "object"
      ? ((previous as DbRecord).payload as Record<string, unknown>)
      : undefined;

  if (previous && previousPayload?.action === "order_patched") {
    const existingFields = Array.isArray(previousPayload.changed_fields)
      ? previousPayload.changed_fields.filter((field): field is string => typeof field === "string")
      : [];
    const payload = {
      ...previousPayload,
      changed_fields: Array.from(new Set([...existingFields, ...changedFields])),
      currency_code: CURRENCY_CODE,
    };
    const { error } = await supabase
      .from("order_events")
      .update({ payload, operator_name: operator, created_at: now })
      .eq("store_id", storeId)
      .eq("id", requiredString((previous as DbRecord).id));
    fail(error, "更新时间线失败");
    return;
  }

  const { error } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: orderId,
    event_type: "note",
    payload: {
      action: "order_patched",
      changed_fields: changedFields,
      currency_code: CURRENCY_CODE,
    },
    operator_name: operator,
    created_at: now,
  });
  fail(error, "写入编辑时间线失败");
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
  operator: string | AuditActor = "前台",
): Promise<{ ok: boolean }> {
  const requestActor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(requestActor);
  const operatorName = operatorNameFromActor(operator);
  const customerName = input.customer_name.trim();
  const customerPhone = input.customer_phone.trim();
  const deviceBrand = input.device_brand.trim();
  const deviceModel = input.device_model.trim();
  const issueDescription = input.issue_description.trim();

  if (!id) throw new Error("工单 ID 不能为空");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");
  if (!customerName || !customerPhone) throw new Error("客户姓名和手机号不能为空");
  if (!deviceBrand || !deviceModel) throw new Error("设备品牌和型号不能为空");
  if (!issueDescription) throw new Error("故障描述不能为空");

  const validFaults = normalizeFaultPriceInput(input.fault_prices, { generateLineIds: true });
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const supabase = getSupabaseAdmin();
  const accessRow = await readOrderCustodyRow(supabase, storeId, id, requestActor, "读取工单失败");
  await assertRoutineOrderMutationAllowed(supabase, storeId, accessRow);
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select(
      `id,updated_at,status,customer_id,device_id,quotation_amount,deposit_amount,balance_amount,fault_prices,approval_status,approval_flow_status,approval_sent_at,approval_confirmed_at,warranty_text,warranty_months,warranty_change_reason,${REPAIR_ORDER_CUSTOMER_EMBED}(contact_phones)`,
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

  const currentRow = current as DbRecord;
  if (requiredString(currentRow.updated_at) !== input.expected_updated_at) {
    throw new Error("工单已被更新，请刷新后再试");
  }
  const customerId = requiredString(currentRow.customer_id);
  const deviceId = requiredString(currentRow.device_id);
  if (!customerId || !deviceId) throw new Error("工单缺少客户或设备关联");
  const phoneBook = normalizePhoneBook(customerPhone);
  if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
  const customerContactPhones = mergeContactPhones([], phoneBook.contacts, phoneBook.primaryRaw);
  await assertCustomerPhoneAvailable(
    supabase,
    storeId,
    customerId,
    phoneBook.primaryRaw,
    customerContactPhones,
  );

  const oldQuotation = money(currentRow.quotation_amount);
  const oldDeposit = money(currentRow.deposit_amount);
  const oldBalance = money(currentRow.balance_amount);
  const paidAmount = Math.max(0, oldQuotation - oldDeposit - oldBalance);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const approvalResetUpdate = buildQuoteApprovalResetUpdate({
    currentRow,
    nextFaults: validFaults,
    quotation,
    deposit,
    balance: nextBalance,
  });
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const deviceUnlock = input.device_unlock
    ? normalizeDeviceUnlockInput(input.device_unlock)
    : undefined;
  const now = new Date().toISOString();
  const defaultWarrantyMonths = await readDefaultOrderWarrantyMonths(supabase, storeId);
  const warranty = normalizeWarrantyPayload({
    warranty_months: input.warranty_months,
    warranty_text: input.warranty_text,
    warranty_change_reason: input.warranty_change_reason,
    defaultWarrantyMonths,
  });
  const previousWarrantyMonths = currentWarrantyMonths(currentRow, defaultWarrantyMonths);
  const previousWarrantyReason = maybeString(currentRow.warranty_change_reason);
  const warrantyChanged =
    previousWarrantyMonths !== warranty.warranty_months ||
    (previousWarrantyReason ?? "") !== (warranty.warranty_change_reason ?? "");
  const actorId = typeof operator === "string" ? undefined : operator.id;

  await updateVersionedOrderRow({
    supabase,
    id,
    storeId,
    expectedUpdatedAt: input.expected_updated_at,
    context: "更新工单失败",
    update: {
      issue_description: issueDescription,
      diagnosis_result: input.diagnosis_result?.trim() || null,
      internal_tag: tagInput.internalTag || null,
      accessory_notes: tagInput.accessoryNotes || null,
      ...(deviceUnlock
        ? {
            device_unlock_method: deviceUnlock.method,
            device_unlock_value: deviceUnlock.value,
            device_unlock_pattern: deviceUnlock.pattern,
          }
        : {}),
      warranty_text: warranty.warranty_text,
      warranty_months: warranty.warranty_months,
      warranty_change_reason: warranty.warranty_change_reason ?? null,
      ...(warrantyChanged
        ? { warranty_changed_by: actorId ?? null, warranty_changed_at: now }
        : {}),
      contact_phones: customerContactPhones,
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      is_paid: nextBalance === 0,
      payment_status: paymentStatusFromMoney({
        isPaid: nextBalance === 0,
        depositAmount: deposit,
        balanceAmount: nextBalance,
      }),
      fault_prices: validFaults,
      currency_code: CURRENCY_CODE,
      ...approvalResetUpdate,
      device_snapshot: {
        brand: deviceBrand,
        model: deviceModel,
        serial_or_imei: input.device_imei?.trim() ?? "",
        ...(input.device_notes?.trim() ? { device_notes: input.device_notes.trim() } : {}),
      },
      updated_at: now,
    },
  });

  const { error: customerError } = await supabase
    .from("customers")
    .update({
      name: customerName,
      phone_e164: phoneBook.primary,
      phone_raw: phoneBook.primaryRaw,
      contact_phones: customerContactPhones,
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", customerId);
  fail(customerError, "更新客户失败");

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
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
      approval_reset: Boolean(approvalResetUpdate.approval_status),
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入更新时间线失败");

  if (warrantyChanged) {
    const { error } = await supabase.from("order_events").insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      order_id: id,
      event_type: "note",
      payload: {
        action: "warranty_changed",
        from_months: previousWarrantyMonths,
        from_text: formatWarrantyText(previousWarrantyMonths),
        to_months: warranty.warranty_months,
        to_text: warranty.warranty_text,
        reason: warranty.warranty_change_reason ?? null,
        default_months: defaultWarrantyMonths,
      },
      operator_name: operatorName,
      created_at: now,
    });
    fail(error, "写入质保变更时间线失败");
  }

  return { ok: true };
}

export async function patchOrder(
  id: string,
  input: PatchOrderInput,
  operator: string | AuditActor = "前台",
): Promise<PatchOrderResult> {
  const requestActor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(requestActor);
  const operatorName = operatorNameFromActor(operator);
  if (!id) throw new Error("工单 ID 不能为空");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");

  const changeEntries = Object.entries(input.changes).filter(([, value]) => value !== undefined);
  if (changeEntries.length === 0) throw new Error("没有可保存的字段");
  const unsupportedField = changeEntries.find(([field]) => !(field in PATCH_FIELD_LABELS))?.[0];
  if (unsupportedField) throw new Error(`${unsupportedField} 不可通过快速编辑修改`);
  const editableEntries = changeEntries as [
    keyof PatchOrderInput["changes"],
    PatchOrderInput["changes"][keyof PatchOrderInput["changes"]],
  ][];

  const supabase = getSupabaseAdmin();
  const accessRow = await readOrderStatusRow(supabase, storeId, id, requestActor, "读取工单失败");
  await assertRoutineOrderMutationAllowed(supabase, storeId, accessRow);
  if (
    Object.prototype.hasOwnProperty.call(input.changes, "assignee_membership_id") &&
    accessRow.__assignment_supported !== true
  ) {
    throw new Error("负责人功能尚未完成数据库迁移，请联系店主");
  }
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select(
      `id,technician_name,customer_id,device_id,updated_at,device_snapshot,warranty_text,warranty_months,warranty_change_reason,${REPAIR_ORDER_DEVICE_EMBED}(*),${REPAIR_ORDER_CUSTOMER_EMBED}(contact_phones)`,
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

  const currentRow = current as DbRecord;
  if (requiredString(currentRow.updated_at) !== input.expected_updated_at) {
    throw new Error("工单已被更新，请刷新后再试");
  }

  const customerId = requiredString(currentRow.customer_id);
  if (!customerId) throw new Error("工单缺少客户关联");

  const device = deviceFromRow(currentRow.device);
  const nextSnapshot = snapshotFromRecord(
    currentRow.device_snapshot,
    device ? snapshotFromDevice(device) : undefined,
  );
  const existingContactPhones =
    currentRow.customer && typeof currentRow.customer === "object"
      ? stringArray((currentRow.customer as DbRecord).contact_phones)
      : [];
  const orderUpdate: DbRecord = {};
  const customerUpdate: DbRecord = {};
  const changedFields: string[] = [];

  for (const [field, rawValue] of editableEntries) {
    changedFields.push(PATCH_FIELD_LABELS[field]);

    if (field === "assignee_membership_id") {
      if (!requestActor?.isSystem && !can(requestActor, "order:assign")) {
        throw new ForbiddenError("当前角色无权分配工单负责人");
      }
      const membershipId = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!membershipId) {
        orderUpdate.assignee_membership_id = null;
        orderUpdate.technician_name = "未分配";
      } else {
        const assignee = await readAssignableOrderMember(supabase, storeId, membershipId);
        orderUpdate.assignee_membership_id = assignee.id;
        orderUpdate.technician_name = assignee.displayName;
      }
      continue;
    }

    if (field === "device_unlock") {
      Object.assign(
        orderUpdate,
        deviceUnlockUpdateFromInput(rawValue as PatchOrderInput["changes"]["device_unlock"]),
      );
      continue;
    }

    if (field === "parts_supplier_id") {
      const supplierId = typeof rawValue === "string" ? rawValue.trim() : null;
      if (supplierId) {
        const { data: supplierRow, error: supplierError } = await supabase
          .from("suppliers")
          .select("id")
          .eq("store_id", storeId)
          .eq("id", supplierId)
          .maybeSingle();
        fail(supplierError, "校验配件供应商失败");
        if (!supplierRow) throw new Error("配件供应商不存在或不属于当前店铺");
      }
      orderUpdate.parts_supplier_id = supplierId || null;
      continue;
    }

    if (field === "warranty_months") {
      const months = Number(rawValue);
      if (!Number.isInteger(months) || months < 0 || months > 36) {
        throw new Error("质保期限必须是 0 到 36 个月的整数");
      }
      orderUpdate.warranty_months = months;
      continue;
    }

    if (typeof rawValue !== "string") {
      throw new Error(`${PATCH_FIELD_LABELS[field]}格式不正确`);
    }
    const value = rawValue.trim();

    switch (field) {
      case "customer_name":
        if (!value) throw new Error("客户姓名不能为空");
        customerUpdate.name = value;
        break;
      case "customer_phone":
        if (!value) throw new Error("手机号不能为空");
        {
          const phoneBook = normalizePhoneBook(value, existingContactPhones);
          if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
          const contactPhones = mergeContactPhones(
            existingContactPhones,
            phoneBook.contacts,
            phoneBook.primaryRaw,
          );
          await assertCustomerPhoneAvailable(
            supabase,
            storeId,
            customerId,
            phoneBook.primaryRaw,
            contactPhones,
          );
          customerUpdate.phone_e164 = phoneBook.primary;
          customerUpdate.phone_raw = phoneBook.primaryRaw;
          customerUpdate.contact_phones = contactPhones;
          orderUpdate.contact_phones = contactPhones;
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
        orderUpdate.issue_description = value;
        break;
      case "diagnosis_result":
        orderUpdate.diagnosis_result = value || null;
        break;
      case "internal_tag": {
        const tagInput = normalizeOrderTagInput({ internalTag: value });
        orderUpdate.internal_tag = tagInput.internalTag || null;
        break;
      }
      case "accessory_notes": {
        const tagInput = normalizeOrderTagInput({ accessoryNotes: value });
        orderUpdate.accessory_notes = tagInput.accessoryNotes || null;
        break;
      }
      case "warranty_text":
        orderUpdate.warranty_text = value || null;
        break;
      case "warranty_change_reason":
        orderUpdate.warranty_change_reason = value || null;
        break;
    }
  }

  if (
    editableEntries.some(([field]) =>
      ["device_brand", "device_model", "device_imei", "device_notes"].includes(field),
    )
  ) {
    if (!nextSnapshot.brand || !nextSnapshot.model) throw new Error("设备品牌和型号不能为空");
    orderUpdate.device_snapshot = nextSnapshot;
  }

  const now = new Date().toISOString();
  if (
    editableEntries.some(([field]) =>
      ["warranty_text", "warranty_months", "warranty_change_reason"].includes(field),
    )
  ) {
    orderUpdate.warranty_changed_by = requestActor?.id ?? null;
    orderUpdate.warranty_changed_at = now;
  }
  orderUpdate.updated_at = now;
  const updatedAt = await updateVersionedOrderRow({
    supabase,
    id,
    storeId,
    expectedUpdatedAt: input.expected_updated_at,
    update: orderUpdate,
    context: "更新工单失败",
  });

  if (Object.keys(customerUpdate).length > 0) {
    customerUpdate.updated_at = now;
    const { error: customerError } = await supabase
      .from("customers")
      .update(customerUpdate)
      .eq("store_id", storeId)
      .eq("id", customerId);
    fail(customerError, "更新客户失败");
  }

  await writeMergedPatchEvent(supabase, id, changedFields, now, operatorName, storeId);
  return { ok: true, updated_at: updatedAt };
}

export async function patchOrderFinance(
  id: string,
  input: PatchOrderFinanceInput,
  operator: string | AuditActor = "前台",
): Promise<PatchOrderResult> {
  const requestActor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(requestActor);
  const operatorName = operatorNameFromActor(operator);
  if (!id) throw new Error("工单 ID 不能为空");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");

  const validFaults = normalizeFaultPriceInput(input.fault_prices, { generateLineIds: true });
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const supabase = getSupabaseAdmin();
  const accessRow = await readOrderStatusRow(supabase, storeId, id, requestActor, "读取工单失败");
  await assertRoutineOrderMutationAllowed(supabase, storeId, accessRow);
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select(
      "id,updated_at,status,quotation_amount,deposit_amount,balance_amount,fault_prices,approval_status,approval_flow_status,approval_sent_at,approval_confirmed_at",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

  const currentRow = current as DbRecord;
  if (requiredString(currentRow.updated_at) !== input.expected_updated_at) {
    throw new Error("工单已被更新，请刷新后再试");
  }

  const oldQuotation = money(currentRow.quotation_amount);
  const oldDeposit = money(currentRow.deposit_amount);
  const oldBalance = money(currentRow.balance_amount);
  const paidAmount = Math.max(0, oldQuotation - oldDeposit - oldBalance);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const now = new Date().toISOString();
  const approvalResetUpdate = buildQuoteApprovalResetUpdate({
    currentRow,
    nextFaults: validFaults,
    quotation,
    deposit,
    balance: nextBalance,
  });
  const updatedAt = await updateVersionedOrderRow({
    supabase,
    id,
    storeId,
    expectedUpdatedAt: input.expected_updated_at,
    update: {
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      is_paid: nextBalance === 0,
      payment_status: paymentStatusFromMoney({
        isPaid: nextBalance === 0,
        depositAmount: deposit,
        balanceAmount: nextBalance,
      }),
      fault_prices: validFaults,
      currency_code: CURRENCY_CODE,
      ...approvalResetUpdate,
      updated_at: now,
    },
    context: "更新财务失败",
  });

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "note",
    payload: {
      action: "order_finance_updated",
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      approval_reset: Boolean(approvalResetUpdate.approval_status),
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入财务时间线失败");

  return { ok: true, updated_at: updatedAt };
}

async function writeWhatsappMessage({
  id,
  body,
  templateKind,
  eventType,
  transitionTo,
  operator = "前台",
  storeId,
  actor,
  recipientPhone,
  allowInvalidTransition = false,
  markApprovalPending = false,
}: {
  id: string;
  body: string;
  templateKind: OrderWhatsappTemplateKind;
  eventType: "message_sent" | "approval_sent";
  transitionTo?: RepairOrderStatus;
  operator?: string;
  storeId: string;
  actor?: AuditActor;
  recipientPhone?: string;
  allowInvalidTransition?: boolean;
  markApprovalPending?: boolean;
}): Promise<WhatsappNotificationResult> {
  const message = body.trim();
  const requestedRecipientPhone = recipientPhone?.trim();
  if (!id) throw new Error("工单 ID 不能为空");
  if (!message) throw new Error("通知内容不能为空");

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  const current = await readOrderCustodyRow(supabase, storeId, id, actor, "读取工单失败");
  assertOrderRecordNotVoided(current);
  const recipientResolution = requestedRecipientPhone
    ? resolveWhatsappPhone(requestedRecipientPhone)
    : undefined;
  if (recipientResolution && !recipientResolution.valid) {
    throw new Error(recipientResolution.message);
  }
  const cleanRecipientPhone = recipientResolution?.valid ? recipientResolution.e164 : undefined;
  const from = current.status as RepairOrderStatus;
  let statusChanged = false;
  let to: RepairOrderStatus | undefined;
  let transitionBucket: OrderWorkflowStatus["bucket"] | undefined;
  let requiresShopCustody = templateKind === "pickup_ready" || templateKind === "unfixed_pickup";

  if (markApprovalPending && from !== "quoted" && from !== "waiting_approval") {
    throw new Error("只有报价或待审批阶段可以发送客户审批");
  }

  if (
    !transitionTo &&
    current.device_custody_status !== DEVICE_CUSTODY_WITH_SHOP &&
    (templateKind === "pickup_ready" || templateKind === "unfixed_pickup")
  ) {
    throw new Error("设备未留店，不能发送取机通知");
  }

  if (transitionTo) {
    if (transitionTo === "completed" || transitionTo === "cancelled") {
      throw new Error("完成或取消工单必须使用专用状态操作，不能随通知一起流转");
    }
    const transition = await validateConfiguredOrderTransition(
      supabase,
      storeId,
      from,
      transitionTo,
    );
    if (!transition.ok) {
      if (!allowInvalidTransition) throw new Error(transition.reason ?? "状态流转不合法");
    } else {
      assertCustodyAllowsTransition(current, transitionTo, transition.bucket);
      requiresShopCustody =
        requiresShopCustody || deviceCustodyBlocksStatus(transitionTo, transition.bucket);
      statusChanged = true;
      to = transitionTo;
      transitionBucket = transition.bucket;
    }
  }

  const update: DbRecord = { updated_at: now, notify_status: "sent" };
  if (markApprovalPending) {
    update.approval_sent_at = now;
    update.approval_status = "pending";
    update.approval_flow_status = "waiting_customer";
  }
  if (statusChanged && to) {
    update.status = to;
    Object.assign(update, deriveCanonicalUpdateFromLegacyStatus(to, now, transitionBucket));
    if (to === "waiting_approval") update.approval_sent_at = now;
  }

  const payload: Record<string, unknown> = {
    channel: "whatsapp",
    message_id: messageId,
    template_kind: templateKind,
    status_changed: statusChanged,
    currency_code: CURRENCY_CODE,
    ...(cleanRecipientPhone ? { recipient_phone: cleanRecipientPhone } : {}),
  };
  if (transitionTo) {
    payload.from = from;
    payload.to = statusChanged && to ? to : from;
  }

  const { error: messageError } = await supabase.from("message_logs").insert({
    id: messageId,
    store_id: storeId,
    order_id: id,
    channel: "whatsapp",
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  fail(messageError, "写入 WhatsApp 通知失败");

  if (requiresShopCustody) {
    await updateOrderRowWhileShopHoldsDevice({
      supabase,
      id,
      storeId,
      expectedUpdatedAt: requiredString(current.updated_at),
      update,
      context: "更新工单通知状态失败",
    });
  } else {
    await updateOrderRow({
      supabase,
      id,
      storeId,
      update,
      context: "更新工单通知状态失败",
    });
  }

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: eventType,
    payload,
    operator_name: operator,
    created_at: now,
  });
  fail(eventError, "写入通知时间线失败");

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

export async function sendNotification(
  id: string,
  body: string,
  channel: "whatsapp" | "sms" = "whatsapp",
  operator: string | AuditActor = "前台",
) {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  const message = body.trim();
  if (!message) throw new Error("通知内容不能为空");

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  const accessRow = await readOrderStatusRow(
    supabase,
    storeId,
    id,
    typeof operator === "string" ? undefined : operator,
    "读取工单失败",
  );
  assertOrderRecordNotVoided(accessRow);

  const { error: messageError } = await supabase.from("message_logs").insert({
    id: messageId,
    store_id: storeId,
    order_id: id,
    channel,
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  fail(messageError, "写入通知历史失败");

  await updateOrderRow({
    supabase,
    id,
    storeId,
    update: { notify_status: "sent", updated_at: now },
    context: "更新工单通知时间失败",
  });

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "message_sent",
    payload: { channel, message_id: messageId },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入通知时间线失败");

  return { ok: true, id: messageId, channel, body: message };
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
  operator: string | AuditActor = "前台",
  recipientPhone?: string,
) {
  const actor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(actor);
  return writeWhatsappMessage({
    id,
    body,
    templateKind,
    eventType: "message_sent",
    transitionTo,
    operator: operatorNameFromActor(operator),
    storeId,
    actor,
    recipientPhone,
  });
}

export async function sendApprovalRequest(
  id: string,
  body: string,
  operator: string | AuditActor = "前台",
  recipientPhone?: string,
) {
  const actor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(actor);
  return writeWhatsappMessage({
    id,
    body,
    templateKind: "approval_request",
    eventType: "approval_sent",
    transitionTo: "waiting_approval",
    operator: operatorNameFromActor(operator),
    storeId,
    actor,
    recipientPhone,
    allowInvalidTransition: true,
    markApprovalPending: true,
  });
}

export async function createOrder(
  input: CreateOrderInput,
  operator: string | AuditActor = "前台",
): Promise<{ id: string; replayed?: boolean }> {
  const requestActor = typeof operator === "string" ? undefined : operator;
  const storeId = requireStoreIdFromActor(requestActor);
  assertNewOrderExpectedStore(input.expected_store_id, storeId);
  const operatorName = operatorNameFromActor(operator);
  const operationId = input.operation_id?.trim() || crypto.randomUUID();
  if (
    input.assignee_membership_id &&
    !requestActor?.isSystem &&
    !can(requestActor, "order:assign")
  ) {
    throw new ForbiddenError("当前角色无权分配工单负责人");
  }
  const deviceCustodyStatus = input.device_custody_status ?? DEVICE_CUSTODY_WITH_SHOP;

  const validFaults = normalizeFaultPriceInput(input.fault_prices, { generateLineIds: true });
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");
  if (input.device_id && !input.customer_id) throw new Error("选择现有设备时必须同时选择客户");

  const supabase = getSupabaseAdmin();
  if (operationId) {
    const existing = await findCreatedOrderByOperationId(supabase, storeId, operationId);
    if (existing) return { id: existing.id, replayed: true };
  }
  const requestedAssignee = input.assignee_membership_id?.trim();
  if (requestedAssignee && !(await isOrderAssignmentSupported(supabase, storeId))) {
    throw new Error("负责人功能尚未完成数据库迁移，请联系店主");
  }
  const assignee = requestedAssignee
    ? await readAssignableOrderMember(supabase, storeId, requestedAssignee)
    : requestActor?.activeMembershipId
      ? { id: requestActor.activeMembershipId, displayName: operatorName }
      : undefined;
  const technicianName = assignee?.displayName.trim() || operatorName.trim() || "前台";
  const initialStatus = await resolveInitialOrderStatus(supabase, storeId, input.status);
  if (!deviceCustodyAllowsStatus(deviceCustodyStatus, initialStatus.code, initialStatus.bucket)) {
    throw new Error("客户持有设备时不能使用需要门店保管设备的初始状态");
  }
  const status = initialStatus.code;
  const now = new Date().toISOString();
  const defaultWarrantyMonths = await readDefaultOrderWarrantyMonths(supabase, storeId);
  const warranty = normalizeWarrantyPayload({
    warranty_months: input.warranty_months,
    warranty_text: input.warranty_text,
    warranty_change_reason: input.warranty_change_reason,
    defaultWarrantyMonths,
  });
  const warrantyChangedFromDefault = warrantyReasonRequired(
    warranty.warranty_months,
    defaultWarrantyMonths,
  );
  const actorId = typeof operator === "string" ? undefined : operator.id;

  if (!actorId)
    throw new OrderCustomerIdentityError("缺少当前操作人员身份", "actor_forbidden", 403);
  const phoneBook = input.customer_phone?.trim()
    ? normalizePhoneBook(input.customer_phone)
    : undefined;
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        ...input,
        operation_id: operationId,
        customer_identity_resolution: undefined,
      }),
    )
    .digest("hex");
  const deviceUnlock = normalizeDeviceUnlockInput(
    normalizeUnlockForCustody(deviceCustodyStatus, input.device_unlock),
  );
  const balance = Math.max(0, quotation - deposit);
  const workflowStatus = canonicalWorkflowStatusFromBucket(initialStatus.bucket, status);
  const canonicalDefaults = deriveCanonicalUpdateFromLegacyStatus(
    status,
    now,
    initialStatus.bucket,
  );
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const { data: atomicResultData, error: atomicResultError } = await supabase.rpc(
    "repairdesk_create_order_v2",
    {
      p_store_id: storeId,
      p_actor_id: actorId,
      p_operation_id: operationId,
      p_request_hash: requestHash,
      p_payload: {
        customer_id: input.customer_id?.trim() || null,
        customer_name: input.customer_name?.trim() || "",
        customer_phone: input.customer_phone?.trim() || "",
        phone_raw: phoneBook?.primaryRaw || "",
        phone_e164: phoneBook?.primary || "",
        contact_phones: phoneBook?.contacts ?? [],
        customer_identity_resolution: input.customer_identity_resolution ?? { mode: "auto" },
        device_id: input.device_id?.trim() || null,
        device_brand: input.device_brand?.trim() || "",
        device_model: input.device_model?.trim() || "",
        device_imei: input.device_imei?.trim() || "",
        device_notes: input.device_notes?.trim() || "",
        order: {
          order_type: input.order_type,
          status,
          workflow_status: workflowStatus,
          exception_status: canonicalDefaults.exception_status,
          payment_status: paymentStatusFromMoney({
            isPaid: balance === 0,
            depositAmount: deposit,
            balanceAmount: balance,
          }),
          approval_flow_status: canonicalDefaults.approval_flow_status,
          parts_status: canonicalDefaults.parts_status,
          notify_status: canonicalDefaults.notify_status,
          issue_description: input.issue_description.trim(),
          quotation_amount: quotation,
          deposit_amount: deposit,
          balance_amount: balance,
          is_paid: balance === 0,
          technician_name: technicianName,
          assignee_membership_id: assignee?.id ?? null,
          internal_tag: tagInput.internalTag || null,
          accessory_notes: tagInput.accessoryNotes || null,
          device_custody_status: deviceCustodyStatus,
          device_unlock_method: deviceUnlock.method,
          device_unlock_value: deviceUnlock.value ?? null,
          device_unlock_pattern: deviceUnlock.pattern ?? null,
          warranty_text: warranty.warranty_text,
          warranty_months: warranty.warranty_months,
          warranty_change_reason: warranty.warranty_change_reason ?? null,
          warranty_changed_by: warrantyChangedFromDefault ? actorId : null,
          warranty_changed_at: warrantyChangedFromDefault ? now : null,
          fault_prices: validFaults,
          cost_inputs: (input.cost_inputs ?? [])
            .filter((item) => item.mode !== "default")
            .map((item) => ({
              line_id: item.line_id,
              mode: item.mode,
              ...(item.mode === "manual" ? { amount: item.amount } : {}),
            })),
          operator_name: operatorName,
        },
      },
    },
  );
  if (atomicResultError) {
    const migrationMissing = ["PGRST202", "42883"].includes(atomicResultError.code ?? "");
    throw new OrderCustomerIdentityError(
      migrationMissing
        ? "工单原子创建迁移尚未应用，已阻止旧流程继续写入"
        : "创建工单事务失败，请重试",
      migrationMissing ? "ORDER_CREATE_MIGRATION_REQUIRED" : "ORDER_CREATE_TRANSACTION_FAILED",
      503,
    );
  }
  const atomicResult = (atomicResultData ?? {}) as Record<string, unknown>;
  if (atomicResult.ok === true && typeof atomicResult.id === "string") {
    return { id: atomicResult.id, replayed: atomicResult.replayed === true };
  }
  const atomicCode = typeof atomicResult.code === "string" ? atomicResult.code : "unknown";
  if (atomicCode === "customer_identity_conflict") {
    throw new OrderCustomerIdentityError(
      "电话号码与客户姓名不一致",
      "CUSTOMER_IDENTITY_CONFLICT",
      409,
      {
        conflictToken: atomicResult.conflictToken,
        allowedResolutions: atomicResult.allowedResolutions,
        candidates: atomicResult.candidates,
      },
    );
  }
  throw orderCustomerIdentityFailure(atomicCode);
}

export async function getOrderCreateOperationStatus(
  operationId: string,
  actor?: AuditActor,
): Promise<{ status: "pending" } | { status: "created"; id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  const existing = await findCreatedOrderByOperationId(getSupabaseAdmin(), storeId, operationId);
  return existing ? { status: "created", id: existing.id } : { status: "pending" };
}

async function findCreatedOrderByOperationId(
  supabase: SupabaseAdmin,
  storeId: string,
  operationId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("order_events")
    .select("order_id")
    .eq("store_id", storeId)
    .eq("event_type", "created")
    .contains("payload", { operation_id: operationId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "确认创建结果失败");
  const id = maybeString((data as DbRecord | null)?.order_id);
  return id ? { id } : null;
}
export async function getRepairDeskOptions(actor?: AuditActor): Promise<RepairDeskOptions> {
  const storeId = requireStoreIdFromActor(actor);
  const canReadSuppliers = can(actor, "supplier:read");
  const supabase = getSupabaseAdmin();
  const assignmentSupported = await isOrderAssignmentSupported(supabase, storeId);
  const canAssignOrders = assignmentSupported && can(actor, "order:assign");
  const supplierResult = canReadSuppliers
    ? await supabase
        .from("suppliers")
        .select("*")
        .eq("store_id", storeId)
        .order("name", { ascending: true })
    : { data: [], error: null };
  const technicianResult =
    isTechnicianActor(actor) && !assignmentSupported
      ? { data: [], error: null }
      : await (() => {
          let query = supabase
            .from("repair_orders")
            .select("technician_name")
            .eq("store_id", storeId);
          if (isTechnicianActor(actor)) {
            if (!actor?.activeMembershipId) throw new ForbiddenError("缺少当前店铺成员身份");
            query = query.eq("assignee_membership_id", actor.activeMembershipId);
          }
          return query;
        })();
  const { data: technicianRows, error: techError } = technicianResult;
  const { data: assigneeRows, error: assigneeError } = canAssignOrders
    ? await supabase
        .from("store_memberships")
        .select("id,display_name,email,role,status")
        .eq("store_id", storeId)
        .eq("status", "active")
        .in("role", ["owner", "manager", "technician", "sales"])
        .order("display_name", { ascending: true })
    : { data: [], error: null };
  fail(supplierResult.error, "读取供应商失败");
  fail(techError, "读取技师失败");
  fail(assigneeError, "读取工单负责人失败");

  const { canPrintSingleOrders, canBatchPrintOrders } = projectOrderPrintPermissions(actor);

  return {
    suppliers: ((supplierResult.data ?? []) as DbRecord[])
      .map(supplierFromRow)
      .filter((supplier): supplier is Supplier => Boolean(supplier))
      .filter((supplier) => !supplier.archived_at),
    technicians: Array.from(
      new Set(
        ((technicianRows ?? []) as DbRecord[])
          .map((row) => maybeString(row.technician_name))
          .filter((name): name is string => Boolean(name)),
      ),
    ).sort((a, b) => a.localeCompare(b, "zh-CN")),
    assigneeOptions: ((assigneeRows ?? []) as DbRecord[]).map(
      (row): OrderAssigneeOption => ({
        id: requiredString(row.id),
        display_name:
          maybeString(row.display_name) ?? requiredString(row.email).split("@")[0] ?? "员工",
        role: requiredString(row.role) as OrderAssigneeOption["role"],
      }),
    ),
    permissions: {
      canReadSuppliers,
      canAssignSuppliers: can(actor, "supplier:assign"),
      canManageSuppliers: can(actor, "supplier:manage"),
      canReadInventory: can(actor, "inventory:read"),
      canSearchOrderArchive: canSearchOrderArchive(actor),
      canBrowseOrderArchive: can(actor, "order:archive_browse"),
      canReadOrderFinance: can(actor, "finance:order_read"),
      canReadAggregateFinance: can(actor, "finance:aggregate_read"),
      canReadProfit: can(actor, "finance:profit_read"),
      canPrintSingleOrders,
      canBatchPrintOrders,
      canExportOrders: canBatchPrintOrders,
      canBatchTransitionOrders: can(actor, "order:batch_transition"),
      canAssignOrders,
    },
  };
}

export function projectOrderPrintPermissions(actor?: AuditActor) {
  const actorRole = actor?.storeRole ?? actor?.role;
  const canPrintSingleOrders =
    actorRole !== "viewer" &&
    can(actor, "order:detail", {
      scopeSatisfied: actorRole === "technician" ? Boolean(actor?.activeMembershipId) : false,
    });
  const canBatchPrintOrders = can(actor, "order:export");
  return { canPrintSingleOrders, canBatchPrintOrders };
}

async function isOrderAssignmentSupported(supabase: SupabaseAdmin, storeId: string) {
  const { error } = await supabase
    .from("repair_orders")
    .select("assignee_membership_id")
    .eq("store_id", storeId)
    .limit(1);
  if (!error) return true;
  if (isMissingRepairOrderColumnError(error)) return false;
  fail(error, "检查工单负责人功能失败");
  return false;
}
