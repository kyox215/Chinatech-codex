import type {
  AuditActor,
  Customer,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerListFilters,
  CustomerListItem,
  CustomerListPageInput,
  CustomerListPageResult,
  CustomerListResult,
  CustomerMessageInput,
  CustomerStats,
  CustomerTag,
  CustomerUpdateInput,
  Device,
  OrderListItem,
} from "@/lib/repairdesk/types";
import { listOrders } from "@/features/orders/testing/mock-api";
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import {
  customerFollowups,
  customerInteractions,
  customerTagAssignments,
  customerTags,
  customers,
  devices,
  dynamicTagAssignments,
  extraCustomerFollowups,
  extraCustomerInteractions,
  getCustomer,
  orders,
  phoneRaw,
  tagOverrides,
} from "@/lib/mock/state";

type MockOperator = string | AuditActor;

function operatorName(operator: MockOperator = "前台") {
  return typeof operator === "string" ? operator : operator.displayName;
}

export async function searchCustomers(
  q: string,
  limit = 6,
  _actor?: AuditActor,
): Promise<Customer[]> {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        phoneMatches(c.phone_e164, s) ||
        c.phone_raw.includes(phoneRaw(s) || s) ||
        c.contact_phones.some((phone) => phoneMatches(phone, s)),
    )
    .slice(0, limit);
}

export async function getCustomerDevices(
  customerId: string,
  _actor?: AuditActor,
): Promise<Device[]> {
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
        phoneMatches(customer.phone_e164, q) ||
        customer.phone_raw.includes(raw || q) ||
        customer.contact_phones.some((phone) => phoneMatches(phone, q)) ||
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
  _actor?: AuditActor,
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

function normalizeCustomerPageInput(input: CustomerListPageInput = {}) {
  const page = Math.max(1, Math.floor(Number(input.page ?? 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
  return { page, pageSize };
}

export async function listCustomersPage(
  input: CustomerListPageInput = {},
  actor?: AuditActor,
): Promise<CustomerListPageResult> {
  const { page, pageSize } = normalizeCustomerPageInput(input);
  const { customers: filtered, tags, stats } = await listCustomers(input, actor);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
    tags,
    stats,
  };
}

export async function getCustomerDetail(id: string, _actor?: AuditActor): Promise<CustomerDetail> {
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
  const phoneBook = normalizePhoneBook(
    input.phone_e164,
    input.contact_phones ?? [],
    input.promote_contact_phone,
  );
  if (!input.name.trim() || !phoneBook.primary) throw new Error("客户姓名和手机号不能为空");
  if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
  const duplicate = customers.find(
    (item) => item.id !== customer.id && item.phone_raw === phoneBook.primaryRaw,
  );
  if (duplicate) throw new Error("该手机号已存在客户档案");
  const backupConflict = customers.find(
    (item) =>
      item.id !== customer.id &&
      phoneBook.contacts.some((phone) => item.phone_raw === normalizePhoneRaw(phone)),
  );
  if (backupConflict) throw new Error("备用号码已属于其他客户档案，请先确认客户资料");
  customer.name = input.name.trim();
  customer.phone_e164 = phoneBook.primary;
  customer.phone_raw = phoneBook.primaryRaw;
  customer.email = input.email?.trim() || undefined;
  customer.contact_phones = phoneBook.contacts;
  customer.consent_marketing = Boolean(input.consent_marketing);
  customer.consent_sms = input.consent_sms ?? true;
  customer.preferred_channel = input.preferred_channel ?? "whatsapp";
  customer.language = input.language ?? "it";
  customer.notes = input.notes?.trim() || undefined;
  customer.marketing_notes = input.marketing_notes?.trim() || undefined;
  customer.blacklisted_at = input.blacklisted ? new Date().toISOString() : undefined;
}

export async function createCustomer(
  input: CustomerCreateInput,
  _actor?: AuditActor,
): Promise<{ id: string }> {
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
  _actor?: AuditActor,
): Promise<{ ok: boolean }> {
  const customer = getCustomer(id);
  if (!customer) throw new Error("客户不存在");
  applyCustomerInput(customer, input);
  return { ok: true };
}

export async function upsertCustomerDevice(
  customerId: string,
  input: CustomerDeviceInput,
  _actor?: AuditActor,
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
  _actor?: AuditActor,
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
  _actor?: AuditActor,
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
  _actor?: AuditActor,
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
  _actor?: AuditActor,
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
  operator: MockOperator = "前台",
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
    operator_name: operatorName(operator),
    created_at: now,
  });
  customer.last_contacted_at = now;
  return { ok: true, id };
}

// POST /api/orders — appends to the in-memory store so the new order shows up
// immediately on the list / detail pages without a backend.
