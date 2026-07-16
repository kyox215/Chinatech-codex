import type {
  AuditActor,
  Customer,
  CustomerCreateInput,
  CustomerDetail,
  CustomerDeviceInput,
  CustomerFollowup,
  CustomerFollowupInput,
  CustomerHistoryDeviceCandidate,
  CustomerIntakeCandidate,
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
import { buildCustomerOrderFinanceSummary } from "@/features/customers/model/customer-order-state";
import { getSupabaseAdmin } from "@/server/supabase";
import { can } from "@/server/permissions";
import { projectOrderListItemForActor } from "@/features/orders/server/order.repository";
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
  isMissingRepairOrderColumnError,
  ORDER_LIST_LEGACY_SELECT,
  ORDER_LIST_SELECT,
  operatorNameFromActor,
  phoneRaw,
  requiredString,
  requireStoreIdFromActor,
  snapshotFromDevice,
  tagFromRow,
} from "@/server/repairdesk-shared";

export async function searchCustomers(
  q: string,
  limit = 6,
  actor?: AuditActor,
): Promise<Customer[]> {
  const storeId = requireStoreIdFromActor(actor);
  const rawQuery = q.trim();
  const query = rawQuery.toLowerCase();
  if (!query) return [];
  const resultLimit = Math.min(12, Math.max(1, Math.floor(Number(limit) || 6)));
  const phoneTerm = phoneRaw(query);
  const canSearchPhone = phoneTerm.length >= 3;
  if (query.length < 2 && !canSearchPhone) return [];

  const supabase = getSupabaseAdmin();
  const selectFields = "id,name,phone_e164,phone_raw,contact_phones,updated_at";
  const queries = [
    ...(canSearchPhone
      ? [
          supabase
            .from("customers")
            .select(selectFields)
            .eq("store_id", storeId)
            .eq("phone_raw", phoneTerm)
            .limit(resultLimit),
          supabase
            .from("customers")
            .select(selectFields)
            .eq("store_id", storeId)
            .ilike("phone_raw", `${phoneTerm}%`)
            .order("updated_at", { ascending: false })
            .limit(resultLimit * 2),
          supabase
            .from("customers")
            .select(selectFields)
            .eq("store_id", storeId)
            .ilike("phone_raw", `%${phoneTerm}%`)
            .order("updated_at", { ascending: false })
            .limit(resultLimit * 2),
        ]
      : []),
    ...(query.length >= 2
      ? [
          supabase
            .from("customers")
            .select(selectFields)
            .eq("store_id", storeId)
            .ilike("name", `%${rawQuery}%`)
            .order("updated_at", { ascending: false })
            .limit(resultLimit * 2),
        ]
      : []),
    ...(canSearchPhone
      ? [
          supabase
            .from("customers")
            .select(selectFields)
            .eq("store_id", storeId)
            .order("updated_at", { ascending: false })
            .limit(80),
        ]
      : []),
  ];

  const settled = await Promise.all(queries);
  const rows: DbRecord[] = [];
  for (const result of settled) {
    fail(result.error, "搜索客户失败");
    rows.push(...(((result.data ?? []) as DbRecord[]) ?? []));
  }

  const unique = new Map<string, { customer: Customer; updatedAt: string; rank: number }>();
  for (const row of rows) {
    const customer = customerFromRow(row);
    if (!customer) continue;
    const rank = customerSearchRank(customer, query, phoneTerm);
    if (rank >= 99) continue;
    const updatedAt = requiredString(row.updated_at);
    const current = unique.get(customer.id);
    if (
      !current ||
      rank < current.rank ||
      (rank === current.rank && updatedAt > current.updatedAt)
    ) {
      unique.set(customer.id, { customer, updatedAt, rank });
    }
  }

  return [...unique.values()]
    .sort((a, b) => a.rank - b.rank || b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => item.customer)
    .slice(0, resultLimit);
}

