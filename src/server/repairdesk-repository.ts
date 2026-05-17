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
import type {
  CreateOrderInput,
  Customer,
  Device,
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
      return note ? { name, price, note } : { name, price };
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
    notes: maybeString(r.notes),
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

  return {
    ...order,
    customer_name: customer?.name ?? "-",
    customer_phone: customer?.phone_e164 ?? "",
    device_label: device ? `${device.brand} ${device.model}` : "-",
    device_imei: device?.serial_or_imei ?? "",
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
    payload: { amount, method, balance: nextBalance },
    operator_name: "前台",
    created_at: now,
  });
  fail(eventError, "写入收款时间线失败");

  return { ok: true, balance: nextBalance, is_paid: nextBalance === 0 };
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
    .filter((item) => item.name.trim() && Number(item.price) > 0)
    .map((item) => ({ ...item, price: Number(item.price) }));
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
    customerId = crypto.randomUUID();
    const { error } = await supabase.from("customers").insert({
      id: customerId,
      name,
      phone_e164: phone,
      phone_raw: phone.replace(/\D/g, ""),
      contact_phones: [],
      consent_marketing: false,
      consent_sms: true,
      created_at: now,
      updated_at: now,
    });
    fail(error, "创建客户失败");
  }

  let deviceId = input.device_id;
  if (deviceId) {
    const { data, error } = await supabase
      .from("devices")
      .select("id,customer_id")
      .eq("id", deviceId)
      .single();
    fail(error, "读取设备失败");
    if (requiredString((data as DbRecord).customer_id) !== customerId) {
      throw new Error("设备不属于当前客户");
    }
  } else {
    const brand = input.device_brand?.trim();
    const model = input.device_model?.trim();
    if (!brand || !model) throw new Error("设备品牌和型号不能为空");
    deviceId = crypto.randomUUID();
    const { error } = await supabase.from("devices").insert({
      id: deviceId,
      customer_id: customerId,
      brand,
      model,
      serial_or_imei: input.device_imei?.trim() ?? "",
      device_notes: input.device_notes?.trim() || null,
      created_at: now,
      updated_at: now,
    });
    fail(error, "创建设备失败");
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
      is_paid: balance === 0,
      approval_status: "pending",
      technician_name: input.technician_name.trim(),
      internal_tag: input.internal_tag?.trim() || null,
      warranty_text: "90天质保",
      contact_phones: customerContactPhones,
      fault_prices: validFaults,
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
