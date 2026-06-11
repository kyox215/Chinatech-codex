import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
  normalizeInitialOrderStatus,
  validateOrderTransition,
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
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import {
  ORDER_LIST_SELECT,
  ORDER_SELECT,
  type DbRecord,
  customerFromRow,
  decorate,
  deviceFromRow,
  eventFromRow,
  fail,
  fetchOrderRows,
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
    const statusSort = getStatusListSortIndex(a.status) - getStatusListSortIndex(b.status);
    if (statusSort !== 0) return statusSort;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
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
    types: input.types,
    technicians: input.technicians,
    supplierIds: input.supplierIds,
    paid: input.paid,
    overdue: input.overdue,
  };

  if (filters.search?.trim() || filters.overdue) {
    const all = filterOrders((await fetchOrderRows(storeId)).map(decorate), filters);
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
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
  if (filters.types?.length) query = query.in("order_type", filters.types);
  if (filters.technicians?.length) query = query.in("technician_name", filters.technicians);
  if (filters.supplierIds?.length) query = query.in("supplier_id", filters.supplierIds);
  if (filters.paid && filters.paid !== "all") query = query.eq("is_paid", filters.paid === "paid");

  const { data, error, count } = await query;
  fail(error, "读取工单失败");

  const total = count ?? 0;
  return {
    items: ((data ?? []) as DbRecord[]).map(decorate),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
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
      .in("status", [
        "new",
        "rework",
        "mail_in_progress",
        "diagnosing",
        "quoted",
        "parts_ordered",
        "parts_arrived",
        "repairing",
      ]),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("is_paid", false),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "waiting_approval")
      .lt("approval_sent_at", approvalCutoff),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .in("status", ["repaired", "notified", "unfixed_pickup", "waiting_pickup"])
      .or(
        `completed_at.lt.${pickupCutoff},and(completed_at.is.null,updated_at.lt.${pickupCutoff})`,
      ),
  ]);

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

  const [{ data: eventRows, error: eventError }, { data: messageRows, error: messageError }] =
    await Promise.all([
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
    ]);

  fail(eventError, "读取时间线失败");
  fail(messageError, "读取通知历史失败");

  const row = orderRow as DbRecord;
  return {
    order: decorate(row),
    customer: customerFromRow(row.customer),
    device: deviceFromRow(row.device),
    supplier: supplierFromRow(row.supplier),
    events: ((eventRows ?? []) as DbRecord[]).map(eventFromRow),
    messages: ((messageRows ?? []) as DbRecord[]).map(messageFromRow),
  };
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
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("id,status")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取当前状态失败");

  const from = (current as DbRecord).status as RepairOrderStatus;
  const validation = validateOrderTransition(from, to);
  if (!validation.ok) throw new Error(validation.reason ?? "状态流转不合法");

  const now = new Date().toISOString();
  const update: DbRecord = { status: to, updated_at: now };
  if (to === "cancelled") update.cancel_reason = opts.reason ?? "未填写";
  if (to === "completed") update.completed_at = now;
  if (to === "waiting_approval") update.approval_sent_at = now;

  const { error: updateError } = await supabase
    .from("repair_orders")
    .update(update)
    .eq("store_id", storeId)
    .eq("id", id);
  fail(updateError, "更新工单状态失败");

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: id,
    event_type: "status_changed",
    payload: { from, to, reason: opts.reason },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入状态时间线失败");

  return { ok: true, from, to };
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