export async function searchCustomerIntakeCandidates(
  q: string,
  limit = 6,
  deviceLimit = 4,
  actor?: AuditActor,
): Promise<CustomerIntakeCandidate[]> {
  const customers = await searchCustomers(q, limit, actor);
  if (!customers.length) return [];

  const storeId = requireStoreIdFromActor(actor);
  const customerIds = customers.map((customer) => customer.id);
  const resultDeviceLimit = Math.min(8, Math.max(1, Math.floor(Number(deviceLimit) || 4)));
  const supabase = getSupabaseAdmin();
  const [{ data: deviceRows, error: deviceError }, { data: orderRows, error: orderError }] =
    await Promise.all([
      supabase
        .from("devices")
        .select("*")
        .eq("store_id", storeId)
        .in("customer_id", customerIds)
        .order("updated_at", { ascending: false }),
      fetchCustomerIntakeOrderRows(
        supabase,
        storeId,
        customerIds,
        customerIds.length * resultDeviceLimit * 8,
      ),
    ]);
  fail(deviceError, "读取客户历史设备失败");
  fail(orderError, "读取客户历史工单设备失败");

  const byCustomer = new Map<string, Map<string, CustomerHistoryDeviceCandidate>>();

  for (const row of ((deviceRows ?? []) as DbRecord[]) ?? []) {
    const device = deviceFromRow(row);
    if (!device || !customerIds.includes(device.customer_id)) continue;
    upsertHistoryDeviceCandidate(byCustomer, {
      id: `device:${device.id}`,
      customer_id: device.customer_id,
      source: "customer_device",
      device_id: device.id,
      brand: device.brand,
      model: device.model,
      serial_or_imei: device.serial_or_imei,
      device_notes: device.device_notes,
      last_seen_at: requiredString(row.updated_at) || requiredString(row.created_at),
    });
  }

  for (const row of ((orderRows ?? []) as DbRecord[]) ?? []) {
    const order = decorate(row);
    if (!customerIds.includes(order.customer_id)) continue;
    const relatedDevice = deviceFromRow(row.device);
    const snapshot =
      order.device_snapshot ?? (relatedDevice ? snapshotFromDevice(relatedDevice) : undefined);
    if (!snapshot?.brand && !snapshot?.model) continue;
    upsertHistoryDeviceCandidate(byCustomer, {
      id: `order:${order.id}`,
      customer_id: order.customer_id,
      source: "order_history",
      device_id: relatedDevice?.id,
      brand: snapshot.brand,
      model: snapshot.model,
      serial_or_imei: snapshot.serial_or_imei,
      device_notes: snapshot.device_notes,
      last_seen_at: order.created_at,
      order_id: order.id,
      order_public_no: order.public_no,
    });
  }

  return customers.map((customer) => ({
    customer,
    exactMatch: isExactCustomerIntakeMatch(customer, q),
    historyDevices: [...(byCustomer.get(customer.id)?.values() ?? [])]
      .sort(compareHistoryDeviceCandidates)
      .slice(0, resultDeviceLimit),
  }));
}

function isExactCustomerIntakeMatch(customer: Customer, q: string) {
  const raw = phoneRaw(q);
  if (!raw) return false;
  return (
    customer.phone_raw === raw ||
    normalizePhoneRaw(customer.phone_e164) === raw ||
    customer.contact_phones.some((phone) => normalizePhoneRaw(phone) === raw)
  );
}

