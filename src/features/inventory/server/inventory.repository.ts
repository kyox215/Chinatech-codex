import { CURRENCY_CODE } from "@/lib/money";
import type {
  AuditActor,
  CreateInventoryIntakeInput,
  Customer,
  ElectronicsImportPreview,
  InventoryDetail,
  InventoryEvent,
  InventoryItem,
  InventoryItemStatus,
  InventoryListFilters,
  InventoryListItem,
  InventoryQualityCheck,
  InventoryQualityCheckInput,
  InventoryStats,
  InventoryTransaction,
  InventoryTransactionInput,
  SellInventoryItemInput,
  UpdateInventoryItemInput,
} from "@/lib/repairdesk/types";
import {
  customerFromRow,
  type DbRecord,
  fail,
  maybeString,
  money,
  requiredString,
  requireStoreIdFromActor,
  stringArray,
} from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import { writeAuditLog } from "@/server/audit";
import { buildSeaTableElectronicsImport } from "@/features/inventory/import/seatable-electronics";
import {
  getInventoryProfit,
  isInventoryPipelineStatus,
  validateInventoryTransition,
} from "@/features/inventory/model/inventory-workflow";
import { normalizePhoneBook } from "@/shared/lib/phone";

const INVENTORY_SELECT = `
  *,
  customer:customers!inventory_items_customer_id_fkey(*),
  buyer:customers!inventory_items_buyer_customer_id_fkey(*)
`;

const systemActor: AuditActor = {
  displayName: "系统",
  isSystem: true,
};

export async function listInventoryItems(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventoryListItem[]> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("inventory_items")
    .select(INVENTORY_SELECT)
    .eq("store_id", storeId)
    .order("updated_at", {
      ascending: false,
    });

  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.categories?.length) query = query.in("category", filters.categories);

  const { data, error } = await query.limit(1000);
  fail(error, "读取回收库存失败");

  return ((data ?? []) as DbRecord[])
    .map((row) => decorateInventoryRow(row))
    .filter((item) => inventoryMatchesFilters(item, filters));
}

export async function listInventoryItemsPage(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<{ items: InventoryListItem[]; total: number }> {
  const items = await listInventoryItems(filters, actor);
  return { items, total: items.length };
}

export async function getInventoryStats(actor?: AuditActor): Promise<InventoryStats> {
  const items = await listInventoryItems({}, actor);
  return {
    total: items.length,
    inPipeline: items.filter((item) => isInventoryPipelineStatus(item.status)).length,
    readyOrListed: items.filter(
      (item) => item.status === "ready_for_sale" || item.status === "listed",
    ).length,
    reserved: items.filter((item) => item.status === "reserved").length,
    sold: items.filter((item) => item.status === "sold").length,
    buybackCost: roundMoney(items.reduce((sum, item) => sum + item.buyback_price, 0)),
    listedValue: roundMoney(
      items
        .filter((item) => item.status === "ready_for_sale" || item.status === "listed")
        .reduce((sum, item) => sum + item.list_price, 0),
    ),
    realizedProfit: roundMoney(
      items.filter((item) => item.status === "sold").reduce((sum, item) => sum + item.profit, 0),
    ),
  };
}

export async function getInventoryItem(id: string, actor?: AuditActor): Promise<InventoryDetail> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const [itemResult, checksResult, transactionsResult, eventsResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(INVENTORY_SELECT)
      .eq("store_id", storeId)
      .eq("id", id)
      .single(),
    supabase
      .from("inventory_quality_checks")
      .select("*")
      .eq("store_id", storeId)
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_transactions")
      .select("*")
      .eq("store_id", storeId)
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_events")
      .select("*")
      .eq("store_id", storeId)
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
  ]);

  fail(itemResult.error, "读取库存商品失败");
  fail(checksResult.error, "读取检测记录失败");
  fail(transactionsResult.error, "读取库存流水失败");
  fail(eventsResult.error, "读取库存时间线失败");

  const row = itemResult.data as DbRecord;
  const transactions = ((transactionsResult.data ?? []) as DbRecord[]).map(transactionFromRow);
  const item = decorateInventoryRow(row, transactions);

  return {
    item,
    customer: customerFromRow(row.customer),
    buyer: customerFromRow(row.buyer),
    checks: ((checksResult.data ?? []) as DbRecord[]).map(checkFromRow),
    transactions,
    events: ((eventsResult.data ?? []) as DbRecord[]).map(eventFromRow),
  };
}

