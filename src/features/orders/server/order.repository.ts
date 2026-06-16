import { Buffer } from "node:buffer";

import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
} from "@/lib/mock/workflow";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { CURRENCY_CODE } from "@/lib/money";
import type {
  AuditActor,
  CreateOrderInput,
  DeviceSnapshot,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
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
  PatchOrderFinanceInput,
  PatchOrderInput,
  PatchOrderResult,
  RepairDeskOptions,
  Supplier,
  UpdateOrderInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { normalizeOrderTagInput } from "@/features/orders/model/order-tags";
import { orderTransitionRequiresReason } from "@/features/orders/model/order-transition-reasons";
import {
  approvalFlowStatusFromLegacyStatus,
  legacyStatusFromWorkflowStatus,
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
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import {
  ORDER_LIST_SELECT,
  ORDER_SELECT,
  type DbRecord,
  attachmentFromRow,
  customerFromRow,
  decorate,
  deviceFromRow,
  eventFromRow,
  fail,
  fetchOrderRows,
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
import { assertStaffRole } from "@/server/auth-context";

function filterOrders(rows: OrderListItem[], filters: OrderListFilters = {}) {
  let result = rows;
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (o) =>
        o.public_no.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        phoneMatches(o.customer_phone, q) ||
        o.contact_phones.some((phone) => phoneMatches(phone, q)) ||
        o.device_imei.toLowerCase().includes(q) ||
        o.device_label.toLowerCase().includes(q),
    );
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
  if (filters.exceptionStatuses?.length) {
    result = result.filter(
      (o) => o.exception_status && filters.exceptionStatuses!.includes(o.exception_status),
    );
  }
  if (filters.paymentStatuses?.length) {
    result = result.filter(
      (o) => o.payment_status && filters.paymentStatuses!.includes(o.payment_status),
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
    result = result.filter((o) => (filters.paid === "paid" ? o.is_paid : !o.is_paid));
  }
  if (filters.overdue) {
    result = result.filter((o) =>
      filters.overdue === "approval"
        ? o.approval_overdue
        : filters.overdue === "pickup"
          ? o.pickup_overdue
          : o.approval_overdue || o.pickup_overdue,
    );
  }

  return result.sort((a, b) => {
    const workflowSort =
      orderWorkflowStatuses.indexOf(a.workflow_status ?? workflowStatusFromLegacyStatus(a.status)) -
      orderWorkflowStatuses.indexOf(b.workflow_status ?? workflowStatusFromLegacyStatus(b.status));
    if (workflowSort !== 0) return workflowSort;
    const statusSort = getStatusListSortIndex(a.status) - getStatusListSortIndex(b.status);
    if (statusSort !== 0) return statusSort;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
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

async function readWorkflowCountsFromSupabase(storeId: string, filters: OrderListFilters) {
  const supabase = getSupabaseAdmin();

  const readCount = async (workflowStatus?: OrderWorkflowStatusCode) => {
    let query = supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);

    if (filters.statuses?.length) query = query.in("status", filters.statuses);
    if (workflowStatus) query = query.eq("workflow_status", workflowStatus);
    if (filters.exceptionStatuses?.length) {
      query = query.in("exception_status", filters.exceptionStatuses);
    }
    if (filters.paymentStatuses?.length) {
      query = query.in("payment_status", filters.paymentStatuses);
    }
    if (filters.partsStatuses?.length) query = query.in("parts_status", filters.partsStatuses);
    if (filters.approvalFlowStatuses?.length) {
      query = query.in("approval_flow_status", filters.approvalFlowStatuses);
    }
    if (filters.types?.length) query = query.in("order_type", filters.types);
    if (filters.technicians?.length) query = query.in("technician_name", filters.technicians);
    if (filters.supplierIds?.length) query = query.in("supplier_id", filters.supplierIds);
    if (filters.paid && filters.paid !== "all") {
      query = query.eq("is_paid", filters.paid === "paid");
    }

    const { error, count } = await query;
    fail(error, "读取流程阶段数量失败");
    return count ?? 0;
  };

  const [all, ...stageCounts] = await Promise.all([
    readCount(),
    ...orderWorkflowStatuses.map((status) => readCount(status)),
  ]);
  const counts = createWorkflowCounts();
  counts.all = all;
  orderWorkflowStatuses.forEach((status, index) => {
    counts[status] = stageCounts[index] ?? 0;
  });
  return counts;
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

function isCanonicalWorkflowStatus(status: string): status is OrderWorkflowStatusCode {
  return orderWorkflowStatuses.includes(status as OrderWorkflowStatusCode);
}

function assertCanonicalWorkflowTransition(
  from: OrderWorkflowStatusCode,
  to: OrderWorkflowStatusCode,
) {
  if (from === to) return;
  const fromIndex = orderWorkflowStatuses.indexOf(from);
  const toIndex = orderWorkflowStatuses.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || toIndex !== fromIndex + 1) {
    throw new Error("主流程只能按顺序推进");
  }
}

function deriveCanonicalUpdateFromLegacyStatus(status: RepairOrderStatus, now: string) {
  const workflowStatus = workflowStatusFromLegacyStatus(status);
  return {
    workflow_status: workflowStatus,
    exception_status:
      status === "cancelled"
        ? "cancelled"
        : status === "rework"
          ? "rework"
          : status === "unfixed_pickup"
            ? "returned_unfixed"
            : null,
    approval_flow_status: approvalFlowStatusFromLegacyStatus(status),
    parts_status: partsStatusFromLegacyStatus(status),
    notify_status: status === "completed" ? "sent" : notifyStatusFromLegacyStatus(status),
    ...(workflowStatus === "closed" || status === "completed" ? { completed_at: now } : {}),
    ...(status === "waiting_approval" ? { approval_sent_at: now } : {}),
  };
}

async function validateConfiguredOrderTransition(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  from: RepairOrderStatus,
  to: RepairOrderStatus,
) {
  if (from === to) return { ok: false, reason: "目标状态与当前一致" };

  const { data: target, error: targetError } = await supabase
    .from("order_workflow_statuses")
    .select("code,label,enabled")
    .eq("store_id", storeId)
    .eq("code", to)
    .maybeSingle();
  fail(targetError, "读取目标状态失败");
  if (!target) return { ok: false, reason: "目标状态不存在" };
  if (!(target as DbRecord).enabled) {
    const toLabel = maybeString((target as DbRecord).label) || to;
    return { ok: false, reason: `「${toLabel}」已停用，不能流转到该状态` };
  }

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
    const toLabel = maybeString((target as DbRecord).label) || to;
    return { ok: false, reason: `「${fromLabel}」不能直接流转到「${toLabel}」` };
  }
  return { ok: true };
}

async function assertWorkflowTargetEnabled(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  code: RepairOrderStatus,
) {
  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .select("label,enabled")
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
}

async function resolveInitialOrderStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  requested: RepairOrderStatus,
) {
  const { data: requestedStatus, error } = await supabase
    .from("order_workflow_statuses")
    .select("code,allowed_for_create,enabled")
    .eq("store_id", storeId)
    .eq("code", requested)
    .maybeSingle();
  fail(error, "检查初始状态失败");

  if (requestedStatus) {
    const row = requestedStatus as DbRecord;
    if (Boolean(row.enabled) && Boolean(row.allowed_for_create)) return requiredString(row.code);
    throw new Error("初始状态不允许用于新建工单");
  }

  const { data: defaultStatus, error: defaultError } = await supabase
    .from("order_workflow_statuses")
    .select("code")
    .eq("store_id", storeId)
    .eq("enabled", true)
    .eq("allowed_for_create", true)
    .order("is_default_create_status", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  fail(defaultError, "读取默认初始状态失败");

  if (defaultStatus) return requiredString((defaultStatus as DbRecord).code);
  if (ORDER_STATUS_ALLOWED_FOR_CREATE.includes(requested)) return requested;
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
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
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
    unpaid: rows.filter((order) => !order.is_paid).length,
    approvalOverdue: rows.filter((order) => order.approval_overdue).length,
    pickupOverdue: rows.filter((order) => order.pickup_overdue).length,
  };
}

export async function listOrders(
  filters: OrderListFilters = {},
  actor?: AuditActor,
): Promise<OrderListItem[]> {
  const storeId = requireStoreIdFromActor(actor);
  return filterOrders((await fetchOrderRows(storeId)).map(decorate), filters);
}

export async function listOrdersPage(
  input: OrderListPageInput = {},
  actor?: AuditActor,
): Promise<OrderListResult> {
  const storeId = requireStoreIdFromActor(actor);
  const { page, pageSize } = normalizePageInput(input);
  const filters: OrderListFilters = {
    search: input.search,
    statuses: input.statuses,
    workflowStatuses: input.workflowStatuses,
    exceptionStatuses: input.exceptionStatuses,
    paymentStatuses: input.paymentStatuses,
    partsStatuses: input.partsStatuses,
    approvalFlowStatuses: input.approvalFlowStatuses,
    types: input.types,
    technicians: input.technicians,
    supplierIds: input.supplierIds,
    paid: input.paid,
    overdue: input.overdue,
  };

  if (filters.search?.trim() || filters.overdue) {
    const rows = (await fetchOrderRows(storeId)).map(decorate);
    const all = filterOrders(rows, filters);
    const workflowCounts = countWorkflowRows(filterOrders(rows, filtersForWorkflowCounts(filters)));
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      workflowCounts,
    };
  }

  const supabase = getSupabaseAdmin();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("repair_orders")
    .select(ORDER_LIST_SELECT, { count: "exact" })
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.workflowStatuses?.length) {
    query = query.in("workflow_status", filters.workflowStatuses);
  }
  if (filters.exceptionStatuses?.length) {
    query = query.in("exception_status", filters.exceptionStatuses);
  }
  if (filters.paymentStatuses?.length) {
    query = query.in("payment_status", filters.paymentStatuses);
  }
  if (filters.partsStatuses?.length) {
    query = query.in("parts_status", filters.partsStatuses);
  }
  if (filters.approvalFlowStatuses?.length) {
    query = query.in("approval_flow_status", filters.approvalFlowStatuses);
  }
  if (filters.types?.length) query = query.in("order_type", filters.types);
  if (filters.technicians?.length) query = query.in("technician_name", filters.technicians);
  if (filters.supplierIds?.length) query = query.in("supplier_id", filters.supplierIds);
  if (filters.paid && filters.paid !== "all") query = query.eq("is_paid", filters.paid === "paid");

  const { data, error, count } = await query;
  if (error && isMissingRepairOrderColumnError(error)) {
    const rows = (await fetchOrderRows(storeId)).map(decorate);
    const all = filterOrders(rows, filters);
    const workflowCounts = countWorkflowRows(filterOrders(rows, filtersForWorkflowCounts(filters)));
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      workflowCounts,
    };
  }
  fail(error, "读取工单失败");

  const total = count ?? 0;
  const workflowCounts = await readWorkflowCountsFromSupabase(
    storeId,
    filtersForWorkflowCounts(filters),
  );
  return {
    items: ((data ?? []) as DbRecord[]).map(decorate),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    workflowCounts,
  };
}

