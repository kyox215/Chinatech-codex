import type {
  AuditActor,
  Customer,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowup,
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
import { getSupabaseAdmin } from "@/server/supabase";
import { normalizePhoneBook, normalizePhoneRaw, phoneMatches } from "@/shared/lib/phone";
import {
  type DbRecord,
  customerFromRow,
  decorate,
  deviceFromRow,
  fail,
  fetchOrderRows,
  followupFromRow,
  interactionFromRow,
  ORDER_LIST_SELECT,
  operatorNameFromActor,
  phoneRaw,
  requiredString,
  requireStoreIdFromActor,
  tagFromRow,
} from "@/server/repairdesk-shared";

export async function searchCustomers(
  q: string,
  limit = 6,
  actor?: AuditActor,
): Promise<Customer[]> {
  const storeId = requireStoreIdFromActor(actor);
  const query = q.trim().toLowerCase();
  if (!query) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("store_id", storeId)
    .limit(200);
  fail(error, "搜索客户失败");

  return ((data ?? []) as DbRecord[])
    .map(customerFromRow)
    .filter((customer): customer is Customer => Boolean(customer))
    .filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        phoneMatches(customer.phone_e164, query) ||
        customer.phone_raw.includes(phoneRaw(query) || query) ||
        customer.contact_phones.some((phone) => phoneMatches(phone, query)),
    )
    .slice(0, limit);
}