export async function createInventoryIntake(
  input: CreateInventoryIntakeInput,
  actor: AuditActor = systemActor,
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const customerId = await resolveCustomer(
    storeId,
    input.customer_id,
    input.customer_name,
    input.customer_phone,
    now,
  );
  const id = crypto.randomUUID();
  const payload = {
    id,
    store_id: storeId,
    status: "intake",
    source_type: "buyback",
    customer_id: customerId,
    category: clean(input.category) || "phone",
    brand: clean(input.brand),
    model: clean(input.model),
    color: nullable(input.color),
    storage_capacity: nullable(input.storage_capacity),
    serial_or_imei: nullable(input.serial_or_imei),
    imei_check_status: input.serial_or_imei ? "unknown" : "unchecked",
    buyback_price: money(input.buyback_price),
    list_price: money(input.list_price),
    deposit_amount: money(input.deposit_amount),
    currency_code: CURRENCY_CODE,
    payment_method: nullable(input.payment_method),
    notes: nullable(input.notes),
    created_by: actor.id ?? null,
    updated_by: actor.id ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("inventory_items")
    .insert(payload)
    .select("*")
    .single();
  fail(error, "创建回收记录失败");
  await insertInventoryEvent(storeId, id, "created", undefined, "intake", { input }, actor, now);

  if (payload.buyback_price > 0) {
    await insertInventoryTransaction(
      storeId,
      id,
      {
        transaction_type: "buyback_payment",
        amount: payload.buyback_price,
        method: input.payment_method,
        note: "回收付款",
      },
      actor,
      now,
    );
  }

  await writeAuditLog({
    actor,
    action: "create",
    entityType: "inventory_item",
    entityId: id,
    after: data as Record<string, unknown>,
  });

  return { id };
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
  actor: AuditActor = systemActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const before = await fetchInventoryRow(id, storeId);
  const now = new Date().toISOString();
  const patch = sanitizeItemPatch(input, actor, now);
  const { data, error } = await supabase
    .from("inventory_items")
    .update(patch)
    .eq("store_id", storeId)
    .eq("id", id)
    .select("*")
    .single();
  fail(error, "更新库存商品失败");

  await insertInventoryEvent(
    storeId,
    id,
    "updated",
    before.status as InventoryItemStatus,
    undefined,
    { input },
    actor,
    now,
  );
  await writeAuditLog({
    actor,
    action: "update",
    entityType: "inventory_item",
    entityId: id,
    before,
    after: data as Record<string, unknown>,
  });
  return { ok: true };
}

export async function transitionInventoryItem(
  id: string,
  to: InventoryItemStatus,
  opts: { reason?: string } = {},
  actor: AuditActor = systemActor,
): Promise<{ ok: boolean; from: InventoryItemStatus; to: InventoryItemStatus }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const before = await fetchInventoryRow(id, storeId);
  const from = before.status as InventoryItemStatus;
  validateInventoryTransition(from, to);

  if (from === to) return { ok: true, from, to };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      status: to,
      ...timestampPatchForStatus(to, now),
      updated_by: actor.id ?? null,
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", id)
    .select("*")
    .single();
  fail(error, "推进库存状态失败");

  await insertInventoryEvent(
    storeId,
    id,
    "status_changed",
    from,
    to,
    { reason: opts.reason },
    actor,
    now,
  );
  await writeAuditLog({
    actor,
    action: "transition",
    entityType: "inventory_item",
    entityId: id,
    before,
    after: data as Record<string, unknown>,
    metadata: { from, to, reason: opts.reason },
  });

  return { ok: true, from, to };
}

