import { createHash } from "node:crypto";

import { CURRENCY_CODE } from "@/lib/money";
import type {
  AuditActor,
  BuybackFinalizeInput,
  BuybackFinalizeResult,
  CreateInventoryIntakeInput,
  Customer,
  ElectronicsImportPreview,
  InventoryAttachment,
  InventoryAttachmentAccessResult,
  InventoryAttachmentUploadInput,
  InventoryAttachmentUploadResult,
  InventoryDetail,
  InventoryEvent,
  InventoryItem,
  InventoryItemStatus,
  InventoryListFilters,
  InventoryListItem,
  InventoryListResult,
  InventoryQualityCheck,
  InventoryQualityCheckInput,
  InventoryStats,
  InventorySummary,
  InventoryTransaction,
  InventoryTransactionInput,
  SellInventoryItemInput,
  UpdateInventoryItemInput,
} from "@/lib/repairdesk/types";
import {
  customerFromRow,
  type DbRecord,
  fail,
  failStorageOperation,
  maybeString,
  money,
  requiredString,
  requireStoreIdFromActor,
  stringArray,
} from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";
import { assertPermission, can } from "@/server/permissions";
import { writeAuditLog } from "@/server/audit";
import { buildSeaTableElectronicsImport } from "@/features/inventory/import/seatable-electronics";
import {
  BUYBACK_AGREEMENT_LANGUAGE,
  BUYBACK_AGREEMENT_VERSION,
  BUYBACK_PRIVACY_NOTICE_VERSION,
  hasCurrentBuybackLegalDocuments,
  hashBuybackAgreementSnapshot,
} from "@/features/buyback/model/buyback-agreement";
import { BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES } from "@/features/buyback/model/buyback-evidence-policy";
import { buildInventorySaleReceiptSnapshot } from "@/features/inventory/model/inventory-sale-receipt";
import {
  getInventoryProfit,
  isInventoryPipelineStatus,
  validateInventoryTransition,
} from "@/features/inventory/model/inventory-workflow";
import { normalizePhoneBook } from "@/shared/lib/phone";

const INVENTORY_DIRECT_CREATE_STATUSES = new Set<InventoryItemStatus>([
  "intake",
  "ready_for_sale",
  "listed",
]);

const INVENTORY_SELECT = `
  *,
  customer:customers!inventory_items_customer_id_fkey(*),
  buyer:customers!inventory_items_buyer_customer_id_fkey(*)
`;
const INVENTORY_LIST_PAGE_SIZE = 1000;

const systemActor: AuditActor = {
  displayName: "系统",
  isSystem: true,
};

export async function listInventoryItems(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventoryListItem[]> {
  const items = await listInventoryItemsRaw(filters, actor);
  return items.map((item) => projectInventoryItemForActor(item, actor));
}

async function listInventoryItemsRaw(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventoryListItem[]> {
  const storeId = requireStoreIdFromActor(actor);
  const rows = await fetchInventoryRows(storeId, filters);
  const transactionsByItem = await fetchInventoryTransactionSummaries(
    storeId,
    rows.map((row) => requiredString(row.id)),
  );

  return filterInventoryItems(
    rows.map((row) =>
      decorateInventoryRow(row, transactionsByItem.get(requiredString(row.id)) ?? []),
    ),
    filters,
  );
}

export async function fetchInventoryRows(
  storeId: string,
  filters: InventoryListFilters = {},
): Promise<DbRecord[]> {
  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from("inventory_items").select(INVENTORY_SELECT).eq("store_id", storeId);

    if (filters.statuses?.length) query = query.in("status", filters.statuses);
    if (filters.sourceTypes?.length) query = query.in("source_type", filters.sourceTypes);
    if (filters.categories?.length) query = query.in("category", filters.categories);

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + INVENTORY_LIST_PAGE_SIZE - 1);
    fail(error, "读取回收库存失败");

    const batch = (data ?? []) as DbRecord[];
    rows.push(...batch);
    if (batch.length < INVENTORY_LIST_PAGE_SIZE) break;
    from += INVENTORY_LIST_PAGE_SIZE;
  }

  return rows;
}

export async function listInventoryItemsPage(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventoryListResult> {
  const items = await listInventoryItems(filters, actor);
  return { items, total: items.length };
}

export async function getInventoryStats(actor?: AuditActor): Promise<InventoryStats> {
  const items = await listInventoryItemsRaw({}, actor);
  return buildInventoryStats(items, actor);
}

export async function getInventorySummary(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventorySummary> {
  const allItems = await listInventoryItemsRaw({}, actor);
  const items = filterInventoryItems(allItems, filters);
  return {
    list: {
      items: items.map((item) => projectInventoryItemForActor(item, actor)),
      total: items.length,
    },
    stats: buildInventoryStats(allItems, actor),
  };
}

export function buildInventoryStats(
  items: InventoryListItem[],
  actor?: AuditActor,
): InventoryStats {
  const canReadAggregateFinance = can(actor, "finance:aggregate_read");
  const canReadProfit = can(actor, "finance:profit_read");
  const stats: InventoryStats = {
    total: items.length,
    inPipeline: items.filter((item) => isInventoryPipelineStatus(item.status)).length,
    readyOrListed: items.filter(
      (item) => item.status === "ready_for_sale" || item.status === "listed",
    ).length,
    reserved: items.filter((item) => item.status === "reserved").length,
    sold: items.filter((item) => item.status === "sold").length,
    finance_redacted: canReadAggregateFinance && canReadProfit ? undefined : true,
  };
  if (canReadAggregateFinance) {
    stats.listedValue = roundMoney(
      items
        .filter((item) => item.status === "ready_for_sale" || item.status === "listed")
        .reduce((sum, item) => sum + item.list_price, 0),
    );
  }
  if (canReadProfit) {
    stats.buybackCost = roundMoney(items.reduce((sum, item) => sum + item.buyback_price, 0));
    stats.realizedProfit = roundMoney(
      items.filter((item) => item.status === "sold").reduce((sum, item) => sum + item.profit, 0),
    );
  }
  return stats;
}

export function projectInventoryItemForActor(
  item: InventoryListItem,
  actor?: AuditActor,
): InventoryListItem {
  const legacyPayload = can(actor, "buyback:evidence_read")
    ? item.legacy_payload
    : redactBuybackIdentityPayload(item.legacy_payload);
  if (can(actor, "finance:profit_read")) return { ...item, legacy_payload: legacyPayload };
  const {
    buyback_price: _buybackPrice,
    repair_cost_amount: _repairCost,
    fees_amount: _fees,
    profit: _profit,
    ...visible
  } = item;
  const contactVisible = can(actor, "customer:detail")
    ? visible
    : { ...visible, customer_phone: undefined, buyer_phone: undefined };
  return {
    ...contactVisible,
    legacy_payload: redactInventoryFinancePayload(legacyPayload),
    finance_redacted: true,
  } as InventoryListItem;
}

function redactBuybackIdentityPayload(value: Record<string, unknown>) {
  const { buyback_customer: _buybackCustomer, ...visible } = value;
  return visible;
}

function redactInventoryFinancePayload(value: Record<string, unknown>) {
  const sensitiveKey = /(profit|cost|fee|offer|price|amount)/i;
  const redact = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(redact);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([key]) => !sensitiveKey.test(key))
        .map(([key, nested]) => [key, redact(nested)]),
    );
  };
  return redact(value) as Record<string, unknown>;
}