function historyDeviceKey(
  candidate: Pick<CustomerHistoryDeviceCandidate, "brand" | "model" | "serial_or_imei">,
) {
  return [candidate.brand, candidate.model, candidate.serial_or_imei]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

function upsertHistoryDeviceCandidate(
  byCustomer: Map<string, Map<string, CustomerHistoryDeviceCandidate>>,
  candidate: CustomerHistoryDeviceCandidate,
) {
  const brand = candidate.brand.trim();
  const model = candidate.model.trim();
  if (!brand && !model) return;
  const normalizedCandidate = {
    ...candidate,
    brand,
    model,
    serial_or_imei: candidate.serial_or_imei.trim(),
  };
  const customerMap =
    byCustomer.get(candidate.customer_id) ?? new Map<string, CustomerHistoryDeviceCandidate>();
  const key = historyDeviceKey(normalizedCandidate);
  const existing = customerMap.get(key);
  customerMap.set(key, mergeHistoryDeviceCandidate(existing, normalizedCandidate));
  byCustomer.set(candidate.customer_id, customerMap);
}

function mergeHistoryDeviceCandidate(
  existing: CustomerHistoryDeviceCandidate | undefined,
  candidate: CustomerHistoryDeviceCandidate,
) {
  if (!existing) return candidate;
  const candidateIsNewer = compareDate(candidate.last_seen_at, existing.last_seen_at) > 0;
  if (existing.source === "customer_device" && candidate.source === "order_history") {
    return {
      ...existing,
      last_seen_at: candidateIsNewer ? candidate.last_seen_at : existing.last_seen_at,
      order_id: candidate.order_id ?? existing.order_id,
      order_public_no: candidate.order_public_no ?? existing.order_public_no,
    };
  }
  if (existing.source === "order_history" && candidate.source === "customer_device") {
    return {
      ...candidate,
      last_seen_at: candidateIsNewer ? candidate.last_seen_at : existing.last_seen_at,
      order_id: existing.order_id,
      order_public_no: existing.order_public_no,
    };
  }
  return candidateIsNewer ? candidate : existing;
}

function compareHistoryDeviceCandidates(
  a: CustomerHistoryDeviceCandidate,
  b: CustomerHistoryDeviceCandidate,
) {
  const time = compareDate(b.last_seen_at, a.last_seen_at);
  if (time !== 0) return time;
  if (a.source !== b.source) return a.source === "customer_device" ? -1 : 1;
  return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "zh-CN");
}

function compareDate(a?: string, b?: string) {
  return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime();
}

function customerSearchRank(customer: Customer, query: string, phoneTerm: string) {
  const name = customer.name.toLowerCase();
  if (phoneTerm) {
    if (customer.phone_raw === phoneTerm) return 0;
    if (customer.phone_raw.startsWith(phoneTerm)) return 1;
    if (customer.phone_raw.includes(phoneTerm)) return 2;
    if (customer.contact_phones.some((phone) => phoneMatches(phone, query))) return 3;
  }
  if (name === query) return 4;
  if (name.startsWith(query)) return 5;
  if (name.includes(query)) return 6;
  return 99;
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
  const rows: DbRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("customer_tags")
      .select("*")
      .eq("store_id", storeId)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + CUSTOMER_LIST_PAGE_SIZE - 1);
    fail(error, "读取客户标签失败");

    const batch = (data ?? []) as DbRecord[];
    rows.push(...batch);
    if (batch.length < CUSTOMER_LIST_PAGE_SIZE) break;
    from += CUSTOMER_LIST_PAGE_SIZE;
  }

  return rows.map(tagFromRow).filter((tag): tag is CustomerTag => Boolean(tag));
}

async function fetchCustomerTagAssignments(
  storeId: string,
): Promise<{ customer_id: string; tag_id: string }[]> {
  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("customer_tag_assignments")
      .select("*")
      .eq("store_id", storeId)
      .order("customer_id", { ascending: true })
      .order("tag_id", { ascending: true })
      .range(from, from + CUSTOMER_LIST_PAGE_SIZE - 1);
    fail(error, "读取客户标签绑定失败");

    const batch = (data ?? []) as DbRecord[];
    rows.push(...batch);
    if (batch.length < CUSTOMER_LIST_PAGE_SIZE) break;
    from += CUSTOMER_LIST_PAGE_SIZE;
  }

  return rows.map((row) => ({
    customer_id: requiredString(row.customer_id),
    tag_id: requiredString(row.tag_id),
  }));
}