export async function recordInventoryCheck(
  id: string,
  input: InventoryQualityCheckInput,
  actor: AuditActor = systemActor,
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const before = await fetchInventoryRow(id, storeId);
  const now = new Date().toISOString();
  const checkId = crypto.randomUUID();
  const payload = {
    id: checkId,
    store_id: storeId,
    item_id: id,
    ...defaultCheckPayload(input),
    checked_by: actor.id ?? null,
    checked_at: now,
    created_at: now,
  };

  const { error } = await supabase.from("inventory_quality_checks").insert(payload);
  fail(error, "记录检测失败");

  const itemPatch = {
    battery_health: input.battery_health ?? before.battery_health ?? null,
    cosmetic_grade: input.cosmetic_grade ?? before.cosmetic_grade ?? "unknown",
    functional_grade: input.functional_grade ?? before.functional_grade ?? "untested",
    imei_check_status: input.imei_check_status ?? before.imei_check_status ?? "unchecked",
    activation_lock_status:
      input.activation_lock_status ?? before.activation_lock_status ?? "unchecked",
    data_wipe_status: input.data_wipe_status ?? before.data_wipe_status ?? "unchecked",
    updated_by: actor.id ?? null,
    updated_at: now,
  };
  const { data: after, error: updateError } = await supabase
    .from("inventory_items")
    .update(itemPatch)
    .eq("store_id", storeId)
    .eq("id", id)
    .select("*")
    .single();
  fail(updateError, "同步检测结果到商品失败");

  await insertInventoryEvent(
    storeId,
    id,
    "quality_checked",
    before.status as InventoryItemStatus,
    undefined,
    asRecord(input),
    actor,
    now,
  );
  await writeAuditLog({
    actor,
    action: "quality_check",
    entityType: "inventory_item",
    entityId: id,
    before,
    after: after as Record<string, unknown>,
    metadata: { check_id: checkId },
  });
  return { id: checkId };
}

export async function recordInventoryTransaction(
  id: string,
  input: InventoryTransactionInput,
  actor: AuditActor = systemActor,
): Promise<{ id: string }> {
  const storeId = requireStoreIdFromActor(actor);
  const row = await fetchInventoryRow(id, storeId);
  const now = new Date().toISOString();
  const transactionId = await insertInventoryTransaction(storeId, id, input, actor, now);
  await insertInventoryEvent(
    storeId,
    id,
    "transaction",
    row.status as InventoryItemStatus,
    undefined,
    { transaction_id: transactionId, ...input },
    actor,
    now,
  );
  await writeAuditLog({
    actor,
    action: "payment",
    entityType: "inventory_item",
    entityId: id,
    before: row,
    metadata: { transaction_id: transactionId, ...input },
  });
  return { id: transactionId };
}