export async function getOrderStats(actor?: AuditActor): Promise<OrderStats> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const approvalCutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const pickupCutoff = new Date(Date.now() - 5 * 86400 * 1000).toISOString();

  const [
    totalResult,
    todayResult,
    inProgressResult,
    unpaidResult,
    approvalOverdueResult,
    pickupOverdueResult,
  ] = await Promise.all([
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", today.toISOString()),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .in("workflow_status", ["intake", "diagnosis", "quote", "parts", "repair", "pickup"]),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("is_paid", false),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("approval_flow_status", "waiting_customer")
      .lt("approval_sent_at", approvalCutoff),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("workflow_status", "pickup")
      .or(
        `completed_at.lt.${pickupCutoff},and(completed_at.is.null,updated_at.lt.${pickupCutoff})`,
      ),
  ]);

  const statErrors = [
    totalResult.error,
    todayResult.error,
    inProgressResult.error,
    unpaidResult.error,
    approvalOverdueResult.error,
    pickupOverdueResult.error,
  ];
  if (statErrors.some(isMissingRepairOrderColumnError)) {
    return deriveOrderStatsFromRows((await fetchOrderRows(storeId)).map(decorate));
  }

  fail(totalResult.error, "统计工单总数失败");
  fail(todayResult.error, "统计今日工单失败");
  fail(inProgressResult.error, "统计进行中工单失败");
  fail(unpaidResult.error, "统计未结清工单失败");
  fail(approvalOverdueResult.error, "统计报价超期工单失败");
  fail(pickupOverdueResult.error, "统计取件超期工单失败");

  return {
    total: totalResult.count ?? 0,
    today: todayResult.count ?? 0,
    inProgress: inProgressResult.count ?? 0,
    unpaid: unpaidResult.count ?? 0,
    approvalOverdue: approvalOverdueResult.count ?? 0,
    pickupOverdue: pickupOverdueResult.count ?? 0,
  };
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
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("repair_orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(orderError, "读取工单详情失败");

  const [
    { data: eventRows, error: eventError },
    { data: messageRows, error: messageError },
    { data: attachmentRows, error: attachmentError },
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
  ]);

  fail(eventError, "读取时间线失败");
  fail(messageError, "读取通知历史失败");
  if (attachmentError && !isMissingOrderAttachmentsTableError(attachmentError)) {
    fail(attachmentError, "读取工单附件失败");
  }

  const row = orderRow as DbRecord;
  return {
    order: decorate(row),
    customer: customerFromRow(row.customer),
    device: deviceFromRow(row.device),
    supplier: supplierFromRow(row.supplier),
    events: ((eventRows ?? []) as DbRecord[]).map(eventFromRow),
    messages: ((messageRows ?? []) as DbRecord[]).map(messageFromRow),
    attachments: attachmentError
      ? []
      : await attachSignedUrls(supabase, (attachmentRows ?? []) as DbRecord[]),
  };
}

