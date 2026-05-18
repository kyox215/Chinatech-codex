import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
  normalizeInitialOrderStatus,
  validateOrderTransition,
} from "@/lib/mock/workflow";
import { getSupabaseAdmin } from "@/server/supabase";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import { CURRENCY_CODE } from "@/lib/money";
import type {
  CreateOrderInput,
  Customer,
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
  Device,
  DeviceSnapshot,
  FaultPriceItem,
  MessageLog,
  OrderDetail,
  OrderEvent,
  OrderListFilters,
  OrderListItem,
  OrderStats,
  RepairDeskOptions,
  RepairOrder,
  Supplier,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";

type DbRecord = Record<string, unknown>;

const ORDER_SELECT = `
  *,
  customer:customers!repair_orders_customer_id_fkey(*),
  device:devices!repair_orders_device_id_fkey(*),
  supplier:suppliers!repair_orders_supplier_id_fkey(*)
`;

function fail(error: { message: string } | null | undefined, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function maybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function money(value: unknown): number {
  return Number(value ?? 0);
}

function phoneRaw(value: string): string {
  return value.replace(/\D/g, "");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function faultPrices(value: unknown): FaultPriceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): FaultPriceItem | undefined => {
      if (!item || typeof item !== "object") return undefined;
      const row = item as DbRecord;
      const name = requiredString(row.name);
      const price = money(row.price);
      if (!name) return undefined;
      const note = maybeString(row.note);
      return note
        ? { name, price, currency_code: CURRENCY_CODE, note }
        : { name, price, currency_code: CURRENCY_CODE };
    })
    .filter((item): item is FaultPriceItem => item !== undefined);
}

function customerFromRow(row: unknown): Customer | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  return {
    id: requiredString(r.id),
    name: requiredString(r.name),
    phone_e164: requiredString(r.phone_e164),
    phone_raw: requiredString(r.phone_raw),
    contact_phones: stringArray(r.contact_phones),
    consent_marketing: Boolean(r.consent_marketing),
    consent_sms: Boolean(r.consent_sms),
    email: maybeString(r.email),
    preferred_channel:
      r.preferred_channel === "sms" || r.preferred_channel === "whatsapp"
        ? r.preferred_channel
        : "whatsapp",
    language: r.language === "zh" || r.language === "en" || r.language === "it" ? r.language : "it",
    notes: maybeString(r.notes),
    marketing_notes: maybeString(r.marketing_notes),
    last_contacted_at: maybeString(r.last_contacted_at),
    blacklisted_at: maybeString(r.blacklisted_at),
  };
}

function deviceFromRow(row: unknown): Device | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  return {
    id: requiredString(r.id),
    customer_id: requiredString(r.customer_id),
    brand: requiredString(r.brand),
    model: requiredString(r.model),
    serial_or_imei: requiredString(r.serial_or_imei),
    device_notes: maybeString(r.device_notes),
  };
}

function supplierFromRow(row: unknown): Supplier | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  return {
    id: requiredString(r.id),
    name: requiredString(r.name),
    short_name: requiredString(r.short_name),
    color: requiredString(r.color),
  };
}

function deviceSnapshotFromRow(value: unknown): DeviceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as DbRecord;
  const brand = requiredString(row.brand);
  const model = requiredString(row.model);
  if (!brand && !model) return undefined;
  return {
    brand,
    model,
    serial_or_imei: requiredString(row.serial_or_imei),
    device_notes: maybeString(row.device_notes),
  };
}

function snapshotFromDevice(device: Device): DeviceSnapshot {
  return {
    brand: device.brand,
    model: device.model,
    serial_or_imei: device.serial_or_imei,
    ...(device.device_notes ? { device_notes: device.device_notes } : {}),
  };
}

function tagFromRow(row: unknown): CustomerTag | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as DbRecord;
  const id = requiredString(r.id);
  const name = requiredString(r.name);
  if (!id || !name) return undefined;
  return {
    id,
    name,
    color: requiredString(r.color) || "#6366f1",
    description: maybeString(r.description),
  };
}