export async function sellInventoryItem(
  id: string,
  input: SellInventoryItemInput,
  actor: AuditActor = systemActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const before = await fetchInventoryRow(id, storeId);
  validateInventoryTransition(before.status as InventoryItemStatus, "sold");
  const now = new Date().toISOString();
  const soldAt = input.sold_at || now;
  const buyerId = await resolveCustomer(
    storeId,
    input.buyer_customer_id,
    input.buyer_name,
    input.buyer_phone,
    now,
  );
  const previousWarrantyMonths = money(before.warranty_months) || 12;
  const warrantyMonths = input.warranty_months ?? previousWarrantyMonths;
  const patch = {
    status: "sold",
    buyer_customer_id: buyerId,
    sale_price: money(input.sale_price),
    deposit_amount:
      input.deposit_amount === undefined
        ? money(before.deposit_amount)
        : money(input.deposit_amount),
    payment_method: nullable(input.payment_method) ?? before.payment_method ?? null,
    sale_channel: nullable(input.sale_channel) ?? before.sale_channel ?? "store",
    warranty_months: warrantyMonths,
    warranty_until: addMonthsIso(soldAt, warrantyMonths),
    sold_at: soldAt,
    notes: nullable(input.notes) ?? before.notes ?? null,
    updated_by: actor.id ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("inventory_items")
    .update(patch)
    .eq("store_id", storeId)
    .eq("id", id)
    .select("*")
    .single();
  fail(error, "登记售出失败");

  await insertInventoryTransaction(
    storeId,
    id,
    {
      transaction_type: "sale_payment",
      amount: patch.sale_price,
      method: typeof patch.payment_method === "string" ? patch.payment_method : undefined,
      note: "售出收款",
    },
    actor,
    soldAt,
  );
  await insertInventoryEvent(
    storeId,
    id,
    "sold",
    before.status as InventoryItemStatus,
    "sold",
    asRecord(input),
    actor,
    soldAt,
  );
  await writeAuditLog({
    actor,
    action: "sale",
    entityType: "inventory_item",
    entityId: id,
    before,
    after: data as Record<string, unknown>,
  });
  return { ok: true };
}

export function importElectronicsCsvPreview(csvContent: string): ElectronicsImportPreview {
  return buildSeaTableElectronicsImport(csvContent);
}

export async function applyElectronicsCsvImport(
  csvContent: string,
  actor: AuditActor = systemActor,
): Promise<ElectronicsImportPreview["report"]> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const preview = buildSeaTableElectronicsImport(csvContent);
  const customerIdMap = new Map<string, string>();

  for (const customer of preview.customers) {
    const phoneRaw = requiredString(customer.phone_raw);
    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .eq("phone_raw", phoneRaw)
      .maybeSingle();
    fail(existingError, "查找导入客户失败");

    if (existing) {
      customerIdMap.set(
        requiredString((existing as DbRecord).id),
        requiredString((existing as DbRecord).id),
      );
      customerIdMap.set(requiredString(customer.id), requiredString((existing as DbRecord).id));
      continue;
    }

    const { error } = await supabase.from("customers").insert({ ...customer, store_id: storeId });
    fail(error, "导入客户失败");
    customerIdMap.set(requiredString(customer.id), requiredString(customer.id));
  }

  const items = preview.items.map((item) => ({
    ...item,
    store_id: storeId,
    customer_id: customerIdMap.get(requiredString(item.customer_id)) ?? item.customer_id,
  }));

  if (items.length) {
    const { error } = await supabase.from("inventory_items").insert(items);
    fail(error, "导入电子产品库存失败");
  }
  if (preview.transactions.length) {
    const { error } = await supabase
      .from("inventory_transactions")
      .insert(preview.transactions.map((transaction) => ({ ...transaction, store_id: storeId })));
    fail(error, "导入电子产品流水失败");
  }
  if (preview.events.length) {
    const { error } = await supabase
      .from("inventory_events")
      .insert(preview.events.map((event) => ({ ...event, store_id: storeId })));
    fail(error, "导入电子产品时间线失败");
  }

  await writeAuditLog({
    actor,
    action: "import",
    entityType: "inventory_item",
    entityId: "seatable:电子产品",
    after: { report: preview.report },
    metadata: { source: "seatable:电子产品" },
  });

  return preview.report;
}