function customerStatsFromOrders(orders: OrderListItem[]) {
  const finance = buildCustomerOrderFinanceSummary(orders);
  return {
    order_count: finance.historicalOrderCount,
    valid_order_count: finance.validOrderCount,
    active_order_count: finance.activeOrderCount,
    lifetime_quoted_amount: finance.lifetimeQuotedAmount,
    outstanding_amount: finance.outstandingAmount,
    total_spent: finance.lifetimeQuotedAmount,
    unpaid_amount: finance.outstandingAmount,
    last_order_at: finance.lastOrderAt,
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
    valid_order_count: stats.valid_order_count,
    active_order_count: stats.active_order_count,
    lifetime_quoted_amount: stats.lifetime_quoted_amount,
    outstanding_amount: stats.outstanding_amount,
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

async function fetchCustomerOrderWorkflowBuckets(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
) {
  const { data, error } = await supabase
    .from("order_workflow_statuses")
    .select("code,bucket")
    .eq("store_id", storeId);
  fail(error, "读取工单状态口径失败");
  return new Map(
    ((data ?? []) as DbRecord[]).map((row) => [
      requiredString(row.code),
      requiredString(row.bucket) as OrderListItem["workflow_bucket"],
    ]),
  );
}

async function fetchCustomerIntakeOrderRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerIds: string[],
  limit: number,
) {
  const result = await supabase
    .from("repair_orders")
    .select(ORDER_LIST_SELECT)
    .eq("store_id", storeId)
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error && isMissingRepairOrderColumnError(result.error)) {
    return supabase
      .from("repair_orders")
      .select(ORDER_LIST_LEGACY_SELECT)
      .eq("store_id", storeId)
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false })
      .limit(limit);
  }
  return result;
}

async function fetchCustomerDetailOrderRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerId: string,
) {
  const result = await supabase
    .from("repair_orders")
    .select(ORDER_LIST_SELECT)
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });
  if (result.error && isMissingRepairOrderColumnError(result.error)) {
    return supabase
      .from("repair_orders")
      .select(ORDER_LIST_LEGACY_SELECT)
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false });
  }
  return result;
}

function decorateCustomerOrder(
  row: DbRecord,
  workflowBuckets: Map<string, OrderListItem["workflow_bucket"]>,
) {
  const order = decorate(row);
  return { ...order, workflow_bucket: workflowBuckets.get(order.status) };
}

export function projectCustomerAggregateFinance(
  customer: CustomerListItem,
  actor?: AuditActor,
): CustomerListItem {
  if (can(actor, "finance:aggregate_read")) return customer;
  const {
    lifetime_quoted_amount: _lifetimeQuotedAmount,
    outstanding_amount: _outstandingAmount,
    total_spent: _totalSpent,
    unpaid_amount: _unpaidAmount,
    ...visible
  } = customer;
  return { ...visible, finance_redacted: true };
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
  if (filters.work && filters.work !== "all") {
    result = result.filter((customer) => {
      if (filters.work === "active") return customer.active_order_count > 0;
      if (filters.work === "unpaid") {
        return (customer.outstanding_amount ?? customer.unpaid_amount ?? 0) > 0;
      }
      if (filters.work === "with_devices") return customer.device_count > 0;
      if (filters.work === "repeat") return (customer.valid_order_count ?? 0) > 1;
      return true;
    });
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

const CUSTOMER_LIST_PAGE_SIZE = 1000;

export async function fetchCustomerRows(storeId: string): Promise<DbRecord[]> {
  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("store_id", storeId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + CUSTOMER_LIST_PAGE_SIZE - 1);
    fail(error, "读取客户失败");

    const batch = (data ?? []) as DbRecord[];
    rows.push(...batch);
    if (batch.length < CUSTOMER_LIST_PAGE_SIZE) break;
    from += CUSTOMER_LIST_PAGE_SIZE;
  }

  return rows;
}

export async function fetchCustomerDeviceRows(storeId: string): Promise<DbRecord[]> {
  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + CUSTOMER_LIST_PAGE_SIZE - 1);
    fail(error, "读取客户设备失败");

    const batch = (data ?? []) as DbRecord[];
    rows.push(...batch);
    if (batch.length < CUSTOMER_LIST_PAGE_SIZE) break;
    from += CUSTOMER_LIST_PAGE_SIZE;
  }

  return rows;
}

