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
  InventoryQualityCheck,
  InventoryQualityCheckInput,
  InventoryStats,
  InventorySummary,
  InventoryTransaction,
  InventoryTransactionInput,
  SellInventoryItemInput,
  UpdateInventoryItemInput,
} from "@/lib/repairdesk/types";
import { customers as fixtureCustomers } from "@/lib/mock/state";
import { buildSeaTableElectronicsImport } from "@/features/inventory/import/seatable-electronics";
import {
  hasCurrentBuybackLegalDocuments,
  hashBuybackAgreementSnapshot,
} from "@/features/buyback/model/buyback-agreement";
import { assertBuybackSensitiveWorkflowEnabled } from "@/features/buyback/model/buyback-evidence-policy";
import { buildInventorySaleReceiptSnapshot } from "@/features/inventory/model/inventory-sale-receipt";
import { getStoreSettings as getMockStoreSettings } from "@/features/messages/testing/mock-api";
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

const now = new Date();
const day = 24 * 60 * 60 * 1000;

const mockCustomers: Customer[] = [];

const mockInventoryItems: InventoryItem[] = [
  {
    id: "inv_mock_1",
    public_no: "I001201",
    status: "evaluating",
    source_type: "buyback",
    customer_id: "cust_001",
    category: "phone",
    brand: "Apple",
    model: "iPhone 13",
    color: "Midnight",
    storage_capacity: "128GB",
    serial_or_imei: "356000000000001",
    imei_check_status: "unknown",
    activation_lock_status: "unchecked",
    data_wipe_status: "unchecked",
    cosmetic_grade: "good",
    functional_grade: "untested",
    battery_health: 86,
    buyback_price: 260,
    list_price: 369,
    sale_price: 0,
    deposit_amount: 0,
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: CURRENCY_CODE,
    payment_method: "contanti",
    warranty_months: 12,
    legacy_payload: {},
    created_at: new Date(now.getTime() - day).toISOString(),
    updated_at: new Date(now.getTime() - day / 2).toISOString(),
  },
  {
    id: "inv_mock_2",
    public_no: "I001202",
    status: "listed",
    source_type: "buyback",
    customer_id: "cust_002",
    category: "phone",
    brand: "Samsung",
    model: "Galaxy S22",
    color: "Green",
    storage_capacity: "256GB",
    serial_or_imei: "RF8M0000002",
    imei_check_status: "pass",
    activation_lock_status: "pass",
    data_wipe_status: "pass",
    cosmetic_grade: "fair",
    functional_grade: "passed",
    battery_health: 91,
    buyback_price: 210,
    list_price: 329,
    sale_price: 0,
    deposit_amount: 0,
    repair_cost_amount: 18,
    fees_amount: 0,
    currency_code: CURRENCY_CODE,
    payment_method: "carta",
    sale_channel: "store",
    warranty_months: 12,
    purchased_at: new Date(now.getTime() - day * 6).toISOString(),
    listed_at: new Date(now.getTime() - day * 2).toISOString(),
    legacy_payload: {},
    created_at: new Date(now.getTime() - day * 6).toISOString(),
    updated_at: new Date(now.getTime() - day * 2).toISOString(),
  },
  {
    id: "inv_mock_3",
    public_no: "I001203",
    status: "sold",
    source_type: "seatable_electronics",
    customer_id: "cust_003",
    buyer_customer_id: "cust_004",
    category: "tablet",
    brand: "Apple",
    model: "iPad Air 5",
    color: "Blue",
    storage_capacity: "64GB",
    serial_or_imei: "DMP000000003",
    imei_check_status: "pass",
    activation_lock_status: "pass",
    data_wipe_status: "pass",
    cosmetic_grade: "good",
    functional_grade: "passed",
    battery_health: 88,
    buyback_price: 240,
    list_price: 399,
    sale_price: 379,
    deposit_amount: 0,
    repair_cost_amount: 12,
    fees_amount: 5,
    currency_code: CURRENCY_CODE,
    payment_method: "bonifico",
    sale_channel: "store",
    warranty_months: 12,
    warranty_until: new Date(now.getTime() + day * 330).toISOString(),
    purchased_at: new Date(now.getTime() - day * 20).toISOString(),
    listed_at: new Date(now.getTime() - day * 14).toISOString(),
    sold_at: new Date(now.getTime() - day * 35).toISOString(),
    legacy_payload: { source: "mock" },
    created_at: new Date(now.getTime() - day * 20).toISOString(),
    updated_at: new Date(now.getTime() - day * 3).toISOString(),
  },
];