function inventoryFromRow(row: DbRecord): InventoryItem {
  return {
    id: requiredString(row.id),
    public_no: requiredString(row.public_no),
    status: row.status as InventoryItemStatus,
    source_type: requiredString(row.source_type) || "buyback",
    source_ref: maybeString(row.source_ref),
    legacy_source: maybeString(row.legacy_source),
    customer_id: maybeString(row.customer_id),
    buyer_customer_id: maybeString(row.buyer_customer_id),
    category: requiredString(row.category),
    brand: requiredString(row.brand),
    model: requiredString(row.model),
    color: maybeString(row.color),
    storage_capacity: maybeString(row.storage_capacity),
    serial_or_imei: maybeString(row.serial_or_imei),
    imei_check_status: row.imei_check_status as InventoryItem["imei_check_status"],
    activation_lock_status: row.activation_lock_status as InventoryItem["activation_lock_status"],
    data_wipe_status: row.data_wipe_status as InventoryItem["data_wipe_status"],
    cosmetic_grade: row.cosmetic_grade as InventoryItem["cosmetic_grade"],
    functional_grade: row.functional_grade as InventoryItem["functional_grade"],
    battery_health: row.battery_health === null ? undefined : money(row.battery_health),
    buyback_price: money(row.buyback_price),
    list_price: money(row.list_price),
    sale_price: money(row.sale_price),
    deposit_amount: money(row.deposit_amount),
    repair_cost_amount: money(row.repair_cost_amount),
    fees_amount: money(row.fees_amount),
    currency_code: CURRENCY_CODE,
    payment_method: maybeString(row.payment_method),
    sale_channel: maybeString(row.sale_channel),
    warranty_months: Number(row.warranty_months ?? 12),
    warranty_until: maybeString(row.warranty_until),
    purchased_at: maybeString(row.purchased_at),
    listed_at: maybeString(row.listed_at),
    sold_at: maybeString(row.sold_at),
    returned_at: maybeString(row.returned_at),
    recycled_at: maybeString(row.recycled_at),
    cancelled_at: maybeString(row.cancelled_at),
    notes: maybeString(row.notes),
    legacy_payload:
      row.legacy_payload && typeof row.legacy_payload === "object"
        ? (row.legacy_payload as Record<string, unknown>)
        : {},
    created_by: maybeString(row.created_by),
    updated_by: maybeString(row.updated_by),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function decorateInventoryRow(
  row: DbRecord,
  transactions: Pick<InventoryTransaction, "transaction_type" | "amount">[] = [],
): InventoryListItem {
  const item = inventoryFromRow(row);
  const customer = customerFromRow(row.customer);
  const buyer = customerFromRow(row.buyer);
  const itemLabel = `${item.brand} ${item.model}`.trim() || item.public_no;
  return {
    ...item,
    customer_name: customer?.name,
    customer_phone: customer?.phone_e164,
    buyer_name: buyer?.name,
    buyer_phone: buyer?.phone_e164,
    item_label: itemLabel,
    profit: getInventoryProfit(item, transactions),
  };
}

function checkFromRow(row: DbRecord): InventoryQualityCheck {
  return {
    id: requiredString(row.id),
    item_id: requiredString(row.item_id),
    screen_status: row.screen_status as InventoryQualityCheck["screen_status"],
    touch_status: row.touch_status as InventoryQualityCheck["touch_status"],
    camera_status: row.camera_status as InventoryQualityCheck["camera_status"],
    buttons_status: row.buttons_status as InventoryQualityCheck["buttons_status"],
    ports_status: row.ports_status as InventoryQualityCheck["ports_status"],
    speaker_status: row.speaker_status as InventoryQualityCheck["speaker_status"],
    microphone_status: row.microphone_status as InventoryQualityCheck["microphone_status"],
    wifi_status: row.wifi_status as InventoryQualityCheck["wifi_status"],
    bluetooth_status: row.bluetooth_status as InventoryQualityCheck["bluetooth_status"],
    cellular_status: row.cellular_status as InventoryQualityCheck["cellular_status"],
    battery_health: row.battery_health === null ? undefined : money(row.battery_health),
    cosmetic_grade: row.cosmetic_grade as InventoryQualityCheck["cosmetic_grade"],
    functional_grade: row.functional_grade as InventoryQualityCheck["functional_grade"],
    imei_check_status: row.imei_check_status as InventoryQualityCheck["imei_check_status"],
    activation_lock_status:
      row.activation_lock_status as InventoryQualityCheck["activation_lock_status"],
    data_wipe_status: row.data_wipe_status as InventoryQualityCheck["data_wipe_status"],
    notes: maybeString(row.notes),
    checked_by: maybeString(row.checked_by),
    checked_at: requiredString(row.checked_at),
    created_at: requiredString(row.created_at),
  };
}

function transactionFromRow(row: DbRecord): InventoryTransaction {
  return {
    id: requiredString(row.id),
    item_id: requiredString(row.item_id),
    transaction_type: row.transaction_type as InventoryTransaction["transaction_type"],
    amount: money(row.amount),
    currency_code: CURRENCY_CODE,
    method: maybeString(row.method),
    note: maybeString(row.note),
    actor_id: maybeString(row.actor_id),
    created_at: requiredString(row.created_at),
  };
}

function eventFromRow(row: DbRecord): InventoryEvent {
  return {
    id: requiredString(row.id),
    item_id: requiredString(row.item_id),
    event_type: requiredString(row.event_type),
    from_status: row.from_status as InventoryEvent["from_status"],
    to_status: row.to_status as InventoryEvent["to_status"],
    payload:
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
    operator_user_id: maybeString(row.operator_user_id),
    operator_name: requiredString(row.operator_name),
    operator_email: maybeString(row.operator_email),
    created_at: requiredString(row.created_at),
  };
}

function inventoryMatchesFilters(item: InventoryListItem, filters: InventoryListFilters) {
  if (
    filters.saleChannel &&
    filters.saleChannel !== "all" &&
    item.sale_channel !== filters.saleChannel
  ) {
    return false;
  }
  const term = filters.search?.trim().toLowerCase();
  if (!term) return true;
  return [
    item.public_no,
    item.item_label,
    item.category,
    item.color,
    item.storage_capacity,
    item.serial_or_imei,
    item.customer_name,
    item.customer_phone,
    item.buyer_name,
    item.buyer_phone,
    item.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

async function fetchInventoryRow(
  id: string,
  actorOrStoreId?: AuditActor | string,
): Promise<DbRecord> {
  const storeId = requireStoreIdFromActor(actorOrStoreId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("store_id", storeId)
    .eq("id", id)
    .single();
  fail(error, "读取库存商品失败");
  return data as DbRecord;
}

async function resolveCustomer(
  storeId: string,
  id?: string,
  name?: string,
  phone?: string,
  now = new Date().toISOString(),
) {
  const supabase = getSupabaseAdmin();
  if (id) {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("store_id", storeId)
      .eq("id", id)
      .maybeSingle();
    fail(error, "查找客户失败");
    if (!data) throw new Error("客户不存在或不属于当前店铺");
    return id;
  }
  const cleanName = clean(name);
  const cleanPhone = clean(phone);
  if (!cleanName && !cleanPhone) return undefined;
  if (!cleanName || !cleanPhone) throw new Error("客户姓名和手机号需要同时填写");

  const phoneBook = normalizePhoneBook(cleanPhone);
  const phoneRaw = phoneBook.primaryRaw;
  if (!phoneRaw) throw new Error("手机号格式不正确");

  const { data: existing, error } = await supabase
    .from("customers")
    .select("id,contact_phones")
    .eq("store_id", storeId)
    .eq("phone_raw", phoneRaw)
    .maybeSingle();
  fail(error, "查找客户失败");
  if (existing) {
    await mergeCustomerContacts(
      storeId,
      requiredString((existing as DbRecord).id),
      stringArray((existing as DbRecord).contact_phones),
      phoneBook.contacts,
    );
    return requiredString((existing as DbRecord).id);
  }

  const customerId = crypto.randomUUID();
  const { error: insertError } = await supabase.from("customers").insert({
    id: customerId,
    store_id: storeId,
    name: cleanName,
    phone_e164: phoneBook.primary,
    phone_raw: phoneRaw,
    contact_phones: phoneBook.contacts,
    consent_marketing: false,
    consent_sms: true,
    preferred_channel: "whatsapp",
    language: "it",
    created_at: now,
    updated_at: now,
  });
  fail(insertError, "创建客户失败");
  return customerId;
}

async function mergeCustomerContacts(
  storeId: string,
  customerId: string,
  existing: string[],
  next: string[],
) {
  const merged = [...existing];
  const seen = new Set(existing.map((value) => value.replace(/\D/g, "")));
  for (const phone of next) {
    const raw = phone.replace(/\D/g, "");
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    merged.push(phone);
  }
  if (merged.length === existing.length) return;
  const { error } = await getSupabaseAdmin()
    .from("customers")
    .update({ contact_phones: merged, updated_at: new Date().toISOString() })
    .eq("store_id", storeId)
    .eq("id", customerId);
  fail(error, "更新客户备用号码失败");
}

async function insertInventoryEvent(
  storeId: string,
  itemId: string,
  eventType: string,
  from: InventoryItemStatus | undefined,
  to: InventoryItemStatus | undefined,
  payload: Record<string, unknown>,
  actor: AuditActor,
  createdAt: string,
) {
  const { error } = await getSupabaseAdmin()
    .from("inventory_events")
    .insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      item_id: itemId,
      event_type: eventType,
      from_status: from ?? null,
      to_status: to ?? null,
      payload,
      operator_user_id: actor.id ?? null,
      operator_name: actor.displayName,
      operator_email: actor.email ?? null,
      created_at: createdAt,
    });
  fail(error, "写入库存时间线失败");
}

async function insertInventoryTransaction(
  storeId: string,
  itemId: string,
  input: InventoryTransactionInput,
  actor: AuditActor,
  createdAt: string,
) {
  const id = crypto.randomUUID();
  const { error } = await getSupabaseAdmin()
    .from("inventory_transactions")
    .insert({
      id,
      store_id: storeId,
      item_id: itemId,
      transaction_type: input.transaction_type,
      amount: money(input.amount),
      currency_code: CURRENCY_CODE,
      method: nullable(input.method),
      note: nullable(input.note),
      actor_id: actor.id ?? null,
      created_at: createdAt,
    });
  fail(error, "写入库存流水失败");
  return id;
}

function sanitizeItemPatch(input: UpdateInventoryItemInput, actor: AuditActor, now: string) {
  const patch: Record<string, unknown> = {
    updated_by: actor.id ?? null,
    updated_at: now,
  };
  const textFields = [
    "category",
    "brand",
    "model",
    "color",
    "storage_capacity",
    "serial_or_imei",
    "payment_method",
    "sale_channel",
    "notes",
  ] as const;
  for (const field of textFields) {
    if (field in input) patch[field] = nullable(input[field]);
  }
  const moneyFields = [
    "buyback_price",
    "list_price",
    "sale_price",
    "deposit_amount",
    "repair_cost_amount",
    "fees_amount",
  ] as const;
  for (const field of moneyFields) {
    if (field in input) patch[field] = money(input[field]);
  }
  if (input.warranty_months !== undefined) patch.warranty_months = input.warranty_months;
  return patch;
}

function defaultCheckPayload(input: InventoryQualityCheckInput) {
  return {
    screen_status: input.screen_status ?? "unchecked",
    touch_status: input.touch_status ?? "unchecked",
    camera_status: input.camera_status ?? "unchecked",
    buttons_status: input.buttons_status ?? "unchecked",
    ports_status: input.ports_status ?? "unchecked",
    speaker_status: input.speaker_status ?? "unchecked",
    microphone_status: input.microphone_status ?? "unchecked",
    wifi_status: input.wifi_status ?? "unchecked",
    bluetooth_status: input.bluetooth_status ?? "unchecked",
    cellular_status: input.cellular_status ?? "unchecked",
    battery_health: input.battery_health ?? null,
    cosmetic_grade: input.cosmetic_grade ?? "unknown",
    functional_grade: input.functional_grade ?? "untested",
    imei_check_status: input.imei_check_status ?? "unchecked",
    activation_lock_status: input.activation_lock_status ?? "unchecked",
    data_wipe_status: input.data_wipe_status ?? "unchecked",
    notes: nullable(input.notes),
  };
}

function timestampPatchForStatus(status: InventoryItemStatus, now: string) {
  if (status === "purchased") return { purchased_at: now };
  if (status === "listed") return { listed_at: now };
  if (status === "sold") return { sold_at: now };
  if (status === "returned") return { returned_at: now };
  if (status === "recycled") return { recycled_at: now };
  if (status === "cancelled") return { cancelled_at: now };
  return {};
}

function addMonthsIso(value: string, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function clean(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function nullable(value?: string) {
  const text = clean(value);
  return text ? text : null;
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}