export async function recordPayment(
  id: string,
  amount: number,
  method = "现金",
  operator: string | AuditActor = "前台",
) {
  const storeId = requireStoreIdFromActor(typeof operator === "string" ? undefined : operator);
  const operatorName = operatorNameFromActor(operator);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("收款金额必须大于 0");

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("balance_amount,is_paid")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取尾款失败");

  const balance = money((current as DbRecord).balance_amount);
  if (balance <= 0 || (current as DbRecord).is_paid) throw new Error("该工单已结清");
  if (amount > balance) throw new Error("收款金额不能超过未结清尾款");

  const nextBalance = Math.max(0, balance - amount);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("repair_orders")
    .update({ balance_amount: nextBalance, is_paid: nextBalance === 0, updated_at: now })
    .eq("store_id", storeId)
    .eq("id", id);
  fail(updateError, "登记收款失败");

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

  return { ok: true, balance: nextBalance, is_paid: nextBalance === 0 };
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const PATCH_FIELD_LABELS: Record<keyof PatchOrderInput["changes"], string> = {
  customer_name: "客户姓名",
  customer_phone: "手机号",
  device_brand: "设备品牌",
  device_model: "设备型号",
  device_imei: "IMEI/序列号",
  device_notes: "设备备注",
  issue_description: "故障描述",
  diagnosis_result: "诊断结果",
  technician_name: "技师",
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
  const technicianName = input.technician_name.trim();

  if (!id) throw new Error("工单 ID 不能为空");
  if (!customerName || !customerPhone) throw new Error("客户姓名和手机号不能为空");
  if (!deviceBrand || !deviceModel) throw new Error("设备品牌和型号不能为空");
  if (!issueDescription) throw new Error("故障描述不能为空");
  if (!technicianName) throw new Error("技师不能为空");

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
      "id,customer_id,device_id,quotation_amount,deposit_amount,balance_amount,customer:customers(contact_phones)",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

  const currentRow = current as DbRecord;
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

  const { error: orderError } = await supabase
    .from("repair_orders")
    .update({
      issue_description: issueDescription,
      diagnosis_result: input.diagnosis_result?.trim() || null,
      technician_name: technicianName,
      internal_tag: tagInput.internalTag || null,
      accessory_notes: tagInput.accessoryNotes || null,
      warranty_text: input.warranty_text?.trim() || null,
      contact_phones: customerContactPhones,
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: nextBalance,
      is_paid: nextBalance === 0,
      fault_prices: validFaults,
      currency_code: CURRENCY_CODE,
      device_snapshot: {
        brand: deviceBrand,
        model: deviceModel,
        serial_or_imei: input.device_imei?.trim() ?? "",
        ...(input.device_notes?.trim() ? { device_notes: input.device_notes.trim() } : {}),
      },
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", id);
  fail(orderError, "更新工单失败");

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
      currency_code: CURRENCY_CODE,
    },
    operator_name: operatorName,
    created_at: now,
  });
  fail(eventError, "写入更新时间线失败");

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

  const changeEntries = Object.entries(input.changes).filter(
    ([, value]) => value !== undefined,
  ) as [keyof PatchOrderInput["changes"], string][];
  if (changeEntries.length === 0) throw new Error("没有可保存的字段");

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

  for (const [field, rawValue] of changeEntries) {
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
      case "technician_name":
        if (!value) throw new Error("技师不能为空");
        orderUpdate.technician_name = value;
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
    changeEntries.some(([field]) =>
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
  allowInvalidTransition?: boolean;
  markApprovalPending?: boolean;
}): Promise<WhatsappNotificationResult> {
  const message = body.trim();
  if (!id) throw new Error("工单 ID 不能为空");
  if (!message) throw new Error("通知内容不能为空");

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("id,status")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

  const from = (current as DbRecord).status as RepairOrderStatus;
  let statusChanged = false;
  let to: RepairOrderStatus | undefined;

  if (transitionTo) {
    const transition = validateOrderTransition(from, transitionTo);
    if (!transition.ok) {
      if (!allowInvalidTransition) throw new Error(transition.reason ?? "状态流转不合法");
    } else {
      statusChanged = true;
      to = transitionTo;
    }
  }

  const update: DbRecord = { updated_at: now };
  if (markApprovalPending) {
    update.approval_sent_at = now;
    update.approval_status = "pending";
  }
  if (statusChanged && to) {
    update.status = to;
    if (to === "completed") update.completed_at = now;
    if (to === "waiting_approval") update.approval_sent_at = now;
  }

  const payload: Record<string, unknown> = {
    channel: "whatsapp",
    message_id: messageId,
    template_kind: templateKind,
    status_changed: statusChanged,
    currency_code: CURRENCY_CODE,
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

  const [{ error: updateError }, { error: eventError }] = await Promise.all([
    supabase.from("repair_orders").update(update).eq("store_id", storeId).eq("id", id),
    supabase.from("order_events").insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      order_id: id,
      event_type: eventType,
      payload,
      operator_name: operator,
      created_at: now,
    }),
  ]);
  fail(updateError, "更新工单通知状态失败");
  fail(eventError, "写入通知时间线失败");

  return {
    ok: true,
    id: messageId,
    channel: "whatsapp",
    body: message,
    template_kind: templateKind,
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

  const [{ error: updateError }, { error: eventError }] = await Promise.all([
    supabase.from("repair_orders").update({ updated_at: now }).eq("store_id", storeId).eq("id", id),
    supabase.from("order_events").insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      order_id: id,
      event_type: "message_sent",
      payload: { channel, message_id: messageId },
      operator_name: operatorName,
      created_at: now,
    }),
  ]);
  fail(updateError, "更新工单通知时间失败");
  fail(eventError, "写入通知时间线失败");

  return { ok: true, id: messageId, channel, body: message };
}

export async function sendWhatsappNotification(
  id: string,
  body: string,
  templateKind: OrderWhatsappTemplateKind,
  transitionTo?: RepairOrderStatus,
  operator: string | AuditActor = "前台",
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
  });
}

export async function sendApprovalRequest(
  id: string,
  body: string,
  operator: string | AuditActor = "前台",
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
  const status = normalizeInitialOrderStatus(input.status);
  if (!ORDER_STATUS_ALLOWED_FOR_CREATE.includes(status)) throw new Error("初始状态不合法");
  if (!input.issue_description.trim()) throw new Error("故障描述不能为空");
  if (!input.technician_name.trim()) throw new Error("技师不能为空");

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
  const now = new Date().toISOString();

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
  const tagInput = normalizeOrderTagInput({
    internalTag: input.internal_tag,
    accessoryNotes: input.accessory_notes,
  });
  const { data: inserted, error: orderError } = await supabase
    .from("repair_orders")
    .insert({
      id,
      store_id: storeId,
      order_type: input.order_type,
      status,
      customer_id: customerId,
      device_id: deviceId,
      issue_description: input.issue_description.trim(),
      quotation_amount: quotation,
      deposit_amount: deposit,
      balance_amount: balance,
      currency_code: CURRENCY_CODE,
      is_paid: balance === 0,
      approval_status: "pending",
      technician_name: input.technician_name.trim(),
      internal_tag: tagInput.internalTag || null,
      accessory_notes: tagInput.accessoryNotes || null,
      warranty_text: input.warranty_text?.trim() || "6个月",
      contact_phones: customerContactPhones,
      fault_prices: validFaults,
      device_snapshot: deviceSnapshot,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  fail(orderError, "创建工单失败");

  const orderId = requiredString((inserted as DbRecord).id);
  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_id: orderId,
    event_type: "created",
    payload: { type: input.order_type },
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