const mockInventoryChecks: InventoryQualityCheck[] = [];
const mockInventoryAttachments: InventoryAttachment[] = [];
const mockBuybackFinalizations = new Map<
  string,
  BuybackFinalizeResult & { agreement_hash: string; expected_updated_at: string }
>();
const mockInventoryTransactions: InventoryTransaction[] = [
  {
    id: "inv_tx_mock_1",
    item_id: "inv_mock_1",
    transaction_type: "buyback_payment",
    amount: 260,
    currency_code: CURRENCY_CODE,
    method: "contanti",
    note: "回收付款",
    created_at: mockInventoryItems[0].created_at,
  },
  {
    id: "inv_tx_mock_3",
    item_id: "inv_mock_3",
    transaction_type: "sale_payment",
    amount: 379,
    currency_code: CURRENCY_CODE,
    method: "bonifico",
    note: "售出收款",
    created_at: mockInventoryItems[2].sold_at ?? mockInventoryItems[2].updated_at,
  },
];
const mockInventoryEvents: InventoryEvent[] = mockInventoryItems.map((item) => ({
  id: `${item.id}_evt_created`,
  item_id: item.id,
  event_type: "created",
  to_status: item.status,
  payload: {},
  operator_name: "系统",
  created_at: item.created_at,
}));

