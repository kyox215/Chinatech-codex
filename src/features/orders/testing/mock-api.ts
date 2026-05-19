import { CURRENCY_CODE } from "@/lib/money";
import type {
  CreateOrderInput,
  OrderListFilters,
  OrderListItem,
  RepairOrder,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
  normalizeInitialOrderStatus,
  validateOrderTransition,
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
  phoneRaw,
} from "@/lib/mock/state";

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  let result = orders.map(decorate);
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
  // Workflow-first sort, then updated_at desc.
  return result.sort((a, b) => {
    const d = getStatusListSortIndex(a.status) - getStatusListSortIndex(b.status);
    if (d !== 0) return d;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

// Used to compute KPIs without re-running filters on the same dataset.
export async function getOrderStats() {
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
    approvalOverdue: orders.filter(isApprovalOverdue).length,
    pickupOverdue: orders.filter(isPickupOverdue).length,
  };
}

// GET /api/orders/[id]
export async function getOrder(id: string) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  return {
    order: decorate(o),
    customer: getCustomer(o.customer_id),
    device: getDevice(o.device_id),
    supplier: getSupplier(o.supplier_id),
    events: [...extraEvents.filter((event) => event.order_id === o.id), ...getEvents(o.id)].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    messages: [
      ...extraMessages.filter((message) => message.order_id === o.id),
      ...getMessages(o.id),
    ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
  };
}

// POST /api/orders/[id]/transition
export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string; operator?: string } = {},
) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const v = validateOrderTransition(o.status, to);
  if (!v.ok) throw new Error(v.reason ?? "状态流转不合法");
  const from = o.status;
  o.status = to;
  o.updated_at = new Date().toISOString();
  if (to === "cancelled" && opts.reason) o.cancel_reason = opts.reason;
  if (to === "completed") o.completed_at = o.updated_at;
  if (to === "waiting_approval") o.approval_sent_at = o.updated_at;
  return { ok: true, from, to };
}

// POST /api/orders/batch-transition
export async function batchTransition(ids: string[], to: RepairOrderStatus) {
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to);
      count++;
    } catch (e) {
      failures.push({ id, reason: (e as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

// POST /api/orders/[id]/payment
export async function recordPayment(id: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("收款金额必须大于 0");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  if (o.balance_amount <= 0 || o.is_paid) throw new Error("该工单已结清");
  if (amount > o.balance_amount) throw new Error("收款金额不能超过未结清尾款");
  o.balance_amount = Math.max(0, o.balance_amount - amount);
  if (o.balance_amount === 0) o.is_paid = true;
  o.updated_at = new Date().toISOString();
  return { ok: true, balance: o.balance_amount, is_paid: o.is_paid };
}

export async function updateOrder(id: string, input: UpdateOrderInput): Promise<{ ok: boolean }> {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");

  const customer = getCustomer(o.customer_id);
  const device = getDevice(o.device_id);
  if (!customer || !device) throw new Error("工单缺少客户或设备关联");

  const customerName = input.customer_name.trim();
  const customerPhone = input.customer_phone.trim();
  const deviceBrand = input.device_brand.trim();
  const deviceModel = input.device_model.trim();
  const issueDescription = input.issue_description.trim();
  const technicianName = input.technician_name.trim();
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

  const paidAmount = Math.max(0, o.quotation_amount - o.deposit_amount - o.balance_amount);
  const nextBalance = Math.max(0, quotation - deposit - paidAmount);
  const now = new Date().toISOString();

  customer.name = customerName;
  customer.phone_e164 = customerPhone;
  customer.phone_raw = customerPhone.replace(/\D/g, "");

  o.issue_description = issueDescription;
  o.diagnosis_result = input.diagnosis_result?.trim() || undefined;
  o.technician_name = technicianName;
  o.internal_tag = input.internal_tag?.trim() || undefined;
  o.warranty_text = input.warranty_text?.trim() || undefined;
  o.quotation_amount = quotation;
  o.deposit_amount = deposit;
  o.balance_amount = nextBalance;
  o.is_paid = nextBalance === 0;
  o.fault_prices = validFaults;
  o.currency_code = CURRENCY_CODE;
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
      currency_code: CURRENCY_CODE,
    },
    operator_name: "前台",
    created_at: now,
  });

  return { ok: true };
}

// POST /api/orders/[id]/notify
export async function sendNotification(
  id: string,
  body: string,
  channel: "whatsapp" | "sms" = "whatsapp",
) {
  const message = body.trim();
  if (!message) throw new Error("通知内容不能为空");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const now = new Date().toISOString();
  const messageId = `msg_${Date.now()}`;
  o.updated_at = now;
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
    operator_name: "前台",
    created_at: now,
  });
  return { ok: true, id: messageId, channel, body: message };
}

export async function sendApprovalRequest(id: string, body: string) {
  const message = body.trim();
  if (!message) throw new Error("审批内容不能为空");
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const now = new Date().toISOString();
  const messageId = `msg_approval_${Date.now()}`;
  const transition = validateOrderTransition(o.status, "waiting_approval");
  const from = o.status;
  const statusChanged = transition.ok;
  if (statusChanged) o.status = "waiting_approval";
  o.approval_status = "pending";
  o.approval_sent_at = now;
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
    id: `evt_approval_${Date.now()}`,
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
  });
  return { ok: true, id: messageId, channel: "whatsapp" as const, body: message, statusChanged };
}

// GET /api/customers/suggest?q=
export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  const status = normalizeInitialOrderStatus(input.status);
  if (!ORDER_STATUS_ALLOWED_FOR_CREATE.includes(status)) throw new Error("初始状态不合法");
  if (!input.issue_description.trim()) throw new Error("故障描述不能为空");
  if (!input.technician_name.trim()) throw new Error("技师不能为空");
  if (input.device_id && !input.customer_id) throw new Error("选择现有设备时必须同时选择客户");

  let customer = input.customer_id ? getCustomer(input.customer_id) : undefined;
  if (input.customer_id && !customer) throw new Error("读取客户失败");
  if (!customer) {
    if (!input.customer_name?.trim() || !input.customer_phone?.trim()) {
      throw new Error("客户姓名和手机号不能为空");
    }
    const raw = phoneRaw(input.customer_phone);
    customer = customers.find((item) => item.phone_raw === raw);
    if (!customer) {
      customer = {
        id: `cus_new_${Date.now()}`,
        name: input.customer_name.trim(),
        phone_raw: raw,
        phone_e164: input.customer_phone.trim(),
        contact_phones: [],
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
      };
      customers.push(customer);
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
      id: `dev_new_${Date.now()}`,
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
  const id = `ord_new_${Date.now()}`;
  const seq = orders.length + 1;
  const now = new Date().toISOString();
  const balance = Math.max(0, quotation - deposit);
  const newOrder: RepairOrder = {
    id,
    public_no: `R${(2026000 + seq).toString().padStart(7, "0")}`,
    order_type: input.order_type,
    status,
    customer_id: customer.id,
    device_id: device.id,
    issue_description: input.issue_description,
    quotation_amount: quotation,
    deposit_amount: deposit,
    balance_amount: balance,
    currency_code: CURRENCY_CODE,
    is_paid: balance === 0,
    approval_status: "pending",
    technician_name: input.technician_name,
    internal_tag: input.internal_tag,
    warranty_text: input.warranty_text?.trim() || "6个月",
    contact_phones: customer.contact_phones,
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
  return { id };
}