export async function listCustomers(
  filters: CustomerListFilters = {},
  actor?: AuditActor,
): Promise<CustomerListResult> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const canReadAggregateFinance = can(actor, "finance:aggregate_read");
  const visibleFilters =
    !canReadAggregateFinance && filters.work === "unpaid"
      ? { ...filters, work: "all" as const }
      : filters;
  const customerRows = await fetchCustomerRows(storeId);

  const customers = ((customerRows ?? []) as DbRecord[])
    .map(customerFromRow)
    .filter((customer): customer is Customer => Boolean(customer));
  const customerIds = customers.map((customer) => customer.id);

  const [deviceRows, { data: followupRows, error: followupError }] = await Promise.all([
    fetchCustomerDeviceRows(storeId),
    fetchFollowupsForCustomerIds(storeId, customerIds),
  ]);
  fail(followupError, "读取客户待办失败");

  const devices = ((deviceRows ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
  const followups = ((followupRows ?? []) as DbRecord[]).map(followupFromRow);
  const workflowBuckets = await fetchCustomerOrderWorkflowBuckets(supabase, storeId);
  const orders = (await fetchOrderRows(storeId)).map((row) =>
    decorateCustomerOrder(row, workflowBuckets),
  );
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
    repeat: items.filter((customer) => (customer.valid_order_count ?? 0) > 1).length,
    activeRepairs: items.filter((customer) => customer.active_order_count > 0).length,
    unpaid: canReadAggregateFinance
      ? items.filter((customer) => (customer.outstanding_amount ?? customer.unpaid_amount ?? 0) > 0)
          .length
      : 0,
    financeRedacted: !canReadAggregateFinance,
    withDevices: items.filter((customer) => customer.device_count > 0).length,
    dueFollowups: items.filter((customer) => {
      if (!customer.next_followup_at) return false;
      return new Date(customer.next_followup_at).getTime() <= Date.now();
    }).length,
    marketable: items.filter((customer) => customer.consent_marketing && !customer.blacklisted_at)
      .length,
  };

  return {
    customers: filterCustomers(items, visibleFilters).map((customer) =>
      projectCustomerAggregateFinance(customer, actor),
    ),
    tags,
    stats,
  };
}

export async function listCustomersPage(
  input: CustomerListPageInput = {},
  actor?: AuditActor,
): Promise<CustomerListPageResult> {
  const storeId = requireStoreIdFromActor(actor);
  const canReadAggregateFinance = can(actor, "finance:aggregate_read");
  const visibleInput =
    !canReadAggregateFinance && input.work === "unpaid"
      ? { ...input, work: "all" as const }
      : input;
  const { page, pageSize } = normalizeCustomerPageInput(input);
  const supabase = getSupabaseAdmin();
  const rpcInput = {
    p_store_id: storeId,
    p_search: visibleInput.search?.trim() || null,
    p_tag_ids: visibleInput.tagIds?.length ? visibleInput.tagIds : null,
    p_work_filter: visibleInput.work ?? "all",
    p_marketing: visibleInput.marketing ?? "all",
    p_followup: visibleInput.followup ?? "all",
    p_page: page,
    p_page_size: pageSize,
  };
  const v3Result = await supabase.rpc("repairdesk_customer_list_page_v3", rpcInput);
  if (!v3Result.error) {
    if (!isCustomerListPageResult(v3Result.data)) {
      throw new Error("读取客户分页失败：v3 数据契约无效");
    }
    return normalizeCustomerPageResult(v3Result.data, page, pageSize, actor);
  }
  if (!isMissingCustomerListRpc(v3Result.error, "repairdesk_customer_list_page_v3")) {
    throw new Error(`读取客户分页失败：${v3Result.error.message}`);
  }

  const v2Result = await supabase.rpc("repairdesk_customer_list_page_v2", rpcInput);
  if (!v2Result.error) {
    if (!isCustomerListPageResult(v2Result.data)) {
      throw new Error("读取客户分页失败：v2 数据契约无效");
    }
    return normalizeCustomerPageResult(v2Result.data, page, pageSize, actor);
  }
  if (!isMissingCustomerListRpc(v2Result.error, "repairdesk_customer_list_page_v2")) {
    throw new Error(`读取客户分页失败：${v2Result.error.message}`);
  }

  if (!input.work || input.work === "all") {
    const { p_work_filter: _workFilter, ...legacyRpcInput } = rpcInput;
    const legacyRpcResult = await supabase.rpc("repairdesk_customer_list_page", legacyRpcInput);
    if (!legacyRpcResult.error && isCustomerListPageResult(legacyRpcResult.data)) {
      return normalizeCustomerPageResult(legacyRpcResult.data, page, pageSize, actor);
    }

    try {
      const legacy = await listCustomers(visibleInput, actor);
      return paginateCustomerListResult(legacy, page, pageSize);
    } catch (fallbackError) {
      const reasons = [
        v3Result.error?.message,
        v2Result.error?.message,
        legacyRpcResult.error?.message,
        errorMessage(fallbackError),
      ]
        .filter(Boolean)
        .join(" / ");
      throw new Error(reasons ? `读取客户分页失败：${reasons}` : "读取客户分页失败");
    }
  }

  try {
    const legacy = await listCustomers(visibleInput, actor);
    return paginateCustomerListResult(legacy, page, pageSize);
  } catch (fallbackError) {
    const reasons = [v3Result.error?.message, v2Result.error?.message, errorMessage(fallbackError)]
      .filter(Boolean)
      .join(" / ");
    throw new Error(reasons ? `读取客户分页失败：${reasons}` : "读取客户分页失败");
  }
}

