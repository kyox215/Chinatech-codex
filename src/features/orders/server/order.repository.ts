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
  CreateOrderInput,
  DeviceSnapshot,
  OrderDetail,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
  OrderStats,
  OrderWhatsappTemplateKind,
  RepairDeskOptions,
  Supplier,
  UpdateOrderInput,
  WhatsappNotificationResult,
} from "@/lib/repairdesk/types";
import { getSupabaseAdmin } from "@/server/supabase";
import { normalizeOrderTagInput } from "@/features/orders/model/order-tags";
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
  orderFromRow,
  phoneRaw,
  requiredString,
  snapshotFromDevice,
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
        o.customer_phone.toLowerCase().includes(q) ||
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

function normalizePageInput(input: OrderListPageInput = {}) {
  const page = Math.max(1, Math.floor(Number(input.page ?? 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
  return { page, pageSize };
}

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  return filterOrders((await fetchOrderRows()).map(decorate), filters);
}

export async function listOrdersPage(input: OrderListPageInput = {}): Promise<OrderListResult> {
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
    const all = filterOrders((await fetchOrderRows()).map(decorate), filters);
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

export async function getOrderStats(): Promise<OrderStats> {
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
    supabase.from("repair_orders").select("id", { count: "exact", head: true }),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
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
      .eq("is_paid", false),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting_approval")
      .lt("approval_sent_at", approvalCutoff),
    supabase
      .from("repair_orders")
      .select("id", { count: "exact", head: true })
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

export async function getOrder(id: string): Promise<OrderDetail> {
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("repair_orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();
  fail(orderError, "读取工单详情失败");

  const [{ data: eventRows, error: eventError }, { data: messageRows, error: messageError }] =
    await Promise.all([
      supabase
        .from("order_events")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("message_logs")
        .select("*")
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
  opts: { reason?: string; operator?: string } = {},
) {
  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("id,status")
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

  const { error: updateError } = await supabase.from("repair_orders").update(update).eq("id", id);
  fail(updateError, "更新工单状态失败");

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    order_id: id,
    event_type: "status_changed",
    payload: { from, to, reason: opts.reason },
    operator_name: opts.operator ?? "系统",
    created_at: now,
  });
  fail(eventError, "写入状态时间线失败");

  return { ok: true, from, to };
}

export async function batchTransition(ids: string[], to: RepairOrderStatus) {
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to);
      count++;
    } catch (error) {
      failures.push({ id, reason: (error as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

export async function recordPayment(id: string, amount: number, method = "现金") {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("收款金额必须大于 0");

  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from("repair_orders")
    .select("balance_amount,is_paid")
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
    .eq("id", id);
  fail(updateError, "登记收款失败");

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
    order_id: id,
    event_type: "payment",
    payload: { amount, method, balance: nextBalance, currency_code: CURRENCY_CODE },
    operator_name: "前台",
    created_at: now,
  });
  fail(eventError, "写入收款时间线失败");

  return { ok: true, balance: nextBalance, is_paid: nextBalance === 0 };
}

export async function updateOrder(id: string, input: UpdateOrderInput): Promise<{ ok: boolean }> {
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
    .select("id,customer_id,device_id,quotation_amount,deposit_amount,balance_amount")
    .eq("id", id)
    .single();
  fail(readError, "读取工单失败");

  const currentRow = current as DbRecord;
  const customerId = requiredString(currentRow.customer_id);
  const deviceId = requiredString(currentRow.device_id);
  if (!customerId || !deviceId) throw new Error("工单缺少客户或设备关联");

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
      phone_e164: customerPhone,
      phone_raw: customerPhone.replace(/\D/g, ""),
      updated_at: now,
    })
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
    .eq("id", id);
  fail(orderError, "更新工单失败");

  const { error: eventError } = await supabase.from("order_events").insert({
    id: crypto.randomUUID(),
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
    operator_name: "前台",
    created_at: now,
  });
  fail(eventError, "写入更新时间线失败");

  return { ok: true };
}

async function writeWhatsappMessage({
  id,
  body,
  templateKind,
  eventType,
  transitionTo,
  allowInvalidTransition = false,
  markApprovalPending = false,
}: {
  id: string;
  body: string;
  templateKind: OrderWhatsappTemplateKind;
  eventType: "message_sent" | "approval_sent";
  transitionTo?: RepairOrderStatus;
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
    order_id: id,
    channel: "whatsapp",
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  fail(messageError, "写入 WhatsApp 通知失败");

  const [{ error: updateError }, { error: eventError }] = await Promise.all([
    supabase.from("repair_orders").update(update).eq("id", id),
    supabase.from("order_events").insert({
      id: crypto.randomUUID(),
      order_id: id,
      event_type: eventType,
      payload,
      operator_name: "前台",
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
) {
  const message = body.trim();
  if (!message) throw new Error("通知内容不能为空");

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();

  const { error: messageError } = await supabase.from("message_logs").insert({
    id: messageId,
    order_id: id,
    channel,
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  fail(messageError, "写入通知历史失败");

  const [{ error: updateError }, { error: eventError }] = await Promise.all([
    supabase.from("repair_orders").update({ updated_at: now }).eq("id", id),
    supabase.from("order_events").insert({
      id: crypto.randomUUID(),
      order_id: id,
      event_type: "message_sent",
      payload: { channel, message_id: messageId },
      operator_name: "前台",
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
) {
  return writeWhatsappMessage({
    id,
    body,
    templateKind,
    eventType: "message_sent",
    transitionTo,
  });
}

export async function sendApprovalRequest(id: string, body: string) {
  return writeWhatsappMessage({
    id,
    body,
    templateKind: "approval_request",
    eventType: "approval_sent",
    transitionTo: "waiting_approval",
    allowInvalidTransition: true,
    markApprovalPending: true,
  });
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
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
      .select("id,contact_phones")
      .eq("id", customerId)
      .single();
    fail(error, "读取客户失败");
    customerContactPhones = stringArray((data as DbRecord).contact_phones);
  } else {
    const name = input.customer_name?.trim();
    const phone = input.customer_phone?.trim();
    if (!name || !phone) throw new Error("客户姓名和手机号不能为空");
    const raw = phoneRaw(phone);
    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("id,contact_phones")
      .eq("phone_raw", raw)
      .maybeSingle();
    fail(existingError, "查找手机号客户失败");
    if (existing) {
      customerId = requiredString((existing as DbRecord).id);
      customerContactPhones = stringArray((existing as DbRecord).contact_phones);
    } else {
      customerId = crypto.randomUUID();
      const { error } = await supabase.from("customers").insert({
        id: customerId,
        name,
        phone_e164: phone,
        phone_raw: raw,
        contact_phones: [],
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
        created_at: now,
        updated_at: now,
      });
      fail(error, "创建客户失败");
    }
  }

  let deviceId = input.device_id;
  let deviceSnapshot: DeviceSnapshot;
  if (deviceId) {
    const { data, error } = await supabase.from("devices").select("*").eq("id", deviceId).single();
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
    order_id: orderId,
    event_type: "created",
    payload: { type: input.order_type },
    operator_name: "前台",
    created_at: now,
  });
  fail(eventError, "写入创建时间线失败");

  return { id: orderId };
}
export async function getRepairDeskOptions(): Promise<RepairDeskOptions> {
  const supabase = getSupabaseAdmin();
  const [{ data: supplierRows, error: supplierError }, { data: technicianRows, error: techError }] =
    await Promise.all([
      supabase.from("suppliers").select("*").order("name", { ascending: true }),
      supabase.from("repair_orders").select("technician_name"),
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