export async function uploadOrderAttachment(
  id: string,
  input: OrderAttachmentUploadInput,
  actor?: AuditActor,
): Promise<OrderAttachmentUploadResult> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const supabase = getSupabaseAdmin();
  await readOrderStatusRow(supabase, storeId, id, "读取工单失败");

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
  fail(uploadError, "上传工单附件失败");

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

  const [attachment] = await attachSignedUrls(supabase, [data as DbRecord]);
  return { attachment };
}

export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string; operator?: string | AuditActor; storeId?: string } = {},
) {
  const storeId = requireStoreIdFromActor(
    opts.storeId ?? (typeof opts.operator === "string" ? undefined : opts.operator),
  );
  const operatorName = operatorNameFromActor(opts.operator, "系统");
  const supabase = getSupabaseAdmin();
  const currentRow = await readOrderStatusRow(supabase, storeId, id);
  const from = currentRow.status as RepairOrderStatus;
  const workflowFrom =
    (maybeString(currentRow.workflow_status) as OrderWorkflowStatusCode | undefined) ??
    workflowStatusFromLegacyStatus(from);
  const canonicalRequest = isCanonicalWorkflowStatus(to);
  const workflowTo = canonicalRequest ? to : workflowStatusFromLegacyStatus(to);
  const legacyTo = canonicalRequest
    ? legacyStatusFromWorkflowStatus(workflowTo, {
        partsStatus: maybeString(currentRow.parts_status) as never,
        exceptionStatus: maybeString(currentRow.exception_status) as never,
      })
    : to;
  const cleanReason = opts.reason?.trim();

  if (canonicalRequest) {
    assertCanonicalWorkflowTransition(workflowFrom, workflowTo);
  } else {
    const validation = await validateConfiguredOrderTransition(supabase, storeId, from, to);
    if (!validation.ok) throw new Error(validation.reason ?? "状态流转不合法");
  }
  if (orderTransitionRequiresReason(legacyTo) && !cleanReason) {
    throw new Error(
      `流转到「${await readWorkflowStatusLabel(supabase, storeId, legacyTo)}」需要填写原因`,
    );
  }
  if (legacyTo === "completed" && (!currentRow.is_paid || money(currentRow.balance_amount) > 0)) {
    throw new Error("工单仍有未结清尾款，不能直接结案");
  }

  const now = new Date().toISOString();
  const update: DbRecord = {
    status: legacyTo,
    updated_at: now,
    ...deriveCanonicalUpdateFromLegacyStatus(legacyTo, now),
    workflow_status: workflowTo,
  };
  if (legacyTo === "cancelled") update.cancel_reason = cleanReason || "未填写";
  if (legacyTo === "unfixed_pickup" && cleanReason) {
    update.diagnosis_result = buildTransitionDiagnosisResult(
      maybeString(currentRow.diagnosis_result),
      cleanReason,
    );
  }

  await updateOrderRow({
    supabase,
    id,
    storeId,
    update,
    context: "更新工单状态失败",
  });

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "status_changed",
    payload: {
      from,
      to: legacyTo,
      workflow_from: workflowFrom,
      workflow_to: workflowTo,
      reason: cleanReason,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入状态时间线失败");

  return { ok: true, from, to: legacyTo };
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
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to, { operator: operatorName, storeId });
      count++;
    } catch (error) {
      failures.push({ id, reason: (error as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

const APPROVAL_APPROVED_TARGETS = ["repairing", "parts_ordered"] as const;
const APPROVAL_REJECTED_TARGETS = ["unfixed_pickup", "cancelled"] as const;

export async function decideOrderApproval(
  id: string,
  input: OrderApprovalDecisionInput,
  operator: string | AuditActor = "前台",
): Promise<OrderApprovalDecisionResult> {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  const supabase = getSupabaseAdmin();
  const currentRow = await readOrderStatusRow(supabase, storeId, id, "读取审批状态失败");
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
        ? "客户同意后只能进入维修或订件流程"
        : "客户拒绝后只能进入未修取机或取消流程",
    );
  }
  if (input.decision === "rejected" && !cleanReason) {
    throw new Error("客户拒绝报价需要填写原因");
  }

  if (input.decision === "approved") {
    const validation = await validateConfiguredOrderTransition(supabase, storeId, from, target);
    if (!validation.ok) throw new Error(validation.reason ?? "状态流转不合法");
  } else {
    await assertWorkflowTargetEnabled(supabase, storeId, target);
  }

  const now = new Date().toISOString();
  const update: DbRecord = {
    status: target,
    updated_at: now,
    ...deriveCanonicalUpdateFromLegacyStatus(target, now),
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

  await updateOrderRow({
    supabase,
    id,
    storeId,
    update,
    context: "更新客户审批结果失败",
  });

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "approval_result",
    payload: {
      result: input.decision,
      from,
      to: target,
      reason: cleanReason,
      approval_flow_status: input.decision,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入审批结果时间线失败");

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
) {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("收款金额必须大于 0");
  if (!expectedUpdatedAt) throw new Error("缺少工单版本时间");

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("updated_at,balance_amount,is_paid")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取尾款失败");

  const currentRow = current as DbRecord;
  if (requiredString(currentRow.updated_at) !== expectedUpdatedAt) {
    throw new Error("工单已被更新，请刷新后再试");
  }
  const balance = money(currentRow.balance_amount);
  if (balance <= 0 || currentRow.is_paid) throw new Error("该工单已结清");
  if (amount > balance) throw new Error("收款金额不能超过未结清尾款");

  const nextBalance = Math.max(0, balance - amount);
  const isPaid = nextBalance === 0;
  const now = new Date().toISOString();
  const updatedAt = await updateVersionedOrderRow({
    supabase,
    id,
    storeId,
    expectedUpdatedAt,
    context: "登记收款失败",
    update: {
      balance_amount: nextBalance,
      is_paid: isPaid,
      payment_status: paymentStatusFromMoney({
        isPaid,
        depositAmount: amount,
        balanceAmount: nextBalance,
      }),
      updated_at: now,
    },
  });

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "payment",
    payload: { amount, method, balance: nextBalance, currency_code: CURRENCY_CODE },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入收款时间线失败");

  return { ok: true, balance: nextBalance, is_paid: nextBalance === 0, updated_at: updatedAt };
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

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
  return bytes;
}

async function attachSignedUrls(
  supabase: SupabaseAdmin,
  rows: DbRecord[] | null | undefined,
): Promise<OrderAttachment[]> {
  const attachments = (rows ?? []).map(attachmentFromRow);
  return Promise.all(
    attachments.map(async (attachment) => {
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

const CANONICAL_ORDER_WRITE_FIELDS = [
  "workflow_status",
  "exception_status",
  "payment_status",
  "approval_flow_status",
  "parts_status",
  "notify_status",
] as const;

function stripCanonicalOrderWriteFields(row: DbRecord) {
  const stripped: DbRecord = {};
  let removed = false;
  for (const [key, value] of Object.entries(row)) {
    if ((CANONICAL_ORDER_WRITE_FIELDS as readonly string[]).includes(key)) {
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
  context = "读取当前状态失败",
) {
  const canonical = await supabase
    .from("repair_orders")
    .select(
      "id,status,workflow_status,parts_status,exception_status,diagnosis_result,balance_amount,is_paid,approval_status,approval_flow_status",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  if (!canonical.error || !isMissingRepairOrderColumnError(canonical.error)) {
    fail(canonical.error, context);
    return canonical.data as DbRecord;
  }

  const legacy = await supabase
    .from("repair_orders")
    .select("id,status,balance_amount,is_paid,approval_status")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(legacy.error, context);
  return legacy.data as DbRecord;
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
    const { stripped, removed } = stripCanonicalOrderWriteFields(update);
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

async function insertOrderRow({
  supabase,
  row,
  context,
}: {
  supabase: SupabaseAdmin;
  row: DbRecord;
  context: string;
}) {
  const { data, error } = await supabase.from("repair_orders").insert(row).select("id").single();
  if (error && isMissingRepairOrderColumnError(error)) {
    const { stripped, removed } = stripCanonicalOrderWriteFields(row);
    if (removed) {
      const retry = await supabase.from("repair_orders").insert(stripped).select("id").single();
      fail(retry.error, context);
      return retry.data as DbRecord;
    }
  }
  fail(error, context);
  return data as DbRecord;
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

const PATCH_FIELD_LABELS: Record<keyof PatchOrderInput["changes"], string> = {
  customer_name: "客户姓名",
  customer_phone: "手机号",
  device_brand: "设备品牌",
  device_model: "设备型号",
  device_imei: "IMEI/序列号",
  device_notes: "设备备注",
  issue_description: "故障描述",
  diagnosis_result: "诊断结果",
  accessory_notes: "留存备注",
  warranty_text: "质保",
};

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
    const { stripped, removed } = stripCanonicalOrderWriteFields(update);
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
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
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

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select(
      "id,updated_at,customer_id,device_id,quotation_amount,deposit_amount,balance_amount,warranty_text,warranty_months,warranty_change_reason,customer:customers(contact_phones)",
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
  const existingContactPhones =
    currentRow.customer && typeof currentRow.customer === "object"
      ? stringArray((currentRow.customer as DbRecord).contact_phones)
      : [];
  const customerContactPhones = mergeContactPhones(
    existingContactPhones,
    phoneBook.contacts,
    phoneBook.primaryRaw,
  );
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
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
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
      warranty_months: warranty.warranty_months,
      warranty_text: warranty.warranty_text,
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
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  if (!id) throw new Error("工单 ID 不能为空");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");

  const changeEntries = Object.entries(input.changes).filter(([, value]) => value !== undefined);
  if (changeEntries.length === 0) throw new Error("没有可保存的字段");
  const unsupportedField = changeEntries.find(([field]) => !(field in PATCH_FIELD_LABELS))?.[0];
  if (unsupportedField) throw new Error(`${unsupportedField} 不可通过快速编辑修改`);
  const editableEntries = changeEntries as [keyof PatchOrderInput["changes"], string][];

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select(
      "id,customer_id,device_id,updated_at,device_snapshot,device:devices(*),customer:customers(contact_phones)",
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
    const value = rawValue.trim();
    changedFields.push(PATCH_FIELD_LABELS[field]);

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
      case "accessory_notes": {
        const tagInput = normalizeOrderTagInput({ accessoryNotes: value });
        orderUpdate.accessory_notes = tagInput.accessoryNotes || null;
        break;
      }
      case "warranty_text":
        orderUpdate.warranty_text = value || null;
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
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  if (!id) throw new Error("工单 ID 不能为空");
  if (!input.expected_updated_at) throw new Error("缺少工单版本时间");

  const validFaults = normalizeFaultPriceInput(input.fault_prices);
  const quotation = validFaults.reduce((sum, item) => sum + item.price, 0);
  const deposit = Number(input.deposit_amount ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) throw new Error("押金不能为负数");
  if (deposit > quotation) throw new Error("押金不能超过总报价");

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("id,updated_at,quotation_amount,deposit_amount,balance_amount")
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
  recipientPhone?: string;
  allowInvalidTransition?: boolean;
  markApprovalPending?: boolean;
}): Promise<WhatsappNotificationResult> {
  const message = body.trim();
  const cleanRecipientPhone = recipientPhone?.trim();
  if (!id) throw new Error("工单 ID 不能为空");
  if (!message) throw new Error("通知内容不能为空");

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  const current = await readOrderStatusRow(supabase, storeId, id, "读取工单失败");
  const from = current.status as RepairOrderStatus;
  let statusChanged = false;
  let to: RepairOrderStatus | undefined;

  if (transitionTo) {
    const transition = await validateConfiguredOrderTransition(
      supabase,
      storeId,
      from,
      transitionTo,
    );
    if (!transition.ok) {
      if (!allowInvalidTransition) throw new Error(transition.reason ?? "状态流转不合法");
    } else {
      if (transitionTo === "completed" && (!current.is_paid || money(current.balance_amount) > 0)) {
        throw new Error("工单仍有未结清尾款，不能直接结案");
      }
      statusChanged = true;
      to = transitionTo;
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
    Object.assign(update, deriveCanonicalUpdateFromLegacyStatus(to, now));
    if (to === "completed") update.completed_at = now;
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

  await updateOrderRow({
    supabase,
    id,
    storeId,
    update,
    context: "更新工单通知状态失败",
  });

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

  const { error: readError } = await supabase
    .from("repair_orders")
    .select("id")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

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
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  return writeWhatsappMessage({
    id,
    body,
    templateKind,
    eventType: "message_sent",
    transitionTo,
    operator: operatorNameFromActor(operator),
    storeId,
    recipientPhone,
  });
}

export async function sendApprovalRequest(
  id: string,
  body: string,
  operator: string | AuditActor = "前台",
  recipientPhone?: string,
) {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  return writeWhatsappMessage({
    id,
    body,
    templateKind: "approval_request",
    eventType: "approval_sent",
    transitionTo: "waiting_approval",
    operator: operatorNameFromActor(operator),
    storeId,
    recipientPhone,
    allowInvalidTransition: true,
    markApprovalPending: true,
  });
}

export async function createOrder(
  input: CreateOrderInput,
  operator: string | AuditActor = "前台",
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  const technicianName = operatorName.trim() || "前台";
  if (!input.issue_description.trim()) throw new Error("故障描述不能为空");

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
  if (input.device_id && !input.customer_id) throw new Error("选择现有设备时必须同时选择客户");

  const supabase = getSupabaseAdmin();
  const status = await resolveInitialOrderStatus(supabase, storeId, input.status);
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

  let customerId = input.customer_id;
  let customerContactPhones: string[] = [];
  if (customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,phone_raw,contact_phones")
      .eq("store_id", storeId)
      .eq("id", customerId)
      .single();
    fail(error, "读取客户失败");
    const row = data as DbRecord;
    const existingPhones = stringArray(row.contact_phones);
    const phoneBook = input.customer_phone?.trim()
      ? normalizePhoneBook(input.customer_phone, existingPhones)
      : undefined;
    const primaryRaw = phoneBook?.primaryRaw || requiredString(row.phone_raw);
    customerContactPhones = phoneBook
      ? mergeContactPhones(existingPhones, phoneBook.contacts, primaryRaw)
      : existingPhones;
    if (phoneBook && contactPhonesChanged(existingPhones, customerContactPhones)) {
      const { error: updateError } = await supabase
        .from("customers")
        .update({ contact_phones: customerContactPhones, updated_at: now })
        .eq("store_id", storeId)
        .eq("id", customerId);
      fail(updateError, "更新客户备用号码失败");
    }
  } else {
    const name = input.customer_name?.trim();
    const phone = input.customer_phone?.trim();
    if (!name || !phone) throw new Error("客户姓名和手机号不能为空");
    const phoneBook = normalizePhoneBook(phone);
    const raw = phoneBook.primaryRaw;
    if (!raw) throw new Error("手机号格式不正确");
    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("id,contact_phones")
      .eq("store_id", storeId)
      .eq("phone_raw", raw)
      .maybeSingle();
    fail(existingError, "查找手机号客户失败");
    if (existing) {
      customerId = requiredString((existing as DbRecord).id);
      const existingPhones = stringArray((existing as DbRecord).contact_phones);
      customerContactPhones = mergeContactPhones(existingPhones, phoneBook.contacts, raw);
      if (contactPhonesChanged(existingPhones, customerContactPhones)) {
        const { error: updateError } = await supabase
          .from("customers")
          .update({ contact_phones: customerContactPhones, updated_at: now })
          .eq("store_id", storeId)
          .eq("id", customerId);
        fail(updateError, "更新客户备用号码失败");
      }
    } else {
      customerId = crypto.randomUUID();
      const { error } = await supabase.from("customers").insert({
        id: customerId,
        store_id: storeId,
        name,
        phone_e164: phoneBook.primary,
        phone_raw: raw,
        contact_phones: phoneBook.contacts,
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
        created_at: now,
        updated_at: now,
      });
      fail(error, "创建客户失败");
      customerContactPhones = phoneBook.contacts;
    }
  }

  let deviceId = input.device_id;
  let deviceSnapshot: DeviceSnapshot;
  if (deviceId) {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("store_id", storeId)
      .eq("id", deviceId)
      .single();
    fail(error, "读取设备失败");
    const device = deviceFromRow(data);
    if (!device) throw new Error("读取设备失败");
    if (device.customer_id !== customerId) {
      throw new Error("设备不属于当前客户");
    }
    deviceSnapshot = snapshotFromDevice(device);
  } else {
    const brand = input.device_brand?.trim();
    const model = input.device_model?.trim();
    if (!brand || !model) throw new Error("设备品牌和型号不能为空");
    deviceId = crypto.randomUUID();
    const deviceNotes = input.device_notes?.trim() || undefined;
    const { error } = await supabase.from("devices").insert({
      id: deviceId,
      store_id: storeId,
      customer_id: customerId,
      brand,
      model,
      serial_or_imei: input.device_imei?.trim() ?? "",
      device_notes: deviceNotes || null,
      created_at: now,
      updated_at: now,
    });
    fail(error, "创建设备失败");
    deviceSnapshot = {
      brand,
      model,
      serial_or_imei: input.device_imei?.trim() ?? "",
      ...(deviceNotes ? { device_notes: deviceNotes } : {}),
    };
  }

  const id = crypto.randomUUID();
  const balance = Math.max(0, quotation - deposit);
  const workflowStatus = workflowStatusFromLegacyStatus(status);
  const canonicalDefaults = deriveCanonicalUpdateFromLegacyStatus(status, now);
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const inserted = await insertOrderRow({
    supabase,
    context: "创建工单失败",
    row: {
      id,
      store_id: storeId,
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
      customer_id: customerId,
      device_id: deviceId,
      issue_description: input.issue_description.trim(),
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: balance,
      currency_code: CURRENCY_CODE,
      is_paid: balance === 0,
      approval_status: "pending",
      technician_name: technicianName,
      internal_tag: tagInput.internalTag || null,
      accessory_notes: tagInput.accessoryNotes || null,
      warranty_text: warranty.warranty_text,
      warranty_months: warranty.warranty_months,
      warranty_change_reason: warranty.warranty_change_reason ?? null,
      warranty_changed_by: warrantyChangedFromDefault ? (actorId ?? null) : null,
      warranty_changed_at: warrantyChangedFromDefault ? now : null,
      contact_phones: customerContactPhones,
      fault_prices: validFaults,
      device_snapshot: deviceSnapshot,
      created_at: now,
      updated_at: now,
    },
  });

  const orderId = requiredString((inserted as DbRecord).id);
  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: orderId,
    event_type: "created",
    payload: {
      type: input.order_type,
      warranty_months: warranty.warranty_months,
      warranty_text: warranty.warranty_text,
      warranty_change_reason: warranty.warranty_change_reason ?? null,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入创建时间线失败");

  return { id: orderId };
}
export async function getRepairDeskOptions(actor?: AuditActor): Promise<RepairDeskOptions> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const [{ data: supplierRows, error: supplierError }, { data: technicianRows, error: techError }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("store_id", storeId)
        .order("name", { ascending: true }),
      supabase.from("repair_orders").select("technician_name").eq("store_id", storeId),
    ]);
  fail(supplierError, "读取供应商失败");
  fail(techError, "读取技师失败");

  return {
    suppliers: ((supplierRows ?? []) as DbRecord[])
      .map(supplierFromRow)
      .filter((supplier): supplier is Supplier => Boolean(supplier)),
    technicians: Array.from(
      new Set(
        ((technicianRows ?? []) as DbRecord[])
          .map((row) => maybeString(row.technician_name))
          .filter((name): name is string => Boolean(name)),
      ),
    ).sort((a, b) => a.localeCompare(b, "zh-CN")),
  };
}
