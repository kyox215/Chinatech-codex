import { CURRENCY_CODE } from "@/lib/money";
import type {
  AuditActor,
  CreateInventoryIntakeInput,
  Customer,
  ElectronicsImportPreview,
  InventoryAttachment,
  InventoryAttachmentUploadInput,
  InventoryAttachmentUploadResult,
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
  if (filters.sourceTypes?.length) query = query.in("source_type", filters.sourceTypes);
  if (filters.categories?.length) query = query.in("category", filters.categories);

  const { data, error } = await query.limit(1000);
  fail(error, "读取回收库存失败");

  const rows = (data ?? []) as DbRecord[];
  const transactionsByItem = await fetchInventoryTransactionSummaries(
    storeId,
    rows.map((row) => requiredString(row.id)),
  );

  return rows
    .map((row) => decorateInventoryRow(row, transactionsByItem.get(requiredString(row.id)) ?? []))
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
  const [itemResult, checksResult, transactionsResult, eventsResult, attachmentResult] =
    await Promise.all([
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
      supabase
        .from("inventory_attachments")
        .select("*")
        .eq("store_id", storeId)
        .eq("item_id", id)
        .order("created_at", { ascending: false }),
    ]);

  fail(itemResult.error, "读取库存商品失败");
  fail(checksResult.error, "读取检测记录失败");
  fail(transactionsResult.error, "读取库存流水失败");
  fail(eventsResult.error, "读取库存时间线失败");
  if (attachmentResult.error && !isMissingInventoryAttachmentsTableError(attachmentResult.error)) {
    fail(attachmentResult.error, "读取库存附件失败");
  }

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
    attachments: attachmentResult.error
      ? []
      : await attachInventorySignedUrls(supabase, (attachmentResult.data ?? []) as DbRecord[]),
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
  const legacyPayload = input.quote_payload ?? {};
  const buybackQuotePayload = recordOrEmpty(legacyPayload.buyback_quote);
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
    repair_cost_amount: money(input.repair_cost_amount),
    deposit_amount: money(input.deposit_amount),
    currency_code: CURRENCY_CODE,
    payment_method: nullable(input.payment_method),
    notes: nullable(input.notes),
    legacy_payload: {
      ...legacyPayload,
      ...(input.quoted_offer !== undefined || input.quote_expires_at
        ? {
            buyback_quote: {
              ...buybackQuotePayload,
              final_offer: money(input.quoted_offer),
              quote_expires_at: input.quote_expires_at ?? null,
            },
          }
        : {}),
    },
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
  await insertInventoryEvent(
    storeId,
    id,
    "created",
    undefined,
    "intake",
    { input: redactInventoryIntakeInput(input) },
    actor,
    now,
  );

  if (payload.buyback_price > 0 && !hasBuybackQuotePayload(legacyPayload)) {
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
    after: redactInventoryRowForAudit(data),
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
  const patch = sanitizeItemPatch(input, before, actor, now);
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
  if (to === "purchased") {
    await assertBuybackPurchaseEvidence(supabase, storeId, id, before);
  }
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
  if (to === "purchased") {
    await insertBuybackPurchaseTransaction(storeId, id, data as DbRecord, actor, now);
  }
  await writeAuditLog({
    actor,
    action: "transition",
    entityType: "inventory_item",
    entityId: id,
    before: redactInventoryRowForAudit(before),
    after: redactInventoryRowForAudit(data),
    metadata: { from, to, reason: opts.reason },
  });

  return { ok: true, from, to };
}

async function assertBuybackPurchaseEvidence(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  itemId: string,
  row: DbRecord,
) {
  if (maybeString(row.source_type) !== "buyback") return;
  const legacyPayload = recordOrEmpty(row.legacy_payload);
  if (!hasBuybackQuotePayload(legacyPayload)) {
    throw new Error("回收成交必须先保存回收报价资料");
  }

  const quotePayload = recordOrEmpty(legacyPayload.buyback_quote);
  if (maybeString(quotePayload.intent_outcome) !== "accepted") {
    throw new Error("客户未确认接受报价，不能成交入库");
  }
  if (quotePayload.hard_block === true) {
    throw new Error("高风险回收设备不能直接成交入库");
  }
  const acceptedOffer = money(quotePayload.final_offer);
  const currentBuybackPrice = money(row.buyback_price);
  if (acceptedOffer <= 0) {
    throw new Error("客户接受报价金额必须大于 0");
  }
  if (currentBuybackPrice <= 0) {
    throw new Error("回收成交金额必须大于 0");
  }
  if (Math.abs(currentBuybackPrice - acceptedOffer) > 0.01) {
    throw new Error("回收成交金额与客户接受报价不一致");
  }
  if (!maybeString(row.serial_or_imei)) {
    throw new Error("回收成交必须记录 IMEI / 序列号");
  }
  assertInventoryCheckPassed(row.imei_check_status, "IMEI / 序列号");
  assertInventoryCheckPassed(row.activation_lock_status, "账号锁 / Find My");
  assertInventoryCheckPassed(row.data_wipe_status, "数据抹除");
  const latestCheck = await fetchLatestInventoryQualityCheck(supabase, storeId, itemId);
  assertBuybackRequiredChecksCompleted(latestCheck);

  const devicePayload = recordOrEmpty(legacyPayload.buyback_device);
  const requiredKinds = new Set<InventoryAttachment["kind"]>([
    "device_photo",
    "signature",
    "id_front",
    "id_back",
  ]);
  if (devicePayload.purchase_proof !== true) requiredKinds.add("invoice_photo");
  if (devicePayload.box_included !== true) requiredKinds.add("box_photo");

  const { data, error } = await supabase
    .from("inventory_attachments")
    .select("kind")
    .eq("store_id", storeId)
    .eq("item_id", itemId)
    .in("kind", Array.from(requiredKinds));
  if (isMissingInventoryAttachmentsTableError(error)) {
    throw new Error("库存附件表尚未部署，无法保存回收成交凭证");
  }
  fail(error, "读取回收成交凭证失败");

  const existingKinds = new Set((data ?? []).map((item) => maybeString(item.kind)).filter(Boolean));
  const missingKinds = Array.from(requiredKinds).filter((kind) => !existingKinds.has(kind));
  if (missingKinds.length > 0) {
    throw new Error(`缺少成交凭证：${missingKinds.map(inventoryAttachmentKindLabel).join("、")}`);
  }
}

async function fetchLatestInventoryQualityCheck(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  storeId: string,
  itemId: string,
) {
  const { data, error } = await supabase
    .from("inventory_quality_checks")
    .select(
      "screen_status, touch_status, camera_status, buttons_status, ports_status, speaker_status, microphone_status, wifi_status, bluetooth_status, cellular_status",
    )
    .eq("store_id", storeId)
    .eq("item_id", itemId)
    .order("checked_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "读取回收功能检测记录失败");
  if (!data) throw new Error("回收成交前必须完成完整功能检测");
  return data as DbRecord;
}

function assertBuybackRequiredChecksCompleted(check: DbRecord) {
  const requiredChecks = [
    ["screen_status", "屏幕显示"],
    ["touch_status", "触控"],
    ["camera_status", "前后摄像头"],
    ["microphone_status", "麦克风"],
    ["speaker_status", "听筒/扬声器"],
    ["buttons_status", "按键 / 静音键"],
    ["ports_status", "充电口"],
    ["wifi_status", "Wi-Fi"],
    ["bluetooth_status", "蓝牙"],
    ["cellular_status", "蜂窝 / SIM"],
  ] as const;
  for (const [field, label] of requiredChecks) {
    assertInventoryCheckRecorded(check[field], label);
  }
}

function assertInventoryCheckRecorded(value: unknown, label: string) {
  const status = maybeString(value);
  if (status === "pass" || status === "fail") return;
  throw new Error(`${label}未完成检测，不能成交入库`);
}

function assertInventoryCheckPassed(value: unknown, label: string) {
  const status = maybeString(value);
  if (status === "pass") return;
  if (status === "fail") {
    throw new Error(`${label}检测异常，不能成交入库`);
  }
  throw new Error(`${label}尚未检测通过，不能成交入库`);
}

async function insertBuybackPurchaseTransaction(
  storeId: string,
  itemId: string,
  row: DbRecord,
  actor: AuditActor,
  now: string,
) {
  if (maybeString(row.source_type) !== "buyback") return;
  const amount = money(row.buyback_price);
  if (amount <= 0) return;
  const { data, error } = await getSupabaseAdmin()
    .from("inventory_transactions")
    .select("id")
    .eq("store_id", storeId)
    .eq("item_id", itemId)
    .eq("transaction_type", "buyback_payment")
    .limit(1);
  fail(error, "读取回收付款流水失败");
  if ((data ?? []).length > 0) return;

  await insertInventoryTransaction(
    storeId,
    itemId,
    {
      transaction_type: "buyback_payment",
      amount,
      method: maybeString(row.payment_method),
      note: "回收成交付款",
    },
    actor,
    now,
  );
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

export async function uploadInventoryAttachment(
  id: string,
  input: InventoryAttachmentUploadInput,
  actor: AuditActor = systemActor,
): Promise<InventoryAttachmentUploadResult> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = actor.displayName || actor.email || "system";
  const supabase = getSupabaseAdmin();
  await fetchInventoryRow(id, storeId);

  const bytes = attachmentPayloadFromInput(input);
  const attachmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const safeName = sanitizeAttachmentFileName(input.file_name);
  const extension = extensionFromAttachment(input);
  const storagePath = `${storeId}/${id}/${attachmentId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(INVENTORY_ATTACHMENT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: input.mime_type,
      upsert: false,
    });
  fail(uploadError, "上传库存附件失败");

  const row = {
    id: attachmentId,
    store_id: storeId,
    item_id: id,
    kind: normalizeInventoryAttachmentKind(input.kind),
    file_name: safeName,
    mime_type: input.mime_type,
    file_size: bytes.byteLength,
    storage_bucket: INVENTORY_ATTACHMENT_BUCKET,
    storage_path: storagePath,
    note: input.note?.trim() || null,
    uploaded_by: operatorName,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("inventory_attachments")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    await supabase.storage
      .from(INVENTORY_ATTACHMENT_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    fail(error, "保存库存附件失败");
  }

  await insertInventoryEvent(
    storeId,
    id,
    "attachment_uploaded",
    undefined,
    undefined,
    {
      attachment_id: attachmentId,
      kind: row.kind,
      file_name: safeName,
      mime_type: input.mime_type,
      file_size: bytes.byteLength,
    },
    actor,
    now,
  );

  await writeAuditLog({
    actor,
    action: "upload_attachment",
    entityType: "inventory_item",
    entityId: id,
    metadata: {
      attachment_id: attachmentId,
      kind: row.kind,
      mime_type: input.mime_type,
      file_size: bytes.byteLength,
    },
  });

  return { attachment: inventoryAttachmentFromRow(data as DbRecord) };
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

async function fetchInventoryTransactionSummaries(storeId: string, itemIds: string[]) {
  const byItem = new Map<string, Pick<InventoryTransaction, "transaction_type" | "amount">[]>();
  if (itemIds.length === 0) return byItem;

  const { data, error } = await getSupabaseAdmin()
    .from("inventory_transactions")
    .select("item_id, transaction_type, amount")
    .eq("store_id", storeId)
    .in("item_id", itemIds);
  fail(error, "读取库存成本流水失败");

  for (const row of (data ?? []) as DbRecord[]) {
    const itemId = requiredString(row.item_id);
    const transactions = byItem.get(itemId) ?? [];
    transactions.push({
      transaction_type: row.transaction_type as InventoryTransaction["transaction_type"],
      amount: money(row.amount),
    });
    byItem.set(itemId, transactions);
  }
  return byItem;
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
  if (filters.sourceTypes?.length && !filters.sourceTypes.includes(item.source_type)) return false;
  if (filters.categories?.length && !filters.categories.includes(item.category)) return false;
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

function sanitizeItemPatch(
  input: UpdateInventoryItemInput,
  before: DbRecord,
  actor: AuditActor,
  now: string,
) {
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
  if (input.quote_payload !== undefined) {
    patch.legacy_payload = mergeLegacyPayload(before.legacy_payload, input.quote_payload);
  }
  if (input.warranty_months !== undefined) patch.warranty_months = input.warranty_months;
  return patch;
}

function mergeLegacyPayload(
  currentValue: unknown,
  nextValue: Record<string, unknown>,
): Record<string, unknown> {
  const current = recordOrEmpty(currentValue);
  return {
    ...current,
    ...nextValue,
    buyback_quote: {
      ...recordOrEmpty(current.buyback_quote),
      ...recordOrEmpty(nextValue.buyback_quote),
    },
    buyback_device: {
      ...recordOrEmpty(current.buyback_device),
      ...recordOrEmpty(nextValue.buyback_device),
    },
    buyback_function_checks: {
      ...recordOrEmpty(current.buyback_function_checks),
      ...recordOrEmpty(nextValue.buyback_function_checks),
    },
    buyback_customer: {
      ...recordOrEmpty(current.buyback_customer),
      ...recordOrEmpty(nextValue.buyback_customer),
    },
    buyback_repair_plan: {
      ...recordOrEmpty(current.buyback_repair_plan),
      ...recordOrEmpty(nextValue.buyback_repair_plan),
    },
  };
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

const INVENTORY_ATTACHMENT_BUCKET = "repairdesk-inventory-attachments";
const INVENTORY_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const INVENTORY_ATTACHMENT_KINDS = [
  "device_photo",
  "id_front",
  "id_back",
  "signature",
  "invoice_photo",
  "box_photo",
  "other",
] as const;
const INVENTORY_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function isMissingInventoryAttachmentsTableError(error: { message: string } | null | undefined) {
  const message = error?.message;
  if (!message || !/inventory_attachments/i.test(message)) return false;
  return (
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /Could not find/i.test(message)
  );
}

function normalizeInventoryAttachmentKind(kind: string): InventoryAttachment["kind"] {
  return (INVENTORY_ATTACHMENT_KINDS as readonly string[]).includes(kind)
    ? (kind as InventoryAttachment["kind"])
    : "other";
}

function sanitizeAttachmentFileName(fileName: string) {
  const trimmed = fileName
    .trim()
    .replace(/[^\w.\-()\s]/g, "_")
    .replace(/\s+/g, " ");
  return trimmed.slice(0, 160) || `inventory-attachment-${Date.now()}`;
}

function extensionFromAttachment(
  input: Pick<InventoryAttachmentUploadInput, "file_name" | "mime_type">,
) {
  if (input.mime_type === "image/jpeg") return "jpg";
  if (input.mime_type === "image/png") return "png";
  if (input.mime_type === "image/webp") return "webp";
  if (input.mime_type === "image/heic") return "heic";
  if (input.mime_type === "image/heif") return "heif";
  if (input.mime_type === "application/pdf") return "pdf";
  return "bin";
}

function attachmentPayloadFromInput(input: InventoryAttachmentUploadInput) {
  if (!INVENTORY_ATTACHMENT_MIME_TYPES.has(input.mime_type)) {
    throw new Error("仅支持 JPG、PNG、WebP、HEIC 或 PDF 附件");
  }
  const bytes = Buffer.from(input.data_base64, "base64");
  if (bytes.byteLength === 0) throw new Error("附件内容为空");
  if (bytes.byteLength > INVENTORY_ATTACHMENT_MAX_BYTES) throw new Error("附件不能超过 8MB");
  if (input.file_size > INVENTORY_ATTACHMENT_MAX_BYTES) throw new Error("附件不能超过 8MB");
  if (input.file_size !== bytes.byteLength) throw new Error("附件大小与实际内容不一致");
  assertAttachmentMagicBytes(bytes, input.mime_type);
  return bytes;
}

function assertAttachmentMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return;
  }
  if (
    mimeType === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return;
  }
  if (mimeType === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF") {
    if (bytes.subarray(8, 12).toString("ascii") === "WEBP") return;
  }
  if (mimeType === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return;
  }
  if (
    (mimeType === "image/heic" || mimeType === "image/heif") &&
    bytes.byteLength >= 12 &&
    bytes.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    return;
  }
  throw new Error("附件内容与文件类型不匹配");
}

function inventoryAttachmentFromRow(row: DbRecord): InventoryAttachment {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    item_id: requiredString(row.item_id),
    kind: normalizeInventoryAttachmentKind(maybeString(row.kind) || "other"),
    file_name: requiredString(row.file_name),
    mime_type: requiredString(row.mime_type),
    file_size: Number(row.file_size ?? 0),
    storage_bucket: requiredString(row.storage_bucket),
    storage_path: requiredString(row.storage_path),
    public_url: maybeString(row.public_url),
    signed_url: maybeString(row.signed_url),
    note: maybeString(row.note),
    uploaded_by: maybeString(row.uploaded_by),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

async function attachInventorySignedUrls(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: DbRecord[] | null | undefined,
): Promise<InventoryAttachment[]> {
  const attachments = (rows ?? []).map(inventoryAttachmentFromRow);
  return Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.public_url || !attachment.storage_path) return attachment;
      const { data, error } = await supabase.storage
        .from(attachment.storage_bucket || INVENTORY_ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, 60 * 60);
      if (error || !data?.signedUrl) return attachment;
      return { ...attachment, signed_url: data.signedUrl };
    }),
  );
}

function redactInventoryIntakeInput(input: CreateInventoryIntakeInput) {
  return {
    customer_id: input.customer_id,
    has_customer_name: Boolean(input.customer_name?.trim()),
    has_customer_phone: Boolean(input.customer_phone?.trim()),
    category: input.category,
    brand: input.brand,
    model: input.model,
    storage_capacity: input.storage_capacity,
    serial_or_imei: input.serial_or_imei ? maskIdentifier(input.serial_or_imei) : undefined,
    quoted_offer: input.quoted_offer,
    quote_expires_at: input.quote_expires_at,
    buyback_price: input.buyback_price,
    list_price: input.list_price,
    repair_cost_amount: input.repair_cost_amount,
    payment_method: input.payment_method,
  };
}

function redactInventoryRowForAudit(row: unknown): Record<string, unknown> {
  const record = recordOrEmpty(row);
  return {
    id: maybeString(record.id),
    public_no: maybeString(record.public_no),
    status: maybeString(record.status),
    source_type: maybeString(record.source_type),
    customer_id: maybeString(record.customer_id),
    category: maybeString(record.category),
    brand: maybeString(record.brand),
    model: maybeString(record.model),
    storage_capacity: maybeString(record.storage_capacity),
    serial_or_imei: maybeString(record.serial_or_imei)
      ? maskIdentifier(requiredString(record.serial_or_imei))
      : undefined,
    buyback_price: money(record.buyback_price),
    list_price: money(record.list_price),
    payment_method: maybeString(record.payment_method),
    has_notes: Boolean(maybeString(record.notes)),
    legacy_payload: summarizeLegacyPayload(record.legacy_payload),
    created_at: maybeString(record.created_at),
    updated_at: maybeString(record.updated_at),
  };
}

function summarizeLegacyPayload(value: unknown) {
  const payload = recordOrEmpty(value);
  const quote = recordOrEmpty(payload.buyback_quote);
  const customer = recordOrEmpty(payload.buyback_customer);
  const device = recordOrEmpty(payload.buyback_device);
  return {
    has_buyback_quote: hasBuybackQuotePayload(payload),
    buyback_quote: hasBuybackQuotePayload(payload)
      ? {
          final_offer: money(quote.final_offer),
          risk_level: maybeString(quote.risk_level),
          hard_block: quote.hard_block === true,
          quote_expires_at: maybeString(quote.quote_expires_at),
        }
      : undefined,
    buyback_customer: Object.keys(customer).length
      ? {
          document_type: maybeString(customer.document_type),
          signature_status: maybeString(customer.signature_status),
          signature_captured: customer.signature_captured === true,
          id_front_captured: customer.id_front_captured === true,
          id_back_captured: customer.id_back_captured === true,
          device_photo_captured: customer.device_photo_captured === true,
          invoice_photo_captured: customer.invoice_photo_captured === true,
          box_photo_captured: customer.box_photo_captured === true,
        }
      : undefined,
    buyback_device: Object.keys(device).length
      ? {
          purchase_proof: device.purchase_proof === true,
          box_included: device.box_included === true,
        }
      : undefined,
  };
}

function hasBuybackQuotePayload(payload: Record<string, unknown>) {
  return Object.keys(recordOrEmpty(payload.buyback_quote)).length > 0;
}

function inventoryAttachmentKindLabel(kind: InventoryAttachment["kind"]) {
  if (kind === "device_photo") return "设备照片";
  if (kind === "signature") return "客户签名";
  if (kind === "id_front") return "证件正面";
  if (kind === "id_back") return "证件反面";
  if (kind === "invoice_photo") return "发票/无票确认";
  if (kind === "box_photo") return "原装盒/无盒确认";
  return "其他附件";
}

function maskIdentifier(value: string) {
  const text = value.trim();
  if (text.length <= 4) return "*".repeat(text.length);
  return `${text.slice(0, 2)}${"*".repeat(Math.max(2, text.length - 4))}${text.slice(-2)}`;
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

function recordOrEmpty(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