function isMissingCustomerListRpc(
  error: { code?: string; message?: string } | null | undefined,
  functionName: string,
) {
  if (!error) return false;
  const message = error.message ?? "";
  const namesFunction = message.includes(functionName);
  return (
    namesFunction &&
    (error.code === "PGRST202" ||
      error.code === "42883" ||
      /could not find the function/i.test(message) ||
      /function .* does not exist/i.test(message))
  );
}

function isCustomerListPageResult(value: unknown): value is CustomerListPageResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<CustomerListPageResult>;
  return (
    Array.isArray(result.items) &&
    Array.isArray(result.tags) &&
    typeof result.total === "number" &&
    typeof result.page === "number" &&
    typeof result.pageSize === "number" &&
    typeof result.pageCount === "number" &&
    Boolean(result.stats)
  );
}

function normalizeCustomerPageResult(
  result: CustomerListPageResult,
  fallbackPage: number,
  fallbackPageSize: number,
  actor?: AuditActor,
): CustomerListPageResult {
  const canReadAggregateFinance = can(actor, "finance:aggregate_read");
  const total = Number(result.total ?? 0);
  const pageSize = Math.min(100, Math.max(10, Number(result.pageSize ?? fallbackPageSize)));
  const page = Math.max(1, Number(result.page ?? fallbackPage));
  return {
    items: result.items.map((item) =>
      projectCustomerAggregateFinance(normalizeCustomerAggregateFacts(item), actor),
    ),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Number(result.pageCount ?? Math.ceil(total / pageSize))),
    tags: result.tags ?? [],
    stats: {
      total: Number(result.stats?.total ?? 0),
      repeat: Number(result.stats?.repeat ?? 0),
      activeRepairs: Number(result.stats?.activeRepairs ?? 0),
      unpaid: canReadAggregateFinance ? Number(result.stats?.unpaid ?? 0) : 0,
      financeRedacted: !canReadAggregateFinance,
      withDevices: Number(result.stats?.withDevices ?? 0),
      dueFollowups: Number(result.stats?.dueFollowups ?? 0),
      marketable: Number(result.stats?.marketable ?? 0),
    },
  };
}

function normalizeCustomerAggregateFacts(item: CustomerListItem): CustomerListItem {
  const historicalOrderCount = safeNonNegativeNumber(item.order_count);
  const validOrderCount = safeNonNegativeNumber(item.valid_order_count ?? item.order_count);
  const activeOrderCount = safeNonNegativeNumber(item.active_order_count);
  const lifetimeQuotedAmount = safeNonNegativeNumber(
    item.lifetime_quoted_amount ?? item.total_spent,
  );
  const outstandingAmount = safeNonNegativeNumber(item.outstanding_amount ?? item.unpaid_amount);
  return {
    ...item,
    order_count: historicalOrderCount,
    valid_order_count: validOrderCount,
    active_order_count: activeOrderCount,
    lifetime_quoted_amount: lifetimeQuotedAmount,
    outstanding_amount: outstandingAmount,
    total_spent: lifetimeQuotedAmount,
    unpaid_amount: outstandingAmount,
  };
}