function projectInventoryCustomerForActor(customer: Customer | undefined, actor?: AuditActor) {
  if (!customer || can(actor, "customer:detail")) return customer;
  return {
    ...customer,
    phone_e164: "",
    phone_raw: "",
    contact_phones: [],
    email: undefined,
    notes: undefined,
    marketing_notes: undefined,
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
  const canReadProfit = can(actor, "finance:profit_read");
  const canReadAttachments = can(actor, "attachment:read");

  return {
    item: projectInventoryItemForActor(item, actor),
    customer: projectInventoryCustomerForActor(customerFromRow(row.customer), actor),
    buyer: projectInventoryCustomerForActor(customerFromRow(row.buyer), actor),
    checks: ((checksResult.data ?? []) as DbRecord[]).map(checkFromRow),
    transactions: canReadProfit ? transactions : [],
    events: ((eventsResult.data ?? []) as DbRecord[])
      .map(eventFromRow)
      .map((event) => (canReadProfit ? event : { ...event, payload: {} })),
    attachments:
      attachmentResult.error || !canReadAttachments
        ? []
        : ((attachmentResult.data ?? []) as DbRecord[])
            .map(inventoryAttachmentFromRow)
            .filter(
              (attachment) =>
                can(actor, "buyback:evidence_read") ||
                (attachment.sensitivity !== "restricted" &&
                  !isRestrictedBuybackEvidenceKind(attachment.kind)),
            )
            .map(projectInventoryAttachmentMetadata),
  };
}

export async function createInventoryIntake(
  input: CreateInventoryIntakeInput,
  actor: AuditActor = systemActor,
): Promise<{ id: string }> {
  assertInventoryIntakeDoesNotBypassBuybackFinalize(input);
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const sourceType = clean(input.source_type) || "buyback";
  const initialStatus = getInventoryInitialStatus(input.initial_status, sourceType);
  const customerId = await resolveCustomer(
    storeId,
    input.customer_id,
    input.customer_name,
    input.customer_phone,
    now,
  );
  const id = crypto.randomUUID();
  const legacyPayload = sanitizeBuybackLegacyPayload(input.quote_payload ?? {});
  const buybackQuotePayload = recordOrEmpty(legacyPayload.buyback_quote);
  const payload = {
    id,
    store_id: storeId,
    status: initialStatus,
    source_type: sourceType,
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
    warranty_months:
      input.warranty_months === undefined
        ? 12
        : Math.max(0, Math.trunc(money(input.warranty_months))),
    notes: nullable(input.notes),
    ...timestampPatchForStatus(initialStatus, now),
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
  fail(error, "创建库存商品失败");
  await insertInventoryEvent(
    storeId,
    id,
    "created",
    undefined,
    initialStatus,
    { input: redactInventoryIntakeInput(input) },
    actor,
    now,
  );

  await writeAuditLog({
    actor,
    action: "create",
    entityType: "inventory_item",
    entityId: id,
    after: redactInventoryRowForAudit(data),
  });

  return { id };
}

export function assertInventoryIntakeDoesNotBypassBuybackFinalize(
  input: CreateInventoryIntakeInput,
) {
  const sourceType = clean(input.source_type) || "buyback";
  if (sourceType === "buyback" && money(input.buyback_price) !== 0) {
    throw new Error("回收成本只能由带证件、签名与幂等保护的确认成交操作写入");
  }
}

export function assertInventoryUpdateDoesNotBypassBuybackAgreement(
  input: UpdateInventoryItemInput,
  before: Record<string, unknown>,
) {
  if (maybeString(before.source_type) !== "buyback") return;
  if (Object.prototype.hasOwnProperty.call(input, "buyback_price")) {
    throw new Error("回收成本不能通过通用库存更新修改，请使用专用成交或更正流程");
  }

  const status = maybeString(before.status);
  const agreementLocked =
    Boolean(before.purchased_at) || !["intake", "evaluating", "offer_made"].includes(status ?? "");
  if (!agreementLocked) return;
  const signedFields = [
    "customer_name",
    "customer_phone",
    "brand",
    "model",
    "storage_capacity",
    "serial_or_imei",
    "payment_method",
    "quote_payload",
  ] as const;
  if (signedFields.some((field) => Object.prototype.hasOwnProperty.call(input, field))) {
    throw new Error("已成交回收的签署资料不能通过通用库存更新修改");
  }
}

export function assertInventoryTransitionDoesNotBypassBuybackReversal(
  to: InventoryItemStatus,
  before: Record<string, unknown>,
) {
  if (maybeString(before.source_type) !== "buyback" || to !== "cancelled") return;
  if (Boolean(before.purchased_at) || maybeString(before.status) === "purchased") {
    throw new Error("已成交回收不能通过通用状态流直接取消，请使用专用冲正流程");
  }
}

export function assertInventoryTransitionActor(actor: AuditActor, to: InventoryItemStatus) {
  if (to === "recycled" && !actor.isSystem) {
    assertPermission(actor, "inventory:write_off");
  }
}

export function assertBuybackSaleReadiness(
  before: Record<string, unknown>,
  target: InventoryItemStatus,
) {
  if (maybeString(before.source_type) !== "buyback") return;
  if (!["ready_for_sale", "listed", "reserved", "sold"].includes(target)) return;
  if (maybeString(before.data_wipe_status) !== "pass") {
    throw new Error("设备资料尚未确认清除，不能进入待售或售出流程");
  }
  if (maybeString(before.imei_check_status) !== "pass") {
    throw new Error("IMEI / 序列号核验未通过，不能进入待售或售出流程");
  }
  if (maybeString(before.activation_lock_status) !== "pass") {
    throw new Error("账号锁 / Find My 未确认关闭，不能进入待售或售出流程");
  }
}

export function inventoryMutationCas(before: Record<string, unknown>) {
  const status = maybeString(before.status);
  const updatedAt = maybeString(before.updated_at);
  if (!status || !updatedAt) throw new Error("库存记录缺少并发版本，请刷新后重试");
  return {
    status,
    updatedAt,
  };
}

export function returnedBuybackInspectionReset(
  before: Record<string, unknown>,
  target: InventoryItemStatus,
) {
  if (target !== "returned" || maybeString(before.source_type) !== "buyback") return {};
  return {
    imei_check_status: "unchecked",
    activation_lock_status: "unchecked",
    data_wipe_status: "unchecked",
  } as const;
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
  actor: AuditActor = systemActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const before = await fetchInventoryRow(id, storeId);
  assertInventoryUpdateDoesNotBypassBuybackAgreement(input, before);
  const cas = inventoryMutationCas(before);
  const now = new Date().toISOString();
  const patch = sanitizeItemPatch(input, before, actor, now);
  if (
    Object.prototype.hasOwnProperty.call(input, "customer_name") ||
    Object.prototype.hasOwnProperty.call(input, "customer_phone")
  ) {
    patch.customer_id =
      (await resolveCustomer(
        storeId,
        maybeString(before.customer_id),
        input.customer_name,
        input.customer_phone,
        now,
      )) ?? null;
  }
  const { data, error } = await supabase
    .from("inventory_items")
    .update(patch)
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("status", cas.status)
    .eq("updated_at", cas.updatedAt)
    .select("*")
    .maybeSingle();
  fail(error, "更新库存商品失败");
  if (!data) throw new Error("库存资料已被其他人更新，请刷新后重试");

  await insertInventoryEvent(
    storeId,
    id,
    "updated",
    before.status as InventoryItemStatus,
    undefined,
    summarizeInventoryUpdateInput(input),
    actor,
    now,
  );
  await writeAuditLog({
    actor,
    action: "update",
    entityType: "inventory_item",
    entityId: id,
    before: redactInventoryRowForAudit(before),
    after: redactInventoryRowForAudit(data),
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
  assertInventoryTransitionActor(actor, to);
  const before = await fetchInventoryRow(id, storeId);
  const from = before.status as InventoryItemStatus;
  const cas = inventoryMutationCas(before);
  if (to === "purchased") {
    throw new Error("回收成交必须使用带签名、版本与幂等保护的原子成交操作");
  }
  assertInventoryTransitionDoesNotBypassBuybackReversal(to, before);
  assertBuybackSaleReadiness(before, to);
  validateInventoryTransition(from, to);

  if (from === to) return { ok: true, from, to };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      status: to,
      ...timestampPatchForStatus(to, now),
      ...returnedBuybackInspectionReset(before, to),
      updated_by: actor.id ?? null,
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("status", from)
    .eq("updated_at", cas.updatedAt)
    .select("*")
    .maybeSingle();
  fail(error, "推进库存状态失败");
  if (!data) throw new Error("库存资料已被其他人更新，请刷新后重试");

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
    before: redactInventoryRowForAudit(before),
    after: redactInventoryRowForAudit(data),
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
  const cas = inventoryMutationCas(before);
  if (input.expected_updated_at && input.expected_updated_at !== cas.updatedAt) {
    throw new Error("库存资料已被其他人更新，请刷新后重试");
  }
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

  const itemPatch = buildInventoryCheckItemPatch(input, actor, now);
  const { data: after, error: updateError } = await supabase
    .from("inventory_items")
    .update(itemPatch)
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("status", cas.status)
    .eq("updated_at", cas.updatedAt)
    .select("*")
    .maybeSingle();
  if (updateError || !after) {
    const { error: cleanupError } = await supabase
      .from("inventory_quality_checks")
      .delete()
      .eq("store_id", storeId)
      .eq("item_id", id)
      .eq("id", checkId);
    fail(cleanupError, "检测结果冲突且暂存记录清理失败");
    fail(updateError, "同步检测结果到商品失败");
    throw new Error("库存资料已被其他人更新，请刷新后重试");
  }

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
  const kind = normalizeInventoryAttachmentKind(input.kind);
  const operatorName = actor.displayName || actor.email || "system";
  const supabase = getSupabaseAdmin();
  const item = await fetchInventoryRow(id, storeId);
  const isBuybackEvidence = maybeString(item.source_type) === "buyback";
  const isRestricted = isBuybackEvidence || isRestrictedBuybackEvidenceKind(kind);
  assertBuybackEvidenceCaptureActor(actor, kind, maybeString(item.source_type));

  const bytes = attachmentPayloadFromInput(input);
  const attachmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const extension = extensionFromAttachment(input);
  const safeName = isRestricted
    ? `${inventoryAttachmentKindLabel(kind)}.${extension}`
    : sanitizeAttachmentFileName(input.file_name);
  if (isRestricted && !isBuybackEvidence) {
    throw new Error("证件与客户签名只能绑定回收记录");
  }
  if (kind === "signature" && !input.agreement_hash) {
    throw new Error("客户签名必须绑定成交摘要");
  }
  if (isRestricted && input.mime_type === "application/pdf") {
    throw new Error("证件与签名只支持图片格式");
  }
  if (kind === "signature" && !["image/png", "image/jpeg"].includes(input.mime_type)) {
    throw new Error("客户签名只支持 PNG 或 JPEG");
  }
  const storageBucket = isRestricted ? BUYBACK_EVIDENCE_BUCKET : INVENTORY_ATTACHMENT_BUCKET;
  const storagePath = `${storeId}/${id}/${kind}/${attachmentId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, bytes, {
      contentType: input.mime_type,
      upsert: false,
    });
  failStorageOperation(uploadError, "上传库存附件失败", storageBucket);

  const row = {
    id: attachmentId,
    store_id: storeId,
    item_id: id,
    kind,
    file_name: safeName,
    mime_type: input.mime_type,
    file_size: bytes.byteLength,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    note: isRestricted ? null : input.note?.trim() || null,
    uploaded_by: operatorName,
    sensitivity: isRestricted ? "restricted" : "internal",
    evidence_status: isBuybackEvidence ? "staged" : "bound",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    agreement_hash: input.agreement_hash ?? null,
    staging_expires_at: isBuybackEvidence
      ? new Date(Date.now() + BUYBACK_EVIDENCE_STAGING_TTL_MS).toISOString()
      : null,
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
      .from(storageBucket)
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
      ...(isRestricted ? {} : { file_name: safeName }),
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

export function assertBuybackEvidenceCaptureActor(
  actor: AuditActor,
  kind: InventoryAttachment["kind"],
  sourceType?: string,
) {
  if (sourceType === "buyback" || isRestrictedBuybackEvidenceKind(kind)) {
    assertPermission(actor, "buyback:evidence_capture");
  }
}

export async function accessInventoryAttachment(
  id: string,
  attachmentId: string,
  actor: AuditActor = systemActor,
): Promise<InventoryAttachmentAccessResult> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("inventory_attachments")
    .select("*")
    .eq("store_id", storeId)
    .eq("item_id", id)
    .eq("id", attachmentId)
    .single();
  fail(error, "读取库存附件失败");
  const attachment = inventoryAttachmentFromRow(data as DbRecord);
  if (!isInventoryAttachmentStorageScoped(attachment, storeId, id)) {
    throw new Error("附件存储路径与当前店铺不一致");
  }

  const restricted =
    attachment.sensitivity === "restricted" || isRestrictedBuybackEvidenceKind(attachment.kind);
  assertPermission(actor, restricted ? "buyback:evidence_read" : "attachment:read");
  assertInventoryAttachmentAccessState(attachment, restricted);

  const expiresInSeconds = restricted ? 120 : 300;
  const { data: signed, error: signedError } = await supabase.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, expiresInSeconds);
  failStorageOperation(signedError, "生成附件临时查看链接失败", attachment.storage_bucket);
  if (!signed?.signedUrl) throw new Error("生成附件临时查看链接失败");

  await writeAuditLog({
    actor,
    action: "read_attachment",
    entityType: "inventory_attachment",
    entityId: attachment.id,
    metadata: {
      item_id: id,
      kind: attachment.kind,
      restricted,
      expires_in_seconds: expiresInSeconds,
    },
  });

  return {
    attachment_id: attachment.id,
    signed_url: signed.signedUrl,
    expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}

export function assertInventoryAttachmentAccessState(
  attachment: Pick<InventoryAttachment, "evidence_status" | "staging_expires_at">,
  restricted: boolean,
  now = Date.now(),
) {
  if (attachment.evidence_status === "rejected" || attachment.evidence_status === "deleted") {
    throw new Error("该附件已被拒绝或删除，不能继续查看");
  }
  if (
    restricted &&
    attachment.evidence_status !== "staged" &&
    attachment.evidence_status !== "bound"
  ) {
    throw new Error("受限凭证状态无效，不能继续查看");
  }
  if (
    restricted &&
    attachment.evidence_status === "staged" &&
    (!attachment.staging_expires_at || new Date(attachment.staging_expires_at).getTime() <= now)
  ) {
    throw new Error("受限凭证暂存期已过，请重新采集");
  }
}

export async function finalizeBuybackPurchase(
  id: string,
  input: BuybackFinalizeInput,
  actor: AuditActor = systemActor,
): Promise<BuybackFinalizeResult> {
  const storeId = requireStoreIdFromActor(actor);
  if (!actor.id) throw new Error("确认回收成交需要已登录员工身份");

  const calculatedHash = await hashBuybackAgreementSnapshot(input.agreement_snapshot);
  if (calculatedHash !== input.agreement_hash) {
    throw new Error("成交摘要已变化，请让客户重新签名");
  }
  if (!/^[A-Za-z0-9]{1,4}$/.test(input.document_no_last4)) {
    throw new Error("证件号码后四位无效");
  }
  if (
    input.agreement_version !== BUYBACK_AGREEMENT_VERSION ||
    input.privacy_notice_version !== BUYBACK_PRIVACY_NOTICE_VERSION ||
    input.language !== BUYBACK_AGREEMENT_LANGUAGE ||
    input.agreement_snapshot.agreement_version !== BUYBACK_AGREEMENT_VERSION ||
    input.agreement_snapshot.privacy_notice_version !== BUYBACK_PRIVACY_NOTICE_VERSION ||
    input.agreement_snapshot.language !== BUYBACK_AGREEMENT_LANGUAGE
  ) {
    throw new Error("回收协议版本无效，请刷新后重试");
  }
  if (!hasCurrentBuybackLegalDocuments(input.agreement_snapshot)) {
    throw new Error("隐私告知或回收条款内容无效，请刷新后让客户重新确认");
  }
  const snapshotPayment = recordOrEmpty(input.agreement_snapshot.payment);
  const paymentMethod = clean(input.payment_method) || "cash";
  if (paymentMethod !== clean(maybeString(snapshotPayment.method))) {
    throw new Error("成交资料已变化，请让客户重新签名");
  }

  const safePatch = sanitizeBuybackFinalizeItemPatch(input.item_patch, input.agreement_snapshot);
  const { data, error } = await getSupabaseAdmin().rpc("repairdesk_finalize_buyback", {
    p_store_id: storeId,
    p_item_id: id,
    p_actor_id: actor.id,
    p_expected_updated_at: input.expected_updated_at,
    p_idempotency_key: input.idempotency_key,
    p_item_patch: safePatch,
    p_quality_check: input.quality_check,
    p_agreement_snapshot: input.agreement_snapshot,
    p_agreement_hash: input.agreement_hash,
    p_agreement_version: input.agreement_version,
    p_privacy_notice_version: input.privacy_notice_version,
    p_language: input.language,
    p_document_type: input.document_type,
    p_document_no_last4: input.document_no_last4,
    p_signature_attachment_id: input.signature_attachment_id,
    p_evidence_attachment_ids: input.evidence_attachment_ids,
    p_payment_method: paymentMethod,
  });
  fail(error, "确认回收成交失败");
  if (!data || typeof data !== "object") throw new Error("确认回收成交失败：数据库返回无效");

  const result = data as Record<string, unknown>;
  if (result.ok !== true)
    throw new Error(buybackFinalizeFailureMessage(requiredString(result.code)));
  const code = result.code === "idempotent_replay" ? "idempotent_replay" : "finalized";
  return {
    ok: true,
    code,
    item_id: requiredString(result.item_id),
    agreement_id: requiredString(result.agreement_id),
    payment_id: requiredString(result.payment_id),
    updated_at: requiredString(result.updated_at),
  };
}

function sanitizeBuybackFinalizeItemPatch(
  patch: UpdateInventoryItemInput,
  agreementSnapshot: Record<string, unknown>,
) {
  const snapshot = recordOrEmpty(agreementSnapshot);
  const snapshotDevice = recordOrEmpty(snapshot.device);
  const seller = recordOrEmpty(snapshot.seller);
  const snapshotPayment = recordOrEmpty(snapshot.payment);
  const quotePayload = recordOrEmpty(patch.quote_payload);
  const buybackCustomer = recordOrEmpty(quotePayload.buyback_customer);
  const buybackQuote = recordOrEmpty(quotePayload.buyback_quote);
  const buybackDevice = recordOrEmpty(quotePayload.buyback_device);
  const boundDevice = {
    brand: clean(patch.brand),
    model: clean(patch.model),
    storage_capacity: clean(patch.storage_capacity),
    serial_or_imei: clean(patch.serial_or_imei),
  };
  if (
    boundDevice.brand !== clean(maybeString(snapshotDevice.brand)) ||
    boundDevice.model !== clean(maybeString(snapshotDevice.model)) ||
    boundDevice.storage_capacity !== clean(maybeString(snapshotDevice.storage_capacity)) ||
    boundDevice.serial_or_imei !== clean(maybeString(snapshotDevice.serial_or_imei)) ||
    Boolean(buybackDevice.purchase_proof) !== Boolean(snapshotDevice.purchase_proof) ||
    Boolean(buybackDevice.box_included) !== Boolean(snapshotDevice.box_included) ||
    (clean(patch.payment_method) || "cash") !== clean(maybeString(snapshotPayment.method))
  ) {
    throw new Error("成交资料已变化，请让客户重新签名");
  }
  const amount = money(patch.buyback_price ?? buybackQuote.final_offer);
  return {
    category: clean(patch.category) || "phone",
    brand: boundDevice.brand,
    model: boundDevice.model,
    color: clean(patch.color) || undefined,
    storage_capacity: boundDevice.storage_capacity || undefined,
    serial_or_imei: boundDevice.serial_or_imei || undefined,
    buyback_price: amount,
    list_price: money(patch.list_price),
    repair_cost_amount: money(patch.repair_cost_amount),
    payment_method: clean(patch.payment_method) || undefined,
    notes: `回收成交 €${amount.toFixed(2)}；身份与签名资料保存在受限协议记录`,
    quote_payload: {
      ...sanitizeBuybackLegacyPayload(quotePayload),
      buyback_customer: {
        document_type:
          maybeString(seller.document_type) || maybeString(buybackCustomer.document_type),
        document_no_masked: maybeString(seller.document_no_last4)
          ? `••••${maybeString(seller.document_no_last4)}`
          : null,
        signature_status: "signed",
        signature_captured: true,
        id_front_captured: true,
        id_back_captured: maybeString(seller.document_type) === "passport" ? false : true,
        device_photo_captured: true,
      },
    },
  } satisfies UpdateInventoryItemInput;
}

function buybackFinalizeFailureMessage(code: string) {
  const messages: Record<string, string> = {
    actor_forbidden: "当前员工没有确认回收成交的权限",
    invalid_target: "回收记录无效",
    invalid_idempotency_key: "成交操作标识无效",
    missing_expected_version: "缺少回收记录版本时间",
    invalid_payload: "成交资料不完整或格式无效",
    idempotency_conflict: "该成交操作标识已用于不同请求，请刷新后重试",
    item_not_found: "回收记录不存在",
    stale_version: "回收记录已被其他人更新，请刷新后重新确认",
    invalid_state: "当前回收状态不能确认成交",
    hard_blocked: "设备存在高风险，不能直接成交",
    quote_mismatch: "成交金额与客户接受报价不一致",
    inspection_missing: "功能检测未完成",
    inspection_blocked: "IMEI 或账号锁未通过，不能成交",
    evidence_missing: "证件、设备照片或签名凭证不完整",
    evidence_mismatch: "成交凭证与当前回收记录不匹配",
    signature_stale: "成交摘要已变化，请让客户重新签名",
    seller_mismatch: "卖家资料与关联客户不一致，请核对客户后重新签名",
    already_finalized: "该回收记录已完成成交",
  };
  return messages[code] ?? "确认回收成交失败";
}

export async function recordInventoryTransaction(
  id: string,
  input: InventoryTransactionInput,
  actor: AuditActor = systemActor,
): Promise<{ id: string }> {
  assertDirectInventoryTransactionAllowed(input);
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

export function assertDirectInventoryTransactionAllowed(input: InventoryTransactionInput) {
  if (input.transaction_type === "buyback_payment") {
    throw new Error("回收付款只能由带证件、签名与幂等保护的确认成交操作生成");
  }
}

export async function sellInventoryItem(
  id: string,
  input: SellInventoryItemInput,
  actor: AuditActor = systemActor,
): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const before = await fetchInventoryRow(id, storeId);
  const cas = inventoryMutationCas(before);
  assertBuybackSaleReadiness(before, "sold");
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
  const warrantyUntil = addMonthsIso(soldAt, warrantyMonths);
  const saleReceipt = buildInventorySaleReceiptSnapshot({
    publicNo: requiredString(before.public_no),
    soldAt,
    warrantyMonths,
    warrantyUntil,
    terms: input.warranty_terms_snapshot,
  });
  const legacyPayload = recordOrEmpty(before.legacy_payload);
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
    warranty_until: warrantyUntil,
    sold_at: soldAt,
    notes: nullable(input.notes) ?? before.notes ?? null,
    legacy_payload: {
      ...legacyPayload,
      sale_receipt: saleReceipt,
    },
    updated_by: actor.id ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("inventory_items")
    .update(patch)
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("status", cas.status)
    .eq("updated_at", cas.updatedAt)
    .select("*")
    .maybeSingle();
  fail(error, "登记售出失败");
  if (!data) throw new Error("库存资料已被其他人更新，请刷新后重试");

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

export function importElectronicsCsvPreview(
  csvContent: string,
  actor: AuditActor,
): ElectronicsImportPreview {
  assertLegacyElectronicsImportActor(actor);
  return buildSeaTableElectronicsImport(csvContent);
}

export async function applyElectronicsCsvImport(
  csvContent: string,
  actor: AuditActor,
): Promise<ElectronicsImportPreview["report"]> {
  assertLegacyElectronicsImportActor(actor);
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
    after: {
      report: {
        totalRows: preview.report.totalRows,
        importedRows: preview.report.importedRows,
        itemCount: preview.report.itemCount,
        customerCount: preview.report.customerCount,
        transactionCount: preview.report.transactionCount,
        eventCount: preview.report.eventCount,
        totalBuyback: preview.report.totalBuyback,
        totalListPrice: preview.report.totalListPrice,
        totalSalePrice: preview.report.totalSalePrice,
        warningCount: preview.report.warnings.length,
      },
    },
    metadata: { source: "seatable:电子产品" },
  });

  return preview.report;
}

export function assertLegacyElectronicsImportActor(actor: AuditActor) {
  assertPermission(actor, "inventory:legacy_import");
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

export async function fetchInventoryTransactionSummaries(storeId: string, itemIds: string[]) {
  const byItem = new Map<string, Pick<InventoryTransaction, "transaction_type" | "amount">[]>();
  if (itemIds.length === 0) return byItem;

  const supabase = getSupabaseAdmin();
  const rows: DbRecord[] = [];
  const itemIdChunkSize = 100;

  for (let chunkStart = 0; chunkStart < itemIds.length; chunkStart += itemIdChunkSize) {
    const chunk = itemIds.slice(chunkStart, chunkStart + itemIdChunkSize);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("item_id, transaction_type, amount")
        .eq("store_id", storeId)
        .in("item_id", chunk)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + INVENTORY_LIST_PAGE_SIZE - 1);
      fail(error, "读取库存成本流水失败");

      const batch = (data ?? []) as DbRecord[];
      rows.push(...batch);
      if (batch.length < INVENTORY_LIST_PAGE_SIZE) break;
      from += INVENTORY_LIST_PAGE_SIZE;
    }
  }

  for (const row of rows) {
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

function filterInventoryItems(items: InventoryListItem[], filters: InventoryListFilters) {
  return items.filter((item) => inventoryMatchesFilters(item, filters));
}

function inventoryMatchesFilters(item: InventoryListItem, filters: InventoryListFilters) {
  if (filters.statuses?.length && !filters.statuses.includes(item.status)) return false;
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
      .select("id,name,phone_e164,phone_raw")
      .eq("store_id", storeId)
      .eq("id", id)
      .maybeSingle();
    fail(error, "查找客户失败");
    if (!data) throw new Error("客户不存在或不属于当前店铺");
    const existingCustomer = data as DbRecord;
    if (
      clean(name) &&
      normalizeCustomerIdentityName(requiredString(existingCustomer.name)) !==
        normalizeCustomerIdentityName(clean(name))
    ) {
      throw new Error("该客户编号与卖家姓名不一致，请重新选择客户");
    }
    if (clean(phone)) {
      const requestedPhone = normalizePhoneBook(clean(phone)).primaryRaw;
      const existingPhone = normalizePhoneBook(
        maybeString(existingCustomer.phone_e164) || maybeString(existingCustomer.phone_raw) || "",
      ).primaryRaw;
      if (!requestedPhone || requestedPhone !== existingPhone) {
        throw new Error("该客户编号与卖家电话不一致，请重新选择客户");
      }
    }
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
    .select("id,name,contact_phones")
    .eq("store_id", storeId)
    .eq("phone_raw", phoneRaw)
    .maybeSingle();
  fail(error, "查找客户失败");
  if (existing) {
    if (
      normalizeCustomerIdentityName(requiredString((existing as DbRecord).name)) !==
      normalizeCustomerIdentityName(cleanName)
    ) {
      throw new Error("该电话已绑定其他客户，请选择正确客户或先更新客户资料");
    }
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

function normalizeCustomerIdentityName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
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
    patch.legacy_payload = mergeLegacyPayload(
      before.legacy_payload,
      sanitizeBuybackLegacyPayload(input.quote_payload),
    );
  }
  if (input.warranty_months !== undefined) patch.warranty_months = input.warranty_months;
  return patch;
}

const BUYBACK_INTENT_OUTCOMES = new Set(["undecided", "accepted", "rejected", "deferred"]);
const BUYBACK_RISK_LEVELS = new Set(["low", "medium", "high"]);
const BUYBACK_DOCUMENT_TYPES = new Set([
  "id_card",
  "passport",
  "residence_permit",
  "driver_license",
  "other",
]);
const BUYBACK_SIGNATURE_STATUSES = new Set(["pending", "signed"]);
const BUYBACK_INSPECTION_STATUSES = new Set(["pass", "fail", "unchecked", "not_applicable"]);
const BUYBACK_FUNCTION_CHECK_KEYS = [
  "imei_check_status",
  "face_id_status",
  "screen_display_status",
  "touch_status",
  "front_camera_status",
  "back_camera_status",
  "camera_status",
  "flash_status",
  "charging_status",
  "wireless_charging_status",
  "microphone_status",
  "receiver_status",
  "speaker_status",
  "buttons_status",
  "vibration_status",
  "wifi_status",
  "bluetooth_status",
  "cellular_status",
  "gps_status",
  "nfc_status",
  "true_tone_status",
  "water_damage_status",
  "repair_history_status",
  "data_wipe_status",
] as const;

/**
 * Keep the compatibility payload useful for the buyback UI without allowing
 * arbitrary nested data (including seller PII) to reach legacy_payload.
 */
export function sanitizeBuybackLegacyPayload(value: unknown): Record<string, unknown> {
  const source = recordOrEmpty(value);
  const sanitized: Record<string, unknown> = {};

  const quote = sanitizeBuybackQuotePayload(source.buyback_quote);
  if (Object.keys(quote).length) sanitized.buyback_quote = quote;

  const device = sanitizeBuybackDevicePayload(source.buyback_device);
  if (Object.keys(device).length) sanitized.buyback_device = device;

  const repairPlan = recordOrEmpty(source.buyback_repair_plan);
  const estimatedRepairCost = safeLegacyNumber(repairPlan.estimated_repair_cost);
  if (estimatedRepairCost !== undefined) {
    sanitized.buyback_repair_plan = { estimated_repair_cost: estimatedRepairCost };
  }

  const checks = recordOrEmpty(source.buyback_function_checks);
  const safeChecks: Record<string, string> = {};
  for (const key of BUYBACK_FUNCTION_CHECK_KEYS) {
    const status = safeLegacyEnum(checks[key], BUYBACK_INSPECTION_STATUSES);
    if (status) safeChecks[key] = status;
  }
  if (Object.keys(safeChecks).length) sanitized.buyback_function_checks = safeChecks;

  const customer = sanitizeBuybackCustomerPayload(source.buyback_customer);
  if (Object.keys(customer).length) sanitized.buyback_customer = customer;

  const declarations = recordOrEmpty(source.buyback_declarations);
  const safeDeclarations: Record<string, boolean> = {};
  for (const key of [
    "ownership_confirmed",
    "data_wipe_authorized",
    "privacy_notice_accepted",
    "agreement_accepted",
    "no_invoice_confirmed",
    "no_box_confirmed",
  ] as const) {
    if (typeof declarations[key] === "boolean") safeDeclarations[key] = declarations[key];
  }
  if (Object.keys(safeDeclarations).length) sanitized.buyback_declarations = safeDeclarations;

  return sanitized;
}

function sanitizeBuybackQuotePayload(value: unknown) {
  const source = recordOrEmpty(value);
  const sanitized: Record<string, unknown> = {};
  const outcome = safeLegacyEnum(source.intent_outcome, BUYBACK_INTENT_OUTCOMES);
  if (outcome) sanitized.intent_outcome = outcome;
  for (const key of [
    "final_offer",
    "system_offer",
    "suggested_low",
    "suggested_high",
    "market_min",
    "market_max",
    "pricing_floor",
    "pricing_ceiling",
    "estimated_repair_cost",
    "expected_profit",
    "target_profit",
  ] as const) {
    const amount = safeLegacyNumber(source[key]);
    if (amount !== undefined) sanitized[key] = amount;
  }
  const riskLevel = safeLegacyEnum(source.risk_level, BUYBACK_RISK_LEVELS);
  if (riskLevel) sanitized.risk_level = riskLevel;
  if (typeof source.hard_block === "boolean") sanitized.hard_block = source.hard_block;
  const quoteExpiresAt = safeLegacyIsoTimestamp(source.quote_expires_at);
  if (quoteExpiresAt) sanitized.quote_expires_at = quoteExpiresAt;
  return sanitized;
}

function sanitizeBuybackDevicePayload(value: unknown) {
  const source = recordOrEmpty(value);
  const sanitized: Record<string, unknown> = {};
  for (const key of [
    "purchase_region",
    "warranty_status",
    "cosmetic_grade",
    "screen_condition",
    "body_condition",
  ] as const) {
    const label = safeLegacyLabel(source[key]);
    if (label) sanitized[key] = label;
  }
  const batteryHealth = safeLegacyNumber(source.battery_health, 0, 100);
  if (batteryHealth !== undefined) sanitized.battery_health = batteryHealth;
  const cosmeticScore = safeLegacyNumber(source.cosmetic_grade_score, 0, 100);
  if (cosmeticScore !== undefined) sanitized.cosmetic_grade_score = cosmeticScore;
  for (const key of ["box_included", "purchase_proof"] as const) {
    if (typeof source[key] === "boolean") sanitized[key] = source[key];
  }
  return sanitized;
}

function sanitizeBuybackCustomerPayload(value: unknown) {
  const source = recordOrEmpty(value);
  const sanitized: Record<string, unknown> = {};
  const documentType = safeLegacyEnum(source.document_type, BUYBACK_DOCUMENT_TYPES);
  if (documentType) sanitized.document_type = documentType;
  const maskedDocument =
    typeof source.document_no_masked === "string"
      ? source.document_no_masked.trim().toUpperCase()
      : "";
  if (/^••••[A-Z0-9]{1,4}$/.test(maskedDocument)) {
    sanitized.document_no_masked = maskedDocument;
  }
  const signatureStatus = safeLegacyEnum(source.signature_status, BUYBACK_SIGNATURE_STATUSES);
  if (signatureStatus) sanitized.signature_status = signatureStatus;
  for (const key of [
    "signature_captured",
    "id_front_captured",
    "id_back_captured",
    "device_photo_captured",
    "invoice_photo_captured",
    "box_photo_captured",
  ] as const) {
    if (typeof source[key] === "boolean") sanitized[key] = source[key];
  }
  return sanitized;
}

function safeLegacyEnum(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === "string" && allowed.has(value) ? value : undefined;
}

function safeLegacyNumber(value: unknown, minimum = 0, maximum = 10_000_000) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < minimum || value > maximum) return undefined;
  return roundMoney(value);
}

function safeLegacyLabel(value: unknown) {
  if (typeof value !== "string") return undefined;
  const label = clean(value).slice(0, 64);
  const hasControlCharacter = [...label].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!label || hasControlCharacter) return undefined;
  if (/\d{5,}|@|https?:\/\//i.test(label)) return undefined;
  return label;
}

function safeLegacyIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 35) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

function mergeLegacyPayload(
  currentValue: unknown,
  nextValue: Record<string, unknown>,
): Record<string, unknown> {
  const current = recordOrEmpty(currentValue);
  const currentBuyback = sanitizeBuybackLegacyPayload(current);
  const nonBuyback = Object.fromEntries(
    Object.entries(current).filter(([key]) => !key.startsWith("buyback_")),
  );
  return {
    ...nonBuyback,
    ...currentBuyback,
    ...nextValue,
    buyback_quote: {
      ...recordOrEmpty(currentBuyback.buyback_quote),
      ...recordOrEmpty(nextValue.buyback_quote),
    },
    buyback_device: {
      ...recordOrEmpty(currentBuyback.buyback_device),
      ...recordOrEmpty(nextValue.buyback_device),
    },
    buyback_function_checks: {
      ...recordOrEmpty(currentBuyback.buyback_function_checks),
      ...recordOrEmpty(nextValue.buyback_function_checks),
    },
    buyback_customer: {
      ...recordOrEmpty(currentBuyback.buyback_customer),
      ...recordOrEmpty(nextValue.buyback_customer),
    },
    buyback_repair_plan: {
      ...recordOrEmpty(currentBuyback.buyback_repair_plan),
      ...recordOrEmpty(nextValue.buyback_repair_plan),
    },
    buyback_declarations: {
      ...recordOrEmpty(currentBuyback.buyback_declarations),
      ...recordOrEmpty(nextValue.buyback_declarations),
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

export function buildInventoryCheckItemPatch(
  input: InventoryQualityCheckInput,
  actor: AuditActor,
  now: string,
) {
  const patch: Record<string, unknown> = {
    updated_by: actor.id ?? null,
    updated_at: now,
  };
  const itemFields = [
    "battery_health",
    "cosmetic_grade",
    "functional_grade",
    "imei_check_status",
    "activation_lock_status",
    "data_wipe_status",
  ] as const;
  for (const field of itemFields) {
    if (input[field] !== undefined) patch[field] = input[field];
  }
  return patch;
}

const INVENTORY_ATTACHMENT_BUCKET = "repairdesk-inventory-attachments";
const BUYBACK_EVIDENCE_BUCKET = "repairdesk-buyback-evidence";
const INVENTORY_ATTACHMENT_MAX_BYTES = BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES;
const BUYBACK_EVIDENCE_STAGING_TTL_MS = 24 * 60 * 60 * 1000;
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

function isRestrictedBuybackEvidenceKind(kind: InventoryAttachment["kind"]) {
  return (
    kind === "id_front" ||
    kind === "id_back" ||
    kind === "signature" ||
    kind === "invoice_photo" ||
    kind === "box_photo"
  );
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
  if (bytes.byteLength > INVENTORY_ATTACHMENT_MAX_BYTES) throw new Error("附件不能超过 2.4MB");
  if (input.file_size > INVENTORY_ATTACHMENT_MAX_BYTES) throw new Error("附件不能超过 2.4MB");
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
    sensitivity:
      row.sensitivity === "restricted" || row.sensitivity === "internal"
        ? row.sensitivity
        : undefined,
    evidence_status:
      row.evidence_status === "staged" ||
      row.evidence_status === "bound" ||
      row.evidence_status === "rejected" ||
      row.evidence_status === "deleted"
        ? row.evidence_status
        : undefined,
    sha256: maybeString(row.sha256),
    agreement_hash: maybeString(row.agreement_hash),
    agreement_id: maybeString(row.agreement_id),
    staging_expires_at: maybeString(row.staging_expires_at),
    retention_until: maybeString(row.retention_until),
    legal_hold_until: maybeString(row.legal_hold_until),
    bound_at: maybeString(row.bound_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function projectInventoryAttachmentMetadata(attachment: InventoryAttachment): InventoryAttachment {
  const restricted =
    attachment.sensitivity === "restricted" || isRestrictedBuybackEvidenceKind(attachment.kind);
  return {
    ...attachment,
    file_name: restricted ? inventoryAttachmentKindLabel(attachment.kind) : attachment.file_name,
    storage_bucket: "",
    storage_path: "",
    public_url: undefined,
    signed_url: undefined,
    sha256: undefined,
    agreement_hash: undefined,
    note: restricted ? undefined : attachment.note,
  };
}

export function isInventoryAttachmentStorageScoped(
  attachment: Pick<InventoryAttachment, "store_id" | "item_id" | "storage_bucket" | "storage_path">,
  storeId: string,
  itemId: string,
) {
  const bucket = attachment.storage_bucket || INVENTORY_ATTACHMENT_BUCKET;
  return (
    attachment.store_id === storeId &&
    attachment.item_id === itemId &&
    (bucket === INVENTORY_ATTACHMENT_BUCKET || bucket === BUYBACK_EVIDENCE_BUCKET) &&
    attachment.storage_path.startsWith(`${storeId}/${itemId}/`)
  );
}

function redactInventoryIntakeInput(input: CreateInventoryIntakeInput) {
  return {
    customer_id: input.customer_id,
    has_customer_name: Boolean(input.customer_name?.trim()),
    has_customer_phone: Boolean(input.customer_phone?.trim()),
    source_type: input.source_type,
    initial_status: input.initial_status,
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
    warranty_months: input.warranty_months,
  };
}

function summarizeInventoryUpdateInput(input: UpdateInventoryItemInput) {
  const changedFields = Object.keys(input)
    .filter((key) => key !== "quote_payload")
    .sort();
  return {
    changed_fields: changedFields,
    buyback_payload: input.quote_payload
      ? summarizeLegacyPayload(sanitizeBuybackLegacyPayload(input.quote_payload))
      : undefined,
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

function timestampPatchForStatus(
  status: InventoryItemStatus,
  now: string,
): Partial<
  Record<
    "purchased_at" | "listed_at" | "sold_at" | "returned_at" | "recycled_at" | "cancelled_at",
    string
  >
> {
  if (status === "purchased") return { purchased_at: now };
  if (status === "listed") return { listed_at: now };
  if (status === "sold") return { sold_at: now };
  if (status === "returned") return { returned_at: now };
  if (status === "recycled") return { recycled_at: now };
  if (status === "cancelled") return { cancelled_at: now };
  return {};
}

function getInventoryInitialStatus(
  requestedStatus: InventoryItemStatus | undefined,
  sourceType: string,
): InventoryItemStatus {
  if (!requestedStatus) return sourceType === "buyback" ? "intake" : "ready_for_sale";
  if (sourceType === "buyback") return requestedStatus === "intake" ? "intake" : "intake";
  return INVENTORY_DIRECT_CREATE_STATUSES.has(requestedStatus) ? requestedStatus : "ready_for_sale";
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
