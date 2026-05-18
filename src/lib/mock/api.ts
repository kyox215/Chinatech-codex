// Mock API layer — signatures mirror the real Next.js Route Handlers.
// Replace these with fetch() calls when wiring to apps/backoffice.

import {
  customers,
  customerFollowups,
  customerInteractions,
  customerTagAssignments,
  customerTags,
  devices,
  getCustomer,
  getDevice,
  getEvents,
  getMessages,
  getSupplier,
  orders,
  suppliers,
  type Customer,
  type CustomerFollowup,
  type CustomerInteraction,
  type CustomerTag,
  type Device,
  type FaultPriceItem,
  type MessageLog,
  type OrderEvent,
  type RepairOrder,
} from "./fixtures";
import { CURRENCY_CODE } from "@/lib/money";
import type { RepairOrderStatus, RepairOrderType } from "./enums";
import type {
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerListFilters,
  CustomerListItem,
  CustomerListResult,
  CustomerMessageInput,
  CustomerStats,
  CustomerUpdateInput,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";
import {
  ORDER_STATUS_ALLOWED_FOR_CREATE,
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
  normalizeInitialOrderStatus,
  validateOrderTransition,
} from "./workflow";

export interface OrderListFilters {
  search?: string;
  statuses?: RepairOrderStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
  /** Show only overdue rows. "any" = either approval or pickup overdue. */
  overdue?: "approval" | "pickup" | "any";
}

export interface OrderListItem extends RepairOrder {
  customer_name: string;
  customer_phone: string;
  device_label: string;
  device_imei: string;
  supplier_name?: string;
  supplier_color?: string;
  approval_overdue: boolean;
  pickup_overdue: boolean;
}

const extraEvents: OrderEvent[] = [];
const extraMessages: MessageLog[] = [];
const extraCustomerInteractions: CustomerInteraction[] = [];
const extraCustomerFollowups: CustomerFollowup[] = [];
const dynamicTagAssignments: { customer_id: string; tag_id: string }[] = [];
const tagOverrides = new Set<string>();

function phoneRaw(value: string) {
  return value.replace(/\D/g, "");
}

function decorate(o: RepairOrder): OrderListItem {
  const c = getCustomer(o.customer_id);
  const d = getDevice(o.device_id);
  const s = getSupplier(o.supplier_id);
  const snapshot = o.device_snapshot;
  const deviceLabel = snapshot
    ? `${snapshot.brand} ${snapshot.model}`.trim()
    : d
      ? `${d.brand} ${d.model}`
      : "—";
  return {
    ...o,
    customer_name: c?.name ?? "—",
    customer_phone: c?.phone_e164 ?? "",
    device_label: deviceLabel || "—",
    device_imei: snapshot?.serial_or_imei ?? d?.serial_or_imei ?? "",
    supplier_name: s?.name,
    supplier_color: s?.color,
    approval_overdue: isApprovalOverdue(o),
    pickup_overdue: isPickupOverdue(o),
  };
}

// GET /api/orders
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
export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.phone_e164.toLowerCase().includes(s) ||
        c.phone_raw.includes(s),
    )
    .slice(0, limit);
}

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  return devices.filter((d) => d.customer_id === customerId);
}