function safeNonNegativeNumber(value: unknown) {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
}

function paginateCustomerListResult(
  result: CustomerListResult,
  page: number,
  pageSize: number,
): CustomerListPageResult {
  const total = result.customers.length;
  const start = (page - 1) * pageSize;
  return {
    items: result.customers.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    tags: result.tags,
    stats: result.stats,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

async function fetchCustomerInteractionsForCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerId: string,
) {
  return supabase
    .from("customer_interactions")
    .select("*")
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
}

async function fetchFollowupsForCustomerIds(storeId: string, customerIds: string[]) {
  const supabase = getSupabaseAdmin();
  if (!customerIds.length) return { data: [], error: null };
  const rows: DbRecord[] = [];
  const customerIdChunkSize = 100;

  for (let chunkStart = 0; chunkStart < customerIds.length; chunkStart += customerIdChunkSize) {
    const chunk = customerIds.slice(chunkStart, chunkStart + customerIdChunkSize);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("customer_followups")
        .select("*")
        .eq("store_id", storeId)
        .in("customer_id", chunk)
        .order("due_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + CUSTOMER_LIST_PAGE_SIZE - 1);
      if (error) return { data: null, error };

      const batch = (data ?? []) as DbRecord[];
      rows.push(...batch);
      if (batch.length < CUSTOMER_LIST_PAGE_SIZE) break;
      from += CUSTOMER_LIST_PAGE_SIZE;
    }
  }

  return { data: rows, error: null };
}

async function fetchFollowupsForCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerId: string,
) {
  return supabase
    .from("customer_followups")
    .select("*")
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .order("due_at", { ascending: true });
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
    fetchCustomerDetailOrderRows(supabase, storeId, id),
    fetchCustomerInteractionsForCustomer(supabase, storeId, id),
    fetchFollowupsForCustomer(supabase, storeId, id),
  ]);
  fail(customerError, "读取客户详情失败");
  fail(deviceError, "读取客户设备失败");
  fail(orderError, "读取客户工单失败");
  fail(interactionError, "读取客户联系记录失败");
  fail(followupError, "读取客户待办失败");

  const customer = customerFromRow(customerRow);
  if (!customer) throw new Error("客户不存在");
  const devices = ((deviceRows ?? []) as DbRecord[])
    .map(deviceFromRow)
    .filter((device): device is Device => Boolean(device));
  const interactions = ((interactionRows ?? []) as DbRecord[]).map(interactionFromRow);
  const followups = ((followupRows ?? []) as DbRecord[]).map(followupFromRow);
  const workflowBuckets = await fetchCustomerOrderWorkflowBuckets(supabase, storeId);
  const orders = ((orderRows ?? []) as DbRecord[]).map((row) =>
    decorateCustomerOrder(row, workflowBuckets),
  );
  const allTags = await fetchCustomerTags(storeId);
  const assignments = (await fetchCustomerTagAssignments(storeId)).filter(
    (assignment) => assignment.customer_id === id,
  );
  const tags = assignments
    .map((assignment) => allTags.find((tag) => tag.id === assignment.tag_id))
    .filter((tag): tag is CustomerTag => Boolean(tag));
  const orderStats = customerStatsFromOrders(orders);
  const canReadAggregateFinance = can(actor, "finance:aggregate_read");

  return {
    customer,
    devices,
    orders: orders.map((order) => projectOrderListItemForActor(order, actor)),
    tags,
    interactions,
    followups,
    stats: {
      ...orderStats,
      lifetime_quoted_amount: canReadAggregateFinance
        ? orderStats.lifetime_quoted_amount
        : undefined,
      outstanding_amount: canReadAggregateFinance ? orderStats.outstanding_amount : undefined,
      total_spent: canReadAggregateFinance ? orderStats.total_spent : undefined,
      unpaid_amount: canReadAggregateFinance ? orderStats.unpaid_amount : undefined,
      finance_redacted: canReadAggregateFinance ? undefined : true,
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
  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("store_id", storeId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  fail(error, "更新客户失败");
  if (!data) throw new Error("客户不存在");
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
  await assertCustomerBelongsToStore(supabase, storeId, customerId);
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
    const { data, error } = await supabase
      .from("devices")
      .update(payload)
      .eq("store_id", storeId)
      .eq("id", input.id)
      .eq("customer_id", customerId)
      .select("id")
      .maybeSingle();
    fail(error, "保存客户设备失败");
    if (!data) throw new Error("设备不存在");
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
    .eq("customer_id", customerId)
    .eq("device_id", deviceId)
    .limit(1);
  fail(readError, "检查设备工单失败");
  if ((orders ?? []).length) throw new Error("该设备已有工单记录，不能删除");
  const { data, error } = await supabase
    .from("devices")
    .delete()
    .eq("store_id", storeId)
    .eq("id", deviceId)
    .eq("customer_id", customerId)
    .select("id")
    .maybeSingle();
  fail(error, "删除设备失败");
  if (!data) throw new Error("设备不存在");
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
  await assertCustomerBelongsToStore(supabase, storeId, customerId);
  await assertCustomerTagsBelongToStore(supabase, storeId, cleanIds);
  const deleteResult = await supabase
    .from("customer_tag_assignments")
    .delete()
    .eq("store_id", storeId)
    .eq("customer_id", customerId);
  fail(deleteResult.error, "清理客户标签失败");
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
  if (!input.title.trim()) throw new Error("待办标题不能为空");
  const due = new Date(input.due_at);
  if (Number.isNaN(due.getTime())) throw new Error("待办时间不正确");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  await assertCustomerBelongsToStore(supabase, storeId, customerId);
  if (input.order_id) {
    await assertOrderBelongsToCustomerInStore(supabase, storeId, customerId, input.order_id);
  }
  const id = crypto.randomUUID();
  const payload = {
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
  };
  const { error } = await supabase.from("customer_followups").insert(payload);
  fail(error, "创建客户待办失败");
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
  const result = await supabase
    .from("customer_followups")
    .update({ status: "done", completed_at: now, updated_at: now })
    .eq("store_id", storeId)
    .eq("id", followupId)
    .eq("customer_id", customerId)
    .select("id")
    .maybeSingle();
  fail(result.error, "完成客户待办失败");
  if (!result.data) throw new Error("客户待办不存在");
  return { ok: true };
}

async function assertCustomerBelongsToStore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerId: string,
) {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("store_id", storeId)
    .eq("id", customerId)
    .maybeSingle();
  fail(error, "检查客户归属失败");
  if (!data) throw new Error("客户不存在");
}

async function assertCustomerTagsBelongToStore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  tagIds: string[],
) {
  if (!tagIds.length) return;
  const { data, error } = await supabase
    .from("customer_tags")
    .select("id")
    .eq("store_id", storeId)
    .in("id", tagIds);
  fail(error, "检查客户标签失败");
  const foundIds = new Set(((data ?? []) as DbRecord[]).map((row) => requiredString(row.id)));
  if (tagIds.some((tagId) => !foundIds.has(tagId))) throw new Error("客户标签不存在");
}

async function assertOrderBelongsToCustomerInStore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  customerId: string,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("repair_orders")
    .select("id")
    .eq("store_id", storeId)
    .eq("customer_id", customerId)
    .eq("id", orderId)
    .maybeSingle();
  fail(error, "检查关联工单失败");
  if (!data) throw new Error("关联工单不存在或不属于当前客户");
}

async function insertCustomerInteraction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payload: Record<string, unknown> & { store_id: string },
) {
  return supabase.from("customer_interactions").insert(payload);
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
  await assertCustomerBelongsToStore(supabase, storeId, customerId);
  if (input.order_id) {
    await assertOrderBelongsToCustomerInStore(supabase, storeId, customerId, input.order_id);
  }
  const { error: insertError } = await insertCustomerInteraction(supabase, {
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
  const { data: customerRow, error: updateError } = await supabase
    .from("customers")
    .update({ last_contacted_at: now, updated_at: now })
    .eq("store_id", storeId)
    .eq("id", customerId)
    .select("id")
    .maybeSingle();
  fail(updateError, "更新客户联系时间失败");
  if (!customerRow) throw new Error("客户不存在");
  return { ok: true, id };
}