export async function getCustomerDevices(
  customerId: string,
  actor?: AuditActor,
): Promise<Device[]> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  fail(error, "读取客户设备失败");
  return ((data ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
}
async function fetchCustomerTags(storeId: string): Promise<CustomerTag[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_tags")
    .select("*")
    .eq("store_id", storeId)
    .order("name", { ascending: true });
  fail(error, "读取客户标签失败");
  return ((data ?? []) as DbRecord[])
    .map(tagFromRow)
    .filter((tag): tag is CustomerTag => Boolean(tag));
}

async function fetchCustomerTagAssignments(
  storeId: string,
): Promise<{ customer_id: string; tag_id: string }[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_tag_assignments")
    .select("*")
    .eq("store_id", storeId);
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
        phoneMatches(customer.phone_e164, query) ||
        customer.phone_raw.includes(raw || query) ||
        customer.contact_phones.some((phone) => phoneMatches(phone, query)) ||
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

function normalizeCustomerPageInput(input: CustomerListPageInput = {}) {
  const page = Math.max(1, Math.floor(Number(input.page ?? 1)));
  const pageSize = Math.min(100, Math.max(10, Math.floor(Number(input.pageSize ?? 50))));
  return { page, pageSize };
}

export async function listCustomers(
  filters: CustomerListFilters = {},
  actor?: AuditActor,
): Promise<CustomerListResult> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const [
    { data: customerRows, error: customerError },
    { data: deviceRows, error: deviceError },
    { data: followupRows, error: followupError },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("store_id", storeId).limit(1000),
    supabase
      .from("devices")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_followups")
      .select("*")
      .eq("store_id", storeId)
      .order("due_at", { ascending: true }),
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
  const orders = (await fetchOrderRows(storeId)).map(decorate);
  const tags = await fetchCustomerTags(storeId);
  const assignments = await fetchCustomerTagAssignments(storeId);

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

export async function listCustomersPage(
  input: CustomerListPageInput = {},
  actor?: AuditActor,
): Promise<CustomerListPageResult> {
  const storeId = requireStoreIdFromActor(actor);
  const { page, pageSize } = normalizeCustomerPageInput(input);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("repairdesk_customer_list_page", {
    p_store_id: storeId,
    p_search: input.search?.trim() || null,
    p_tag_ids: input.tagIds?.length ? input.tagIds : null,
    p_marketing: input.marketing ?? "all",
    p_followup: input.followup ?? "all",
    p_page: page,
    p_page_size: pageSize,
  });
  fail(error, "读取客户分页失败");

  return data as CustomerListPageResult;
}

export async function getCustomerDetail(id: string, actor?: AuditActor): Promise<CustomerDetail> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const [
    { data: customerRow, error: customerError },
    { data: deviceRows, error: deviceError },
    { data: orderRows, error: orderError },
    { data: interactionRows, error: interactionError },
    { data: followupRows, error: followupError },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("store_id", storeId).eq("id", id).single(),
    supabase
      .from("devices")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("repair_orders")
      .select(ORDER_LIST_SELECT)
      .eq("store_id", storeId)
      .eq("customer_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("customer_interactions")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_followups")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", id)
      .order("due_at", { ascending: true }),
  ]);
  fail(customerError, "读取客户详情失败");
  fail(deviceError, "读取客户设备失败");
  fail(orderError, "读取客户工单失败");
  fail(interactionError, "读取客户联系记录失败");
  fail(followupError, "读取客户回访失败");

  const customer = customerFromRow(customerRow);
  if (!customer) throw new Error("客户不存在");
  const devices = ((deviceRows ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
  const interactions = ((interactionRows ?? []) as DbRecord[]).map(interactionFromRow);
  const followups = ((followupRows ?? []) as DbRecord[]).map(followupFromRow);
  const orders = ((orderRows ?? []) as DbRecord[]).map(decorate);
  const allTags = await fetchCustomerTags(storeId);
  const assignments = (await fetchCustomerTagAssignments(storeId)).filter(
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
  const phoneBook = normalizePhoneBook(
    input.phone_e164,
    input.contact_phones ?? [],
    input.promote_contact_phone,
  );
  if (!input.name.trim() || !phoneBook.primary) throw new Error("客户姓名和手机号不能为空");
  if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
  return {
    name: input.name.trim(),
    phone_e164: phoneBook.primary,
    phone_raw: phoneBook.primaryRaw,
    email: input.email?.trim() || null,
    contact_phones: phoneBook.contacts,
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

async function assertCustomerPhoneAvailable(
  storeId: string,
  primaryRaw: string,
  contactPhones: string[],
  excludeId?: string,
) {
  const raws = Array.from(
    new Set([
      primaryRaw,
      ...contactPhones.map((phone) => normalizePhoneRaw(phone)).filter(Boolean),
    ]),
  );
  if (raws.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone_raw")
    .eq("store_id", storeId)
    .in("phone_raw", raws);
  fail(error, "检查客户手机号失败");

  const conflicts = ((data ?? []) as DbRecord[]).filter(
    (row) => requiredString(row.id) !== excludeId,
  );
  if (conflicts.length === 0) return;

  const primaryConflict = conflicts.find((row) => requiredString(row.phone_raw) === primaryRaw);
  if (primaryConflict) throw new Error("该手机号已存在客户档案");
  throw new Error("备用号码已属于其他客户档案，请先确认客户资料");
}

export async function createCustomer(
  input: CustomerCreateInput,
  actor?: AuditActor,
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const payload = customerPayload(input, now);
  await assertCustomerPhoneAvailable(storeId, payload.phone_raw, payload.contact_phones);
  const { error } = await supabase.from("customers").insert({
    id,
    store_id: storeId,
    ...payload,
    created_at: now,
  });
  fail(error, "创建客户失败");
  return { id };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
  actor?: AuditActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const payload = customerPayload(input, now);
  await assertCustomerPhoneAvailable(storeId, payload.phone_raw, payload.contact_phones, id);
  const { error } = await supabase
    .from("customers")
    .update(payload)
    .eq("store_id", storeId)
    .eq("id", id);
  fail(error, "更新客户失败");
  return { ok: true };
}

export async function upsertCustomerDevice(
  customerId: string,
  input: CustomerDeviceInput,
  actor?: AuditActor,
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  const brand = input.brand.trim();
  const model = input.model.trim();
  if (!brand || !model) throw new Error("设备品牌和型号不能为空");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = input.id ?? crypto.randomUUID();
  const payload = {
    id,
    store_id: storeId,
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
      .eq("store_id", storeId)
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
  actor?: AuditActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const { data: orders, error: readError } = await supabase
    .from("repair_orders")
    .select("id")
    .eq("store_id", storeId)
    .eq("device_id", deviceId)
    .limit(1);
  fail(readError, "检查设备工单失败");
  if ((orders ?? []).length) throw new Error("该设备已有工单记录，不能删除");
  const { error } = await supabase
    .from("devices")
    .delete()
    .eq("store_id", storeId)
    .eq("id", deviceId)
    .eq("customer_id", customerId);
  fail(error, "删除设备失败");
  return { ok: true };
}

export async function setCustomerTags(
  customerId: string,
  tagIds: string[],
  actor?: AuditActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const cleanIds = Array.from(new Set(tagIds.filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("customer_tag_assignments")
    .delete()
    .eq("store_id", storeId)
    .eq("customer_id", customerId);
  fail(deleteError, "清理客户标签失败");
  if (cleanIds.length) {
    const { error } = await supabase.from("customer_tag_assignments").insert(
      cleanIds.map((tagId) => ({
        store_id: storeId,
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
  actor?: AuditActor,
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  if (!input.title.trim()) throw new Error("回访标题不能为空");
  const due = new Date(input.due_at);
  if (Number.isNaN(due.getTime())) throw new Error("回访时间不正确");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("customer_followups").insert({
    id,
    store_id: storeId,
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
  actor?: AuditActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customer_followups")
    .update({ status: "done", completed_at: now, updated_at: now })
    .eq("store_id", storeId)
    .eq("id", followupId)
    .eq("customer_id", customerId);
  fail(error, "完成回访失败");
  return { ok: true };
}

export async function sendCustomerMessage(
  customerId: string,
  input: CustomerMessageInput,
  operator: string | AuditActor = "前台",
): Promise<{ ok: boolean; id: string }> {
  const storeId = requireStoreIdFromActor(operator);
  const operatorName = operatorNameFromActor(operator);
  const body = input.body.trim();
  if (!body) throw new Error("消息内容不能为空");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("customer_interactions").insert({
    id,
    store_id: storeId,
    customer_id: customerId,
    order_id: input.order_id || null,
    channel: input.channel,
    direction: "outbound",
    message_body: body,
    status: "sent",
    operator_name: operatorName,
    created_at: now,
  });
  fail(insertError, "记录客户消息失败");
  const { error: updateError } = await supabase
    .from("customers")
    .update({ last_contacted_at: now, updated_at: now })
    .eq("store_id", storeId)
    .eq("id", customerId);
  fail(updateError, "更新客户联系时间失败");
  return { ok: true, id };
}