function allCustomerInteractions() {
  return [...extraCustomerInteractions, ...customerInteractions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function allCustomerFollowups() {
  return [...extraCustomerFollowups, ...customerFollowups].sort(
    (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
  );
}

function assignmentsFor(customerId: string) {
  const source = tagOverrides.has(customerId)
    ? dynamicTagAssignments
    : [...dynamicTagAssignments, ...customerTagAssignments];
  return source.filter((assignment) => assignment.customer_id === customerId);
}

function tagsFor(customerId: string): CustomerTag[] {
  return assignmentsFor(customerId)
    .map((assignment) => customerTags.find((tag) => tag.id === assignment.tag_id))
    .filter((tag): tag is CustomerTag => Boolean(tag));
}

function customerStatsFromOrders(customerOrders: OrderListItem[]) {
  return {
    order_count: customerOrders.length,
    total_spent: customerOrders
      .filter((order) => order.is_paid)
      .reduce((sum, order) => sum + order.quotation_amount, 0),
    unpaid_amount: customerOrders.reduce((sum, order) => sum + order.balance_amount, 0),
    last_order_at: customerOrders
      .map((order) => order.created_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
  };
}

function nextFollowup(customerId: string) {
  return allCustomerFollowups()
    .filter((followup) => followup.customer_id === customerId && followup.status === "open")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
}

async function buildCustomerItem(customer: Customer): Promise<CustomerListItem> {
  const customerOrders = (await listOrders()).filter((order) => order.customer_id === customer.id);
  const customerDevices = devices.filter((device) => device.customer_id === customer.id);
  const stats = customerStatsFromOrders(customerOrders);
  const latestDevice = customerDevices[0];
  return {
    ...customer,
    tags: tagsFor(customer.id),
    device_count: customerDevices.length,
    order_count: stats.order_count,
    total_spent: stats.total_spent,
    unpaid_amount: stats.unpaid_amount,
    last_order_at: stats.last_order_at,
    next_followup_at: nextFollowup(customer.id)?.due_at,
    latest_device_label: latestDevice ? `${latestDevice.brand} ${latestDevice.model}` : undefined,
    device_search_text: customerDevices
      .map((device) =>
        [device.brand, device.model, device.serial_or_imei, device.device_notes]
          .filter(Boolean)
          .join(" "),
      )
      .join(" ")
      .toLowerCase(),
  };
}

function filterCustomerItems(items: CustomerListItem[], filters: CustomerListFilters = {}) {
  let result = items;
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    const raw = phoneRaw(q);
    result = result.filter(
      (customer) =>
        customer.name.toLowerCase().includes(q) ||
        customer.phone_e164.toLowerCase().includes(q) ||
        customer.phone_raw.includes(raw || q) ||
        customer.email?.toLowerCase().includes(q) ||
        customer.latest_device_label?.toLowerCase().includes(q) ||
        customer.device_search_text?.includes(q),
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
    return bTime - aTime;
  });
}

export async function listCustomers(
  filters: CustomerListFilters = {},
): Promise<CustomerListResult> {
  const items = await Promise.all(customers.map(buildCustomerItem));
  const stats: CustomerStats = {
    total: items.length,
    repeat: items.filter((customer) => customer.order_count > 1).length,
    dueFollowups: items.filter(
      (customer) =>
        customer.next_followup_at && new Date(customer.next_followup_at).getTime() <= Date.now(),
    ).length,
    marketable: items.filter((customer) => customer.consent_marketing && !customer.blacklisted_at)
      .length,
  };
  return { customers: filterCustomerItems(items, filters), tags: customerTags, stats };
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const customer = getCustomer(id);
  if (!customer) throw new Error("客户不存在");
  const customerOrders = (await listOrders()).filter((order) => order.customer_id === id);
  const orderStats = customerStatsFromOrders(customerOrders);
  return {
    customer,
    devices: devices.filter((device) => device.customer_id === id),
    orders: customerOrders,
    tags: tagsFor(id),
    interactions: allCustomerInteractions().filter((interaction) => interaction.customer_id === id),
    followups: allCustomerFollowups().filter((followup) => followup.customer_id === id),
    stats: {
      ...orderStats,
      device_count: devices.filter((device) => device.customer_id === id).length,
      next_followup_at: nextFollowup(id)?.due_at,
    },
  };
}

function applyCustomerInput(customer: Customer, input: CustomerUpdateInput) {
  if (!input.name.trim() || !input.phone_e164.trim()) throw new Error("客户姓名和手机号不能为空");
  const raw = phoneRaw(input.phone_e164);
  const duplicate = customers.find((item) => item.id !== customer.id && item.phone_raw === raw);
  if (duplicate) throw new Error("该手机号已存在客户档案");
  customer.name = input.name.trim();
  customer.phone_e164 = input.phone_e164.trim();
  customer.phone_raw = raw;
  customer.email = input.email?.trim() || undefined;
  customer.contact_phones = input.contact_phones ?? [];
  customer.consent_marketing = Boolean(input.consent_marketing);
  customer.consent_sms = input.consent_sms ?? true;
  customer.preferred_channel = input.preferred_channel ?? "whatsapp";
  customer.language = input.language ?? "it";
  customer.notes = input.notes?.trim() || undefined;
  customer.marketing_notes = input.marketing_notes?.trim() || undefined;
  customer.blacklisted_at = input.blacklisted ? new Date().toISOString() : undefined;
}

export async function createCustomer(input: CustomerCreateInput): Promise<{ id: string }> {
  const id = `cus_new_${Date.now()}`;
  const customer: Customer = {
    id,
    name: "",
    phone_raw: "",
    phone_e164: "",
    contact_phones: [],
    consent_marketing: false,
    consent_sms: true,
    preferred_channel: "whatsapp",
    language: "it",
  };
  applyCustomerInput(customer, input);
  customers.push(customer);
  return { id };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
): Promise<{ ok: boolean }> {
  const customer = getCustomer(id);
  if (!customer) throw new Error("客户不存在");
  applyCustomerInput(customer, input);
  return { ok: true };
}

export async function upsertCustomerDevice(
  customerId: string,
  input: CustomerDeviceInput,
): Promise<{ id: string }> {
  const customer = getCustomer(customerId);
  if (!customer) throw new Error("客户不存在");
  if (!input.brand.trim() || !input.model.trim()) throw new Error("设备品牌和型号不能为空");
  const existing = input.id ? devices.find((device) => device.id === input.id) : undefined;
  const device =
    existing ??
    ({
      id: `dev_new_${Date.now()}`,
      customer_id: customerId,
      brand: "",
      model: "",
      serial_or_imei: "",
    } satisfies Device);
  device.customer_id = customerId;
  device.brand = input.brand.trim();
  device.model = input.model.trim();
  device.serial_or_imei = input.serial_or_imei?.trim() ?? "";
  device.device_notes = input.device_notes?.trim() || undefined;
  if (!existing) devices.push(device);
  return { id: device.id };
}

export async function deleteCustomerDevice(
  customerId: string,
  deviceId: string,
): Promise<{ ok: boolean }> {
  const index = devices.findIndex(
    (device) => device.id === deviceId && device.customer_id === customerId,
  );
  if (index < 0) throw new Error("设备不存在");
  if (orders.some((order) => order.device_id === deviceId))
    throw new Error("该设备已有工单记录，不能删除");
  devices.splice(index, 1);
  return { ok: true };
}

export async function setCustomerTags(
  customerId: string,
  tagIds: string[],
): Promise<{ ok: boolean }> {
  tagOverrides.add(customerId);
  for (let index = dynamicTagAssignments.length - 1; index >= 0; index--) {
    if (dynamicTagAssignments[index].customer_id === customerId)
      dynamicTagAssignments.splice(index, 1);
  }
  for (const tagId of Array.from(new Set(tagIds))) {
    dynamicTagAssignments.push({ customer_id: customerId, tag_id: tagId });
  }
  return { ok: true };
}

export async function createCustomerFollowup(
  customerId: string,
  input: CustomerFollowupInput,
): Promise<{ id: string }> {
  if (!input.title.trim()) throw new Error("回访标题不能为空");
  const id = `cf_new_${Date.now()}`;
  const now = new Date().toISOString();
  extraCustomerFollowups.unshift({
    id,
    customer_id: customerId,
    order_id: input.order_id,
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    due_at: new Date(input.due_at).toISOString(),
    owner_name: input.owner_name?.trim() || undefined,
    status: "open",
    created_at: now,
    updated_at: now,
  });
  return { id };
}

export async function completeCustomerFollowup(
  customerId: string,
  followupId: string,
): Promise<{ ok: boolean }> {
  const followup = allCustomerFollowups().find(
    (item) => item.id === followupId && item.customer_id === customerId,
  );
  if (!followup) throw new Error("回访任务不存在");
  followup.status = "done";
  followup.completed_at = new Date().toISOString();
  followup.updated_at = followup.completed_at;
  return { ok: true };
}

export async function sendCustomerMessage(
  customerId: string,
  input: CustomerMessageInput,
): Promise<{ ok: boolean; id: string }> {
  const customer = getCustomer(customerId);
  if (!customer) throw new Error("客户不存在");
  if (!input.body.trim()) throw new Error("消息内容不能为空");
  const now = new Date().toISOString();
  const id = `ci_new_${Date.now()}`;
  extraCustomerInteractions.unshift({
    id,
    customer_id: customerId,
    order_id: input.order_id,
    channel: input.channel,
    direction: "outbound",
    message_body: input.body.trim(),
    status: "sent",
    operator_name: "前台",
    created_at: now,
  });
  customer.last_contacted_at = now;
  return { ok: true, id };
}

// POST /api/orders — appends to the in-memory store so the new order shows up
// immediately on the list / detail pages without a backend.
export interface CreateOrderInput {
  // existing customer
  customer_id?: string;
  device_id?: string;
  // or new customer/device — ignored if customer_id is supplied
  customer_name?: string;
  customer_phone?: string;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  device_notes?: string;
  // order fields
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  issue_description: string;
  technician_name: string;
  internal_tag?: string;
  warranty_text?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

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

export const allTechnicians = Array.from(new Set(orders.map((o) => o.technician_name)));
export { suppliers, customers, devices };