export async function listInventoryItems(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventoryListItem[]> {
  return mockInventoryItems
    .map((item) => decorateInventoryItem(item, actor))
    .filter((item) => matchesFilters(item, filters))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function listInventoryItemsPage(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
) {
  const items = await listInventoryItems(filters, actor);
  return { items, total: items.length };
}

export async function getInventoryStats(actor?: AuditActor): Promise<InventoryStats> {
  const items = await listInventoryItems({}, actor);
  return buildInventoryStats(items);
}

export async function getInventorySummary(
  filters: InventoryListFilters = {},
  actor?: AuditActor,
): Promise<InventorySummary> {
  const allItems = await listInventoryItems({}, actor);
  const items = allItems.filter((item) => matchesFilters(item, filters));
  return {
    list: { items, total: items.length },
    stats: buildInventoryStats(allItems),
  };
}

function buildInventoryStats(items: InventoryListItem[]): InventoryStats {
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
  const item = findItem(id);
  const canReadEvidence = canReadMockBuybackEvidence(actor);
  return {
    item: decorateInventoryItem(item, actor),
    customer: findCustomer(item.customer_id),
    buyer: findCustomer(item.buyer_customer_id),
    checks: mockInventoryChecks.filter((check) => check.item_id === id),
    transactions: mockInventoryTransactions.filter((transaction) => transaction.item_id === id),
    events: mockInventoryEvents.filter((event) => event.item_id === id),
    attachments: mockInventoryAttachments
      .filter(
        (attachment) =>
          attachment.item_id === id && (canReadEvidence || attachment.sensitivity !== "restricted"),
      )
      .map((attachment) => ({
        ...attachment,
        storage_bucket: "",
        storage_path: "",
        signed_url: undefined,
        sha256: undefined,
        agreement_hash: undefined,
      })),
  };
}

export async function createInventoryIntake(
  input: CreateInventoryIntakeInput,
  actor?: AuditActor,
) {
  const sourceType = optional(input.source_type) || "buyback";
  if (sourceType === "buyback" && Number(input.buyback_price ?? 0) !== 0) {
    throw new Error("回收成本只能由带证件、签名与幂等保护的确认成交操作写入");
  }
  const nowIso = new Date().toISOString();
  const initialStatus = getInventoryInitialStatus(input.initial_status, sourceType);
  const customerId = resolveMockCustomer(
    input.customer_id,
    input.customer_name,
    input.customer_phone,
    nowIso,
  );
  const id = crypto.randomUUID();
  const legacyPayload = input.quote_payload ?? {};
  const buybackQuotePayload = recordOrEmpty(legacyPayload.buyback_quote);
  const item: InventoryItem = {
    id,
    public_no: `I${String(1200 + mockInventoryItems.length + 1).padStart(6, "0")}`,
    status: initialStatus,
    source_type: sourceType,
    customer_id: customerId,
    category: input.category?.trim() || "phone",
    brand: input.brand.trim(),
    model: input.model.trim(),
    color: optional(input.color),
    storage_capacity: optional(input.storage_capacity),
    serial_or_imei: optional(input.serial_or_imei),
    imei_check_status: input.serial_or_imei ? "unknown" : "unchecked",
    activation_lock_status: "unchecked",
    data_wipe_status: "unchecked",
    cosmetic_grade: "unknown",
    functional_grade: "untested",
    battery_health: undefined,
    buyback_price: input.buyback_price ?? 0,
    list_price: input.list_price ?? 0,
    sale_price: 0,
    deposit_amount: input.deposit_amount ?? 0,
    repair_cost_amount: input.repair_cost_amount ?? 0,
    fees_amount: 0,
    currency_code: CURRENCY_CODE,
    payment_method: optional(input.payment_method),
    warranty_months:
      input.warranty_months === undefined
        ? (await getMockStoreSettings(actor)).default_inventory_warranty_months
        : Math.max(0, Math.trunc(input.warranty_months)),
    ...timestampPatchForStatus(initialStatus, nowIso),
    notes: optional(input.notes),
    legacy_payload: {
      ...legacyPayload,
      ...(input.quoted_offer !== undefined || input.quote_expires_at
        ? {
            buyback_quote: {
              ...buybackQuotePayload,
              final_offer: input.quoted_offer ?? 0,
              quote_expires_at: input.quote_expires_at ?? null,
            },
          }
        : {}),
    },
    created_at: nowIso,
    updated_at: nowIso,
  };
  mockInventoryItems.unshift(item);
  addEvent(item.id, "created", undefined, initialStatus, { input }, nowIso);
  return { id };
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
  _actor?: AuditActor,
) {
  const item = findItem(id);
  assertMockInventoryUpdateDoesNotBypassBuybackAgreement(item, input);
  const patch = pruneUndefined(input);
  if (
    Object.prototype.hasOwnProperty.call(input, "customer_name") ||
    Object.prototype.hasOwnProperty.call(input, "customer_phone")
  ) {
    patch.customer_id = resolveMockCustomer(
      item.customer_id,
      input.customer_name,
      input.customer_phone,
      new Date().toISOString(),
    );
    delete patch.customer_name;
    delete patch.customer_phone;
  }
  if (input.quote_payload !== undefined) {
    patch.legacy_payload = mergeLegacyPayload(item.legacy_payload, input.quote_payload);
    delete patch.quote_payload;
  }
  Object.assign(item, patch, { updated_at: nextMockUpdatedAt(item.updated_at) });
  addEvent(
    id,
    "updated",
    item.status,
    undefined,
    { changed_fields: Object.keys(input).filter((key) => key !== "quote_payload") },
    item.updated_at,
  );
  return { ok: true };
}

export async function transitionInventoryItem(
  id: string,
  to: InventoryItemStatus,
  opts: { reason?: string } = {},
  _actor?: AuditActor,
) {
  const item = findItem(id);
  const from = item.status;
  if (to === "purchased") {
    throw new Error("回收成交必须使用带签名、版本与幂等保护的原子成交操作");
  }
  if (
    item.source_type === "buyback" &&
    to === "cancelled" &&
    (Boolean(item.purchased_at) || from === "purchased")
  ) {
    throw new Error("已成交回收不能通过通用状态流直接取消，请使用专用冲正流程");
  }
  assertMockBuybackSaleReadiness(item, to);
  validateInventoryTransition(from, to);
  item.status = to;
  item.updated_at = nextMockUpdatedAt(item.updated_at);
  if (to === "listed") item.listed_at = item.updated_at;
  if (to === "sold") item.sold_at = item.updated_at;
  if (to === "returned") {
    item.returned_at = item.updated_at;
    if (item.source_type === "buyback") {
      item.imei_check_status = "unchecked";
      item.activation_lock_status = "unchecked";
      item.data_wipe_status = "unchecked";
    }
  }
  addEvent(id, "status_changed", from, to, { reason: opts.reason }, item.updated_at);
  return { ok: true, from, to };
}

export async function recordInventoryCheck(
  id: string,
  input: InventoryQualityCheckInput,
  _actor?: AuditActor,
) {
  const item = findItem(id);
  if (input.expected_updated_at && input.expected_updated_at !== item.updated_at) {
    throw new Error("库存资料已被其他人更新，请刷新后重试");
  }
  const nowIso = nextMockUpdatedAt(item.updated_at);
  const checkId = crypto.randomUUID();
  const check: InventoryQualityCheck = {
    id: checkId,
    item_id: id,
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
    battery_health: input.battery_health,
    cosmetic_grade: input.cosmetic_grade ?? "unknown",
    functional_grade: input.functional_grade ?? "untested",
    imei_check_status: input.imei_check_status ?? "unchecked",
    activation_lock_status: input.activation_lock_status ?? "unchecked",
    data_wipe_status: input.data_wipe_status ?? "unchecked",
    notes: optional(input.notes),
    checked_at: nowIso,
    created_at: nowIso,
  };
  mockInventoryChecks.unshift(check);
  item.battery_health = input.battery_health ?? item.battery_health;
  item.cosmetic_grade = input.cosmetic_grade ?? item.cosmetic_grade;
  item.functional_grade = input.functional_grade ?? item.functional_grade;
  item.imei_check_status = input.imei_check_status ?? item.imei_check_status;
  item.activation_lock_status = input.activation_lock_status ?? item.activation_lock_status;
  item.data_wipe_status = input.data_wipe_status ?? item.data_wipe_status;
  item.updated_at = nowIso;
  addEvent(id, "quality_checked", item.status, undefined, asRecord(input), nowIso);
  return { id: checkId };
}

export async function uploadInventoryAttachment(
  id: string,
  input: InventoryAttachmentUploadInput,
  actor?: AuditActor,
): Promise<InventoryAttachmentUploadResult> {
  const item = findItem(id);
  const restricted =
    item.source_type === "buyback" ||
    ["id_front", "id_back", "signature", "invoice_photo", "box_photo"].includes(input.kind);
  if (restricted && actor) assertBuybackSensitiveWorkflowEnabled();
  if (
    restricted &&
    actor &&
    !actor.isSystem &&
    !["owner", "manager"].includes(actor.storeRole ?? actor.role ?? "")
  ) {
    throw new Error("当前员工没有权限采集回收证件与签名");
  }
  const nowIso = new Date().toISOString();
  const attachmentId = crypto.randomUUID();
  const attachment: InventoryAttachment = {
    id: attachmentId,
    store_id: "mock-store",
    item_id: id,
    kind: input.kind,
    file_name: restricted ? `${input.kind}.evidence` : input.file_name,
    mime_type: input.mime_type,
    file_size: input.file_size,
    storage_bucket: restricted ? "repairdesk-buyback-evidence" : "mock-inventory-attachments",
    storage_path: `mock-store/${id}/${input.kind}/${attachmentId}`,
    note: restricted ? undefined : optional(input.note),
    uploaded_by: "Mock User",
    sensitivity: restricted ? "restricted" : "internal",
    evidence_status: "staged",
    agreement_hash: input.agreement_hash,
    staging_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: nowIso,
    updated_at: nowIso,
  };
  mockInventoryAttachments.unshift(attachment);
  addEvent(
    id,
    "attachment_uploaded",
    undefined,
    undefined,
    {
      attachment_id: attachmentId,
      kind: input.kind,
      ...(restricted ? {} : { file_name: input.file_name }),
      mime_type: input.mime_type,
      file_size: input.file_size,
    },
    nowIso,
  );
  return { attachment };
}

export async function accessInventoryAttachment(
  id: string,
  attachmentId: string,
  actor?: AuditActor,
): Promise<InventoryAttachmentAccessResult> {
  findItem(id);
  const attachment = mockInventoryAttachments.find(
    (entry) => entry.item_id === id && entry.id === attachmentId,
  );
  if (!attachment) throw new Error("读取库存附件失败");
  const restricted = attachment.sensitivity === "restricted";
  if (
    restricted &&
    actor &&
    !actor.isSystem &&
    !["owner", "manager"].includes(actor.storeRole ?? actor.role ?? "")
  ) {
    throw new Error("当前员工没有权限查看回收证件与签名");
  }
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
    attachment.staging_expires_at &&
    new Date(attachment.staging_expires_at).getTime() <= Date.now()
  ) {
    throw new Error("受限凭证暂存期已过，请重新采集");
  }
  return {
    attachment_id: attachment.id,
    signed_url: `mock://inventory-attachments/${attachment.id}`,
    expires_at: new Date(Date.now() + 120_000).toISOString(),
  };
}

export async function finalizeBuybackPurchase(
  id: string,
  input: BuybackFinalizeInput,
  _actor?: AuditActor,
): Promise<BuybackFinalizeResult> {
  const existing = mockBuybackFinalizations.get(input.idempotency_key);
  if (existing) {
    if (
      existing.item_id !== id ||
      existing.agreement_hash !== input.agreement_hash ||
      existing.expected_updated_at !== input.expected_updated_at
    ) {
      throw new Error("该成交操作标识已用于不同请求，请刷新后重试");
    }
    return { ...existing, code: "idempotent_replay" };
  }

  const item = findItem(id);
  if (item.updated_at !== input.expected_updated_at) {
    throw new Error("回收记录已被其他人更新，请刷新后重新确认");
  }
  if (item.source_type !== "buyback") throw new Error("回收记录无效");
  if (item.status === "purchased") throw new Error("该回收记录已完成成交");
  if (!["intake", "evaluating", "offer_made"].includes(item.status)) {
    throw new Error("当前回收状态不能确认成交");
  }

  const calculatedHash = await hashBuybackAgreementSnapshot(input.agreement_snapshot);
  if (calculatedHash !== input.agreement_hash) {
    throw new Error("成交摘要已变化，请让客户重新签名");
  }
  if (!hasCurrentBuybackLegalDocuments(input.agreement_snapshot)) {
    throw new Error("隐私告知或回收条款内容无效，请刷新后让客户重新确认");
  }
  const quotePayload = recordOrEmpty(input.item_patch.quote_payload);
  const quote = recordOrEmpty(quotePayload.buyback_quote);
  const device = recordOrEmpty(quotePayload.buyback_device);
  const snapshotDevice = recordOrEmpty(input.agreement_snapshot.device);
  const declarations = recordOrEmpty(input.agreement_snapshot.declarations);
  const seller = recordOrEmpty(input.agreement_snapshot.seller);
  const payment = recordOrEmpty(input.agreement_snapshot.payment);
  const amount = Number(input.item_patch.buyback_price ?? 0);
  const sellerCustomer = findCustomer(item.customer_id);
  if (
    !sellerCustomer ||
    normalizeCustomerIdentityName(sellerCustomer.name) !==
      normalizeCustomerIdentityName(String(seller.name ?? "")) ||
    normalizePhoneBook(sellerCustomer.phone_e164 || sellerCustomer.phone_raw).primaryRaw !==
      normalizePhoneBook(String(seller.phone ?? "")).primaryRaw
  ) {
    throw new Error("卖家资料与关联客户不一致，请核对客户后重新签名");
  }
  if (quote.intent_outcome !== "accepted") throw new Error("客户未确认接受报价，不能成交入库");
  if (quote.hard_block === true) throw new Error("设备存在高风险，不能直接成交");
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(Number(quote.final_offer) - amount) > 0.01
  ) {
    throw new Error("成交金额与客户接受报价不一致");
  }
  if (!input.item_patch.serial_or_imei?.trim()) throw new Error("回收成交必须记录 IMEI / 序列号");
  if (
    snapshotDevice.brand !== input.item_patch.brand?.trim() ||
    snapshotDevice.model !== input.item_patch.model?.trim() ||
    snapshotDevice.storage_capacity !== input.item_patch.storage_capacity?.trim() ||
    snapshotDevice.serial_or_imei !== input.item_patch.serial_or_imei.trim() ||
    Boolean(snapshotDevice.purchase_proof) !== Boolean(device.purchase_proof) ||
    Boolean(snapshotDevice.box_included) !== Boolean(device.box_included) ||
    payment.method !== (input.payment_method?.trim() || "cash") ||
    payment.method !== (input.item_patch.payment_method?.trim() || "cash")
  ) {
    throw new Error("成交摘要已变化，请让客户重新签名");
  }
  assertMockCheckPassed(input.quality_check.imei_check_status, "IMEI / 序列号");
  assertMockCheckPassed(input.quality_check.activation_lock_status, "账号锁 / Find My");
  if (input.quality_check.data_wipe_status === "fail") throw new Error("数据清除授权无效");
  assertMockRequiredChecksCompleted({
    id: "pending",
    item_id: id,
    screen_status: input.quality_check.screen_status ?? "unchecked",
    touch_status: input.quality_check.touch_status ?? "unchecked",
    camera_status: input.quality_check.camera_status ?? "unchecked",
    buttons_status: input.quality_check.buttons_status ?? "unchecked",
    ports_status: input.quality_check.ports_status ?? "unchecked",
    speaker_status: input.quality_check.speaker_status ?? "unchecked",
    microphone_status: input.quality_check.microphone_status ?? "unchecked",
    wifi_status: input.quality_check.wifi_status ?? "unchecked",
    bluetooth_status: input.quality_check.bluetooth_status ?? "unchecked",
    cellular_status: input.quality_check.cellular_status ?? "unchecked",
    cosmetic_grade: input.quality_check.cosmetic_grade ?? "unknown",
    functional_grade: input.quality_check.functional_grade ?? "untested",
    imei_check_status: input.quality_check.imei_check_status ?? "unchecked",
    activation_lock_status: input.quality_check.activation_lock_status ?? "unchecked",
    data_wipe_status: input.quality_check.data_wipe_status ?? "unchecked",
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  if (
    declarations.ownership_confirmed !== true ||
    declarations.data_wipe_authorized !== true ||
    declarations.privacy_notice_accepted !== true ||
    declarations.agreement_accepted !== true ||
    (device.purchase_proof !== true && declarations.no_invoice_confirmed !== true) ||
    (device.box_included !== true && declarations.no_box_confirmed !== true)
  ) {
    throw new Error("成交声明未完成");
  }
  if (
    seller.document_type !== input.document_type ||
    seller.document_no_last4 !== (input.document_no_last4 ?? "")
  ) {
    throw new Error("成交摘要已变化，请让客户重新签名");
  }

  const evidence = mockInventoryAttachments.filter(
    (attachment) =>
      attachment.item_id === id &&
      input.evidence_attachment_ids.includes(attachment.id) &&
      attachment.sensitivity === "restricted" &&
      attachment.evidence_status === "staged" &&
      Boolean(
        attachment.staging_expires_at &&
        new Date(attachment.staging_expires_at).getTime() > Date.now(),
      ),
  );
  if (evidence.length !== new Set(input.evidence_attachment_ids).size) {
    throw new Error("证件、设备照片或签名凭证不完整");
  }
  const kinds = new Set(evidence.map((attachment) => attachment.kind));
  const requiredKinds: InventoryAttachment["kind"][] = ["device_photo", "id_front", "signature"];
  if (input.document_type !== "passport") requiredKinds.push("id_back");
  if (requiredKinds.some((kind) => !kinds.has(kind))) {
    throw new Error("证件、设备照片或签名凭证不完整");
  }
  const signature = evidence.find((attachment) => attachment.id === input.signature_attachment_id);
  if (
    !signature ||
    signature.kind !== "signature" ||
    signature.agreement_hash !== input.agreement_hash
  ) {
    throw new Error("成交摘要已变化，请让客户重新签名");
  }

  const nowIso = new Date().toISOString();
  const fromStatus = item.status;
  await recordInventoryCheck(id, input.quality_check);
  const patch = pruneUndefined(input.item_patch);
  if (input.item_patch.quote_payload !== undefined) {
    patch.legacy_payload = mergeLegacyPayload(item.legacy_payload, input.item_patch.quote_payload);
    delete patch.quote_payload;
  }
  Object.assign(item, patch, {
    buyback_price: amount,
    payment_method: input.payment_method ?? "cash",
    status: "purchased",
    purchased_at: nowIso,
    updated_at: nowIso,
  });
  const paymentId = crypto.randomUUID();
  mockInventoryTransactions.unshift({
    id: paymentId,
    item_id: id,
    transaction_type: "buyback_payment",
    amount,
    currency_code: CURRENCY_CODE,
    method: item.payment_method,
    note: "回收成交付款",
    created_at: nowIso,
  });
  const agreementId = crypto.randomUUID();
  for (const attachment of evidence) {
    attachment.evidence_status = "bound";
    attachment.agreement_id = agreementId;
    attachment.bound_at = nowIso;
    attachment.staging_expires_at = undefined;
    attachment.updated_at = nowIso;
  }
  addEvent(
    id,
    "buyback_finalized",
    fromStatus,
    "purchased",
    { agreement_id: agreementId, payment_id: paymentId, amount },
    nowIso,
  );
  const result: BuybackFinalizeResult & {
    agreement_hash: string;
    expected_updated_at: string;
  } = {
    ok: true,
    code: "finalized",
    item_id: id,
    agreement_id: agreementId,
    payment_id: paymentId,
    updated_at: nowIso,
    agreement_hash: input.agreement_hash,
    expected_updated_at: input.expected_updated_at,
  };
  mockBuybackFinalizations.set(input.idempotency_key, result);
  return result;
}

export async function recordInventoryTransaction(
  id: string,
  input: InventoryTransactionInput,
  _actor?: AuditActor,
) {
  if (input.transaction_type === "buyback_payment") {
    throw new Error("回收付款只能由带证件、签名与幂等保护的确认成交操作生成");
  }
  findItem(id);
  const nowIso = new Date().toISOString();
  const txId = crypto.randomUUID();
  mockInventoryTransactions.unshift({
    id: txId,
    item_id: id,
    transaction_type: input.transaction_type,
    amount: input.amount,
    currency_code: CURRENCY_CODE,
    method: optional(input.method),
    note: optional(input.note),
    created_at: nowIso,
  });
  addEvent(id, "transaction", undefined, undefined, { transaction_id: txId, ...input }, nowIso);
  return { id: txId };
}

export async function sellInventoryItem(
  id: string,
  input: SellInventoryItemInput,
  _actor?: AuditActor,
) {
  const item = findItem(id);
  assertMockBuybackSaleReadiness(item, "sold");
  validateInventoryTransition(item.status, "sold");
  const nowIso = input.sold_at ?? new Date().toISOString();
  item.status = "sold";
  item.buyer_customer_id = resolveMockCustomer(
    input.buyer_customer_id,
    input.buyer_name,
    input.buyer_phone,
    nowIso,
  );
  item.sale_price = input.sale_price;
  item.deposit_amount = input.deposit_amount ?? item.deposit_amount;
  item.payment_method = optional(input.payment_method) ?? item.payment_method;
  item.sale_channel = optional(input.sale_channel) ?? "store";
  item.warranty_months = input.warranty_months ?? item.warranty_months;
  item.warranty_until =
    item.warranty_months > 0 ? addMonthsIso(nowIso, item.warranty_months) : undefined;
  item.legacy_payload = {
    ...recordOrEmpty(item.legacy_payload),
    sale_receipt: buildInventorySaleReceiptSnapshot({
      publicNo: item.public_no,
      soldAt: nowIso,
      warrantyMonths: item.warranty_months,
      warrantyUntil: item.warranty_until,
      terms: input.warranty_terms_snapshot,
    }),
  };
  item.sold_at = nowIso;
  item.updated_at = nowIso;
  addEvent(id, "sold", undefined, "sold", asRecord(input), nowIso);
  await recordInventoryTransaction(id, {
    transaction_type: "sale_payment",
    amount: input.sale_price,
    method: input.payment_method,
    note: "售出收款",
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

export async function applyElectronicsCsvImport(csvContent: string, actor: AuditActor) {
  assertLegacyElectronicsImportActor(actor);
  const preview = buildSeaTableElectronicsImport(csvContent);
  return preview.report;
}

function assertLegacyElectronicsImportActor(actor: AuditActor) {
  if ((actor.storeRole ?? actor.role) !== "owner") {
    throw new Error("历史库存与回收流水导入仅限店主执行");
  }
}

function decorateInventoryItem(item: InventoryItem, actor?: AuditActor): InventoryListItem {
  const transactions = mockInventoryTransactions.filter(
    (transaction) => transaction.item_id === item.id,
  );
  const customer = findCustomer(item.customer_id);
  const buyer = findCustomer(item.buyer_customer_id);
  const legacyPayload = recordOrEmpty(item.legacy_payload);
  const visibleLegacyPayload = canReadMockBuybackEvidence(actor)
    ? legacyPayload
    : Object.fromEntries(
        Object.entries(legacyPayload).filter(([key]) => key !== "buyback_customer"),
      );
  return {
    ...item,
    legacy_payload: visibleLegacyPayload,
    customer_name: customer?.name,
    customer_phone: customer?.phone_e164,
    buyer_name: buyer?.name,
    buyer_phone: buyer?.phone_e164,
    item_label: `${item.brand} ${item.model}`.trim() || item.public_no,
    profit: getInventoryProfit(item, transactions),
  };
}

function canReadMockBuybackEvidence(actor?: AuditActor) {
  if (!actor || actor.isSystem) return true;
  return ["owner", "manager"].includes(actor.storeRole ?? actor.role ?? "");
}

function matchesFilters(item: InventoryListItem, filters: InventoryListFilters) {
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

function findItem(id: string) {
  const item = mockInventoryItems.find((candidate) => candidate.id === id);
  if (!item) throw new Error("库存商品不存在");
  return item;
}

function findCustomer(id?: string) {
  if (!id) return undefined;
  return (
    mockCustomers.find((customer) => customer.id === id) ??
    fixtureCustomers.find((customer) => customer.id === id)
  );
}

function assertMockInventoryUpdateDoesNotBypassBuybackAgreement(
  item: InventoryItem,
  input: UpdateInventoryItemInput,
) {
  if (item.source_type !== "buyback") return;
  if (Object.prototype.hasOwnProperty.call(input, "buyback_price")) {
    throw new Error("回收成本不能通过通用库存更新修改，请使用专用成交或更正流程");
  }
  const agreementLocked =
    Boolean(item.purchased_at) || !["intake", "evaluating", "offer_made"].includes(item.status);
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

function assertMockBuybackSaleReadiness(item: InventoryItem, target: InventoryItemStatus) {
  if (item.source_type !== "buyback") return;
  if (!["ready_for_sale", "listed", "reserved", "sold"].includes(target)) return;
  if (item.data_wipe_status !== "pass") {
    throw new Error("设备资料尚未确认清除，不能进入待售或售出流程");
  }
  if (item.imei_check_status !== "pass") {
    throw new Error("IMEI / 序列号核验未通过，不能进入待售或售出流程");
  }
  if (item.activation_lock_status !== "pass") {
    throw new Error("账号锁 / Find My 未确认关闭，不能进入待售或售出流程");
  }
}

function resolveMockCustomer(
  id?: string,
  name?: string,
  phone?: string,
  nowIso = new Date().toISOString(),
) {
  if (id) {
    const existing = findCustomer(id);
    if (!existing) throw new Error("客户不存在或不属于当前店铺");
    if (
      optional(name) &&
      normalizeCustomerIdentityName(existing.name) !== normalizeCustomerIdentityName(name ?? "")
    ) {
      throw new Error("该客户编号与卖家姓名不一致，请重新选择客户");
    }
    if (optional(phone)) {
      const requestedPhone = normalizePhoneBook(phone ?? "").primaryRaw;
      const existingPhone = normalizePhoneBook(
        existing.phone_e164 || existing.phone_raw,
      ).primaryRaw;
      if (!requestedPhone || requestedPhone !== existingPhone) {
        throw new Error("该客户编号与卖家电话不一致，请重新选择客户");
      }
    }
    return id;
  }
  if (!name && !phone) return undefined;
  if (!name || !phone) throw new Error("客户姓名和手机号需要同时填写");
  const book = normalizePhoneBook(phone);
  const existing = [...mockCustomers, ...fixtureCustomers].find(
    (customer) => customer.phone_raw === book.primaryRaw,
  );
  if (existing) {
    if (normalizeCustomerIdentityName(existing.name) !== normalizeCustomerIdentityName(name)) {
      throw new Error("该电话已绑定其他客户，请选择正确客户或先更新客户资料");
    }
    return existing.id;
  }
  const customer: Customer = {
    id: crypto.randomUUID(),
    name,
    phone_e164: book.primary,
    phone_raw: book.primaryRaw,
    contact_phones: book.contacts,
    consent_marketing: false,
    consent_sms: true,
    preferred_channel: "whatsapp",
    language: "it",
    created_at: nowIso,
    updated_at: nowIso,
  } as Customer;
  mockCustomers.push(customer);
  return customer.id;
}

function normalizeCustomerIdentityName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

function addEvent(
  itemId: string,
  eventType: string,
  from: InventoryItemStatus | undefined,
  to: InventoryItemStatus | undefined,
  payload: Record<string, unknown>,
  createdAt: string,
) {
  mockInventoryEvents.unshift({
    id: crypto.randomUUID(),
    item_id: itemId,
    event_type: eventType,
    from_status: from,
    to_status: to,
    payload,
    operator_name: "前台",
    created_at: createdAt,
  });
}

function nextMockUpdatedAt(previous: string) {
  const previousTime = Date.parse(previous);
  const nextTime = Number.isFinite(previousTime)
    ? Math.max(Date.now(), previousTime + 1)
    : Date.now();
  return new Date(nextTime).toISOString();
}

function optional(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function pruneUndefined(value: object) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function addMonthsIso(value: string, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function timestampPatchForStatus(
  status: InventoryItemStatus,
  nowIso: string,
): Partial<
  Record<"listed_at" | "sold_at" | "returned_at" | "recycled_at" | "cancelled_at", string>
> {
  if (status === "listed") return { listed_at: nowIso };
  if (status === "sold") return { sold_at: nowIso };
  if (status === "returned") return { returned_at: nowIso };
  if (status === "recycled") return { recycled_at: nowIso };
  if (status === "cancelled") return { cancelled_at: nowIso };
  return {};
}

function getInventoryInitialStatus(
  requestedStatus: InventoryItemStatus | undefined,
  sourceType: string,
): InventoryItemStatus {
  if (!requestedStatus) return sourceType === "buyback" ? "intake" : "ready_for_sale";
  if (sourceType === "buyback") return "intake";
  return INVENTORY_DIRECT_CREATE_STATUSES.has(requestedStatus) ? requestedStatus : "ready_for_sale";
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

function assertMockRequiredChecksCompleted(check: InventoryQualityCheck) {
  const requiredChecks = [
    [check.screen_status, "屏幕显示"],
    [check.touch_status, "触控"],
    [check.camera_status, "前后摄像头"],
    [check.microphone_status, "麦克风"],
    [check.speaker_status, "听筒/扬声器"],
    [check.buttons_status, "按键 / 静音键"],
    [check.ports_status, "充电口"],
    [check.wifi_status, "Wi-Fi"],
    [check.bluetooth_status, "蓝牙"],
    [check.cellular_status, "蜂窝 / SIM"],
  ] as const;
  for (const [status, label] of requiredChecks) {
    assertMockCheckRecorded(status, label);
  }
}

function assertMockCheckRecorded(value: unknown, label: string) {
  const status = String(value ?? "");
  if (status === "pass" || status === "fail") return;
  throw new Error(`${label}未完成检测，不能成交入库`);
}

function assertMockCheckPassed(value: unknown, label: string) {
  const status = String(value ?? "");
  if (status === "pass") return;
  if (status === "fail") throw new Error(`${label}检测异常，不能成交入库`);
  throw new Error(`${label}尚未检测通过，不能成交入库`);
}