function interactionFromRow(row: DbRecord): CustomerInteraction {
  return {
    id: requiredString(row.id),
    customer_id: requiredString(row.customer_id),
    order_id: maybeString(row.order_id),
    channel: row.channel as CustomerInteraction["channel"],
    direction: row.direction as CustomerInteraction["direction"],
    message_body: requiredString(row.message_body),
    status: row.status as CustomerInteraction["status"],
    operator_name: requiredString(row.operator_name) || "前台",
    created_at: requiredString(row.created_at),
  };
}

function followupFromRow(row: DbRecord): CustomerFollowup {
  return {
    id: requiredString(row.id),
    customer_id: requiredString(row.customer_id),
    order_id: maybeString(row.order_id),
    title: requiredString(row.title),
    note: maybeString(row.note),
    due_at: requiredString(row.due_at),
    owner_name: maybeString(row.owner_name),
    status: row.status as CustomerFollowup["status"],
    completed_at: maybeString(row.completed_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function orderFromRow(row: DbRecord): RepairOrder {
  return {
    id: requiredString(row.id),
    public_no: requiredString(row.public_no),
    order_type: row.order_type as RepairOrder["order_type"],
    status: row.status as RepairOrder["status"],
    customer_id: requiredString(row.customer_id),
    device_id: requiredString(row.device_id),
    issue_description: requiredString(row.issue_description),
    diagnosis_result: maybeString(row.diagnosis_result),
    quotation_amount: money(row.quotation_amount),
    deposit_amount: money(row.deposit_amount),
    balance_amount: money(row.balance_amount),
    currency_code: CURRENCY_CODE,
    is_paid: Boolean(row.is_paid),
    approval_status: row.approval_status as RepairOrder["approval_status"],
    approval_sent_at: maybeString(row.approval_sent_at),
    approval_confirmed_at: maybeString(row.approval_confirmed_at),
    technician_name: requiredString(row.technician_name),
    internal_tag: maybeString(row.internal_tag),
    warranty_text: maybeString(row.warranty_text),
    completed_at: maybeString(row.completed_at),
    delivered_at: maybeString(row.delivered_at),
    pause_reason: maybeString(row.pause_reason),
    cancel_reason: maybeString(row.cancel_reason),
    supplier_id: maybeString(row.supplier_id),
    original_order_id: maybeString(row.original_order_id),
    contact_phones: stringArray(row.contact_phones),
    fault_prices: faultPrices(row.fault_prices),
    device_snapshot: deviceSnapshotFromRow(row.device_snapshot),
    customer_signature: maybeString(row.customer_signature),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function decorate(row: DbRecord): OrderListItem {
  const order = orderFromRow(row);
  const customer = customerFromRow(row.customer);
  const device = deviceFromRow(row.device);
  const supplier = supplierFromRow(row.supplier);
  const snapshot = order.device_snapshot ?? (device ? snapshotFromDevice(device) : undefined);
  const deviceLabel = snapshot ? `${snapshot.brand} ${snapshot.model}`.trim() : "-";

  return {
    ...order,
    customer_name: customer?.name ?? "-",
    customer_phone: customer?.phone_e164 ?? "",
    device_label: deviceLabel || "-",
    device_imei: snapshot?.serial_or_imei ?? device?.serial_or_imei ?? "",
    supplier_name: supplier?.name,
    supplier_color: supplier?.color,
    approval_overdue: isApprovalOverdue(order),
    pickup_overdue: isPickupOverdue(order),
  };
}

function eventFromRow(row: DbRecord): OrderEvent {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    id: requiredString(row.id),
    order_id: requiredString(row.order_id),
    event_type: row.event_type as OrderEvent["event_type"],
    payload: payload as Record<string, unknown>,
    operator_name: requiredString(row.operator_name),
    created_at: requiredString(row.created_at),
  };
}

function messageFromRow(row: DbRecord): MessageLog {
  return {
    id: requiredString(row.id),
    order_id: requiredString(row.order_id),
    channel: row.channel as MessageLog["channel"],
    message_body: requiredString(row.message_body),
    status: row.status as MessageLog["status"],
    sent_at: requiredString(row.sent_at),
    opened_at: maybeString(row.opened_at),
  };
}

async function fetchOrderRows(): Promise<DbRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("repair_orders").select(ORDER_SELECT);
  fail(error, "读取工单失败");
  return (data ?? []) as DbRecord[];
}

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

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  return filterOrders((await fetchOrderRows()).map(decorate), filters);
}

export async function getOrderStats(): Promise<OrderStats> {
  const orders = (await fetchOrderRows()).map((row) => orderFromRow(row));
  return {
    total: orders.length,
    today: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
      .length,
    inProgress: orders.filter((o) =>
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
    unpaid: orders.filter((o) => !o.is_paid).length,
    approvalOverdue: orders.filter((o) => isApprovalOverdue(o)).length,
    pickupOverdue: orders.filter((o) => isPickupOverdue(o)).length,
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

export async function recordPayment(id: string, amount: number, method = "微信") {
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
      internal_tag: input.internal_tag?.trim() || null,
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
      currency_code: CURRENCY_CODE,
    },
    operator_name: "前台",
    created_at: now,
  });
  fail(eventError, "写入更新时间线失败");

  return { ok: true };
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

export async function sendApprovalRequest(id: string, body: string) {
  const message = body.trim();
  if (!id) throw new Error("工单 ID 不能为空");
  if (!message) throw new Error("审批内容不能为空");

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
  const transition = validateOrderTransition(from, "waiting_approval");
  const statusChanged = transition.ok;
  const update: DbRecord = {
    approval_sent_at: now,
    approval_status: "pending",
    updated_at: now,
  };
  if (statusChanged) update.status = "waiting_approval";

  const { error: messageError } = await supabase.from("message_logs").insert({
    id: messageId,
    order_id: id,
    channel: "whatsapp",
    message_body: message,
    status: "sent",
    sent_at: now,
  });
  fail(messageError, "写入审批通知失败");

  const [{ error: updateError }, { error: eventError }] = await Promise.all([
    supabase.from("repair_orders").update(update).eq("id", id),
    supabase.from("order_events").insert({
      id: crypto.randomUUID(),
      order_id: id,
      event_type: "approval_sent",
      payload: {
        channel: "whatsapp",
        message_id: messageId,
        from,
        to: statusChanged ? "waiting_approval" : from,
        status_changed: statusChanged,
        currency_code: CURRENCY_CODE,
      },
      operator_name: "前台",
      created_at: now,
    }),
  ]);
  fail(updateError, "更新审批状态失败");
  fail(eventError, "写入审批时间线失败");

  return { ok: true, id: messageId, channel: "whatsapp" as const, body: message, statusChanged };
}

export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  const query = q.trim().toLowerCase();
  if (!query) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("customers").select("*").limit(200);
  fail(error, "搜索客户失败");

  return ((data ?? []) as DbRecord[])
    .map(customerFromRow)
    .filter((customer): customer is Customer => Boolean(customer))
    .filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone_e164.toLowerCase().includes(query) ||
        customer.phone_raw.includes(query),
    )
    .slice(0, limit);
}

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  fail(error, "读取客户设备失败");
  return ((data ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
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
      internal_tag: input.internal_tag?.trim() || null,
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

async function fetchCustomerTags(): Promise<CustomerTag[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_tags")
    .select("*")
    .order("name", { ascending: true });
  fail(error, "读取客户标签失败");
  return ((data ?? []) as DbRecord[])
    .map(tagFromRow)
    .filter((tag): tag is CustomerTag => Boolean(tag));
}

async function fetchCustomerTagAssignments(): Promise<{ customer_id: string; tag_id: string }[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("customer_tag_assignments").select("*");
  fail(error, "读取客户标签绑定失败");
  return ((data ?? []) as DbRecord[]).map((row) => ({
    customer_id: requiredString(row.customer_id),
    tag_id: requiredString(row.tag_id),
  }));
}

function customerStatsFromOrders(orders: OrderListItem[]) {
  return {
    order_count: orders.length,
    total_spent: orders
      .filter((order) => order.is_paid)
      .reduce((sum, order) => sum + order.quotation_amount, 0),
    unpaid_amount: orders.reduce((sum, order) => sum + order.balance_amount, 0),
    last_order_at: orders
      .map((order) => order.created_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
  };
}

function nextFollowup(followups: CustomerFollowup[]) {
  return followups
    .filter((followup) => followup.status === "open")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
}

function buildCustomerListItem(
  customer: Customer,
  devices: Device[],
  orders: OrderListItem[],
  tags: CustomerTag[],
  followups: CustomerFollowup[],
): CustomerListItem {
  const stats = customerStatsFromOrders(orders);
  const next = nextFollowup(followups);
  const latestDevice = devices[0];
  return {
    ...customer,
    tags,
    device_count: devices.length,
    order_count: stats.order_count,
    total_spent: stats.total_spent,
    unpaid_amount: stats.unpaid_amount,
    last_order_at: stats.last_order_at,
    next_followup_at: next?.due_at,
    latest_device_label: latestDevice ? `${latestDevice.brand} ${latestDevice.model}` : undefined,
    device_search_text: devices
      .map((device) =>
        [device.brand, device.model, device.serial_or_imei, device.device_notes]
          .filter(Boolean)
          .join(" "),
      )
      .join(" ")
      .toLowerCase(),
  };
}

function filterCustomers(customers: CustomerListItem[], filters: CustomerListFilters = {}) {
  let result = customers;
  const query = filters.search?.trim().toLowerCase();
  if (query) {
    const raw = phoneRaw(query);
    result = result.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone_e164.toLowerCase().includes(query) ||
        customer.phone_raw.includes(raw || query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.latest_device_label?.toLowerCase().includes(query) ||
        customer.device_search_text?.includes(query),
    );
  }
  if (filters.tagIds?.length) {
    result = result.filter((customer) =>
      filters.tagIds!.some((tagId) => customer.tags.some((tag) => tag.id === tagId)),
    );
  }
  if (filters.marketing && filters.marketing !== "all") {
    result = result.filter((customer) => {
      const allowed = customer.consent_marketing && !customer.blacklisted_at;
      return filters.marketing === "allowed" ? allowed : !allowed;
    });
  }
  if (filters.followup && filters.followup !== "all") {
    const now = Date.now();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    result = result.filter((customer) => {
      if (!customer.next_followup_at) return false;
      const due = new Date(customer.next_followup_at).getTime();
      return filters.followup === "overdue" ? due < now : due <= endOfToday.getTime();
    });
  }
  return result.sort((a, b) => {
    const aTime = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
    const bTime = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
    return bTime - aTime || a.name.localeCompare(b.name, "zh-CN");
  });
}

export async function listCustomers(
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  const supabase = getSupabaseAdmin();
  const [
    { data: customerRows, error: customerError },
    { data: deviceRows, error: deviceError },
    { data: followupRows, error: followupError },
  ] = await Promise.all([
    supabase.from("customers").select("*").limit(1000),
    supabase.from("devices").select("*").order("created_at", { ascending: false }),
    supabase.from("customer_followups").select("*").order("due_at", { ascending: true }),
  ]);
  fail(customerError, "读取客户失败");
  fail(deviceError, "读取客户设备失败");
  fail(followupError, "读取回访任务失败");

  const customers = ((customerRows ?? []) as DbRecord[])
    .map(customerFromRow)
    .filter((customer): customer is Customer => Boolean(customer));
  const devices = ((deviceRows ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
  const followups = ((followupRows ?? []) as DbRecord[]).map(followupFromRow);
  const orders = await listOrders();
  const tags = await fetchCustomerTags();
  const assignments = await fetchCustomerTagAssignments();

  const items = customers.map((customer) => {
    const customerDevices = devices.filter((device) => device.customer_id === customer.id);
    const customerOrders = orders.filter((order) => order.customer_id === customer.id);
    const customerFollowups = followups.filter((followup) => followup.customer_id === customer.id);
    const customerTags = assignments
      .filter((assignment) => assignment.customer_id === customer.id)
      .map((assignment) => tags.find((tag) => tag.id === assignment.tag_id))
      .filter((tag): tag is CustomerTag => Boolean(tag));
    return buildCustomerListItem(
      customer,
      customerDevices,
      customerOrders,
      customerTags,
      customerFollowups,
    );
  });

  const stats: CustomerStats = {
    total: items.length,
    repeat: items.filter((customer) => customer.order_count > 1).length,
    dueFollowups: items.filter((customer) => {
      if (!customer.next_followup_at) return false;
      return new Date(customer.next_followup_at).getTime() <= Date.now();
    }).length,
    marketable: items.filter((customer) => customer.consent_marketing && !customer.blacklisted_at)
      .length,
  };

  return { customers: filterCustomers(items, filters), tags, stats };
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const supabase = getSupabaseAdmin();
  const [
    { data: customerRow, error: customerError },
    { data: deviceRows, error: deviceError },
    { data: interactionRows, error: interactionError },
    { data: followupRows, error: followupError },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("devices")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_interactions")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_followups")
      .select("*")
      .eq("customer_id", id)
      .order("due_at", { ascending: true }),
  ]);
  fail(customerError, "读取客户详情失败");
  fail(deviceError, "读取客户设备失败");
  fail(interactionError, "读取客户联系记录失败");
  fail(followupError, "读取客户回访失败");

  const customer = customerFromRow(customerRow);
  if (!customer) throw new Error("客户不存在");
  const devices = ((deviceRows ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
  const interactions = ((interactionRows ?? []) as DbRecord[]).map(interactionFromRow);
  const followups = ((followupRows ?? []) as DbRecord[]).map(followupFromRow);
  const orders = (await listOrders()).filter((order) => order.customer_id === id);
  const allTags = await fetchCustomerTags();
  const assignments = (await fetchCustomerTagAssignments()).filter(
    (assignment) => assignment.customer_id === id,
  );
  const tags = assignments
    .map((assignment) => allTags.find((tag) => tag.id === assignment.tag_id))
    .filter((tag): tag is CustomerTag => Boolean(tag));
  const orderStats = customerStatsFromOrders(orders);

  return {
    customer,
    devices,
    orders,
    tags,
    interactions,
    followups,
    stats: {
      ...orderStats,
      device_count: devices.length,
      next_followup_at: nextFollowup(followups)?.due_at,
    },
  };
}

function customerPayload(input: CustomerUpdateInput, now: string) {
  const phone = input.phone_e164.trim();
  if (!input.name.trim() || !phone) throw new Error("客户姓名和手机号不能为空");
  const raw = phoneRaw(phone);
  if (!raw) throw new Error("手机号格式不正确");
  return {
    name: input.name.trim(),
    phone_e164: phone,
    phone_raw: raw,
    email: input.email?.trim() || null,
    contact_phones: input.contact_phones ?? [],
    consent_marketing: Boolean(input.consent_marketing),
    consent_sms: input.consent_sms ?? true,
    preferred_channel: input.preferred_channel ?? "whatsapp",
    language: input.language ?? "it",
    notes: input.notes?.trim() || null,
    marketing_notes: input.marketing_notes?.trim() || null,
    blacklisted_at: input.blacklisted ? now : null,
    updated_at: now,
  };
}

export async function createCustomer(input: CustomerCreateInput): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("customers").insert({
    id,
    ...customerPayload(input, now),
    created_at: now,
  });
  fail(error, "创建客户失败");
  return { id };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customers")
    .update(customerPayload(input, now))
    .eq("id", id);
  fail(error, "更新客户失败");
  return { ok: true };
}

export async function upsertCustomerDevice(
  customerId: string,
  input: CustomerDeviceInput,
): Promise<{ id: string }> {
  const brand = input.brand.trim();
  const model = input.model.trim();
  if (!brand || !model) throw new Error("设备品牌和型号不能为空");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const payload = {
    id,
    customer_id: customerId,
    brand,
    model,
    serial_or_imei: input.serial_or_imei?.trim() ?? "",
    device_notes: input.device_notes?.trim() || null,
    updated_at: now,
  };
  if (input.id) {
    const { error } = await supabase
      .from("devices")
      .update(payload)
      .eq("id", input.id)
      .eq("customer_id", customerId);
    fail(error, "保存客户设备失败");
  } else {
    const { error } = await supabase.from("devices").insert({ ...payload, created_at: now });
    fail(error, "保存客户设备失败");
  }
  return { id };
}

export async function deleteCustomerDevice(
  customerId: string,
  deviceId: string,
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const { data: orders, error: readError } = await supabase
    .from("repair_orders")
    .select("id")
    .eq("device_id", deviceId)
    .limit(1);
  fail(readError, "检查设备工单失败");
  if ((orders ?? []).length) throw new Error("该设备已有工单记录，不能删除");
  const { error } = await supabase
    .from("devices")
    .delete()
    .eq("id", deviceId)
    .eq("customer_id", customerId);
  fail(error, "删除设备失败");
  return { ok: true };
}

export async function setCustomerTags(
  customerId: string,
  tagIds: string[],
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const cleanIds = Array.from(new Set(tagIds.filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("customer_tag_assignments")
    .delete()
    .eq("customer_id", customerId);
  fail(deleteError, "清理客户标签失败");
  if (cleanIds.length) {
    const { error } = await supabase.from("customer_tag_assignments").insert(
      cleanIds.map((tagId) => ({
        customer_id: customerId,
        tag_id: tagId,
      })),
    );
    fail(error, "保存客户标签失败");
  }
  return { ok: true };
}

export async function createCustomerFollowup(
  customerId: string,
  input: CustomerFollowupInput,
): Promise<{ id: string }> {
  if (!input.title.trim()) throw new Error("回访标题不能为空");
  const due = new Date(input.due_at);
  if (Number.isNaN(due.getTime())) throw new Error("回访时间不正确");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("customer_followups").insert({
    id,
    customer_id: customerId,
    order_id: input.order_id || null,
    title: input.title.trim(),
    note: input.note?.trim() || null,
    due_at: due.toISOString(),
    owner_name: input.owner_name?.trim() || null,
    status: "open",
    created_at: now,
    updated_at: now,
  });
  fail(error, "创建回访失败");
  return { id };
}

export async function completeCustomerFollowup(
  customerId: string,
  followupId: string,
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customer_followups")
    .update({ status: "done", completed_at: now, updated_at: now })
    .eq("id", followupId)
    .eq("customer_id", customerId);
  fail(error, "完成回访失败");
  return { ok: true };
}

export async function sendCustomerMessage(
  customerId: string,
  input: CustomerMessageInput,
): Promise<{ ok: boolean; id: string }> {
  const body = input.body.trim();
  if (!body) throw new Error("消息内容不能为空");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("customer_interactions").insert({
    id,
    customer_id: customerId,
    order_id: input.order_id || null,
    channel: input.channel,
    direction: "outbound",
    message_body: body,
    status: "sent",
    operator_name: "前台",
    created_at: now,
  });
  fail(insertError, "记录客户消息失败");
  const { error: updateError } = await supabase
    .from("customers")
    .update({ last_contacted_at: now, updated_at: now })
    .eq("id", customerId);
  fail(updateError, "更新客户联系时间失败");
  return { ok: true, id };
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
