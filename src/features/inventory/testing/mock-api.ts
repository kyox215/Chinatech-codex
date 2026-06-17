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
import { customers as fixtureCustomers } from "@/lib/mock/state";
import { buildSeaTableElectronicsImport } from "@/features/inventory/import/seatable-electronics";
import {
  getInventoryProfit,
  isInventoryPipelineStatus,
  validateInventoryTransition,
} from "@/features/inventory/model/inventory-workflow";
import { normalizePhoneBook } from "@/shared/lib/phone";

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
  _actor?: AuditActor,
): Promise<InventoryListItem[]> {
  return mockInventoryItems
    .map((item) => decorateInventoryItem(item))
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

export async function getInventoryItem(id: string, _actor?: AuditActor): Promise<InventoryDetail> {
  const item = findItem(id);
  return {
    item: decorateInventoryItem(item),
    customer: findCustomer(item.customer_id),
    buyer: findCustomer(item.buyer_customer_id),
    checks: mockInventoryChecks.filter((check) => check.item_id === id),
    transactions: mockInventoryTransactions.filter((transaction) => transaction.item_id === id),
    events: mockInventoryEvents.filter((event) => event.item_id === id),
    attachments: mockInventoryAttachments.filter((attachment) => attachment.item_id === id),
  };
}

export async function createInventoryIntake(
  input: CreateInventoryIntakeInput,
  _actor?: AuditActor,
) {
  const nowIso = new Date().toISOString();
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
    status: "intake",
    source_type: "buyback",
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
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: CURRENCY_CODE,
    payment_method: optional(input.payment_method),
    warranty_months: 12,
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
  addEvent(item.id, "created", undefined, "intake", { input }, nowIso);
  return { id };
}

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
  _actor?: AuditActor,
) {
  const item = findItem(id);
  Object.assign(item, pruneUndefined(input), { updated_at: new Date().toISOString() });
  addEvent(id, "updated", item.status, undefined, { input }, item.updated_at);
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
  validateInventoryTransition(from, to);
  if (to === "purchased") {
    assertMockBuybackPurchaseEvidence(item);
  }
  item.status = to;
  item.updated_at = new Date().toISOString();
  if (to === "purchased") item.purchased_at = item.updated_at;
  if (to === "listed") item.listed_at = item.updated_at;
  if (to === "sold") item.sold_at = item.updated_at;
  if (to === "returned") item.returned_at = item.updated_at;
  addEvent(id, "status_changed", from, to, { reason: opts.reason }, item.updated_at);
  if (to === "purchased") {
    insertMockBuybackPaymentTransaction(item, item.updated_at);
  }
  return { ok: true, from, to };
}

export async function recordInventoryCheck(
  id: string,
  input: InventoryQualityCheckInput,
  _actor?: AuditActor,
) {
  const item = findItem(id);
  const nowIso = new Date().toISOString();
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
  _actor?: AuditActor,
): Promise<InventoryAttachmentUploadResult> {
  findItem(id);
  const nowIso = new Date().toISOString();
  const attachmentId = crypto.randomUUID();
  const attachment: InventoryAttachment = {
    id: attachmentId,
    store_id: "mock-store",
    item_id: id,
    kind: input.kind,
    file_name: input.file_name,
    mime_type: input.mime_type,
    file_size: input.file_size,
    storage_bucket: "mock-inventory-attachments",
    storage_path: `mock-store/${id}/${attachmentId}`,
    signed_url: `mock://inventory-attachments/${attachmentId}`,
    note: optional(input.note),
    uploaded_by: "Mock User",
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
      file_name: input.file_name,
      mime_type: input.mime_type,
      file_size: input.file_size,
    },
    nowIso,
  );
  return { attachment };
}

export async function recordInventoryTransaction(
  id: string,
  input: InventoryTransactionInput,
  _actor?: AuditActor,
) {
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
  item.warranty_until = addMonthsIso(nowIso, item.warranty_months);
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

export function importElectronicsCsvPreview(csvContent: string): ElectronicsImportPreview {
  return buildSeaTableElectronicsImport(csvContent);
}

export async function applyElectronicsCsvImport(csvContent: string, _actor?: AuditActor) {
  const preview = buildSeaTableElectronicsImport(csvContent);
  return preview.report;
}

function decorateInventoryItem(item: InventoryItem): InventoryListItem {
  const transactions = mockInventoryTransactions.filter(
    (transaction) => transaction.item_id === item.id,
  );
  const customer = findCustomer(item.customer_id);
  const buyer = findCustomer(item.buyer_customer_id);
  return {
    ...item,
    customer_name: customer?.name,
    customer_phone: customer?.phone_e164,
    buyer_name: buyer?.name,
    buyer_phone: buyer?.phone_e164,
    item_label: `${item.brand} ${item.model}`.trim() || item.public_no,
    profit: getInventoryProfit(item, transactions),
  };
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

function resolveMockCustomer(
  id?: string,
  name?: string,
  phone?: string,
  nowIso = new Date().toISOString(),
) {
  if (id) return id;
  if (!name && !phone) return undefined;
  if (!name || !phone) throw new Error("客户姓名和手机号需要同时填写");
  const book = normalizePhoneBook(phone);
  const existing = [...mockCustomers, ...fixtureCustomers].find(
    (customer) => customer.phone_raw === book.primaryRaw,
  );
  if (existing) return existing.id;
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

function assertMockBuybackPurchaseEvidence(item: InventoryItem) {
  if (item.source_type !== "buyback") return;
  const legacyPayload = recordOrEmpty(item.legacy_payload);
  const quotePayload = recordOrEmpty(legacyPayload.buyback_quote);
  if (Object.keys(quotePayload).length === 0) {
    throw new Error("回收成交必须先保存回收报价资料");
  }
  if (String(quotePayload.intent_outcome ?? "") !== "accepted") {
    throw new Error("客户未确认接受报价，不能成交入库");
  }
  if (quotePayload.hard_block === true) {
    throw new Error("高风险回收设备不能直接成交入库");
  }
  const acceptedOffer = Number(quotePayload.final_offer ?? 0);
  if (!Number.isFinite(acceptedOffer) || acceptedOffer <= 0) {
    throw new Error("客户接受报价金额必须大于 0");
  }
  if ((item.buyback_price ?? 0) <= 0) {
    throw new Error("回收成交金额必须大于 0");
  }
  if (Math.abs((item.buyback_price ?? 0) - acceptedOffer) > 0.01) {
    throw new Error("回收成交金额与客户接受报价不一致");
  }
  if (!item.serial_or_imei?.trim()) {
    throw new Error("回收成交必须记录 IMEI / 序列号");
  }
  assertMockCheckPassed(item.imei_check_status, "IMEI / 序列号");
  assertMockCheckPassed(item.activation_lock_status, "账号锁 / Find My");
  assertMockCheckPassed(item.data_wipe_status, "数据抹除");
  const latestCheck = mockInventoryChecks.find((check) => check.item_id === item.id);
  if (!latestCheck) throw new Error("回收成交前必须完成完整功能检测");
  assertMockRequiredChecksCompleted(latestCheck);

  const devicePayload = recordOrEmpty(legacyPayload.buyback_device);
  const requiredKinds = new Set<InventoryAttachment["kind"]>([
    "device_photo",
    "signature",
    "id_front",
    "id_back",
  ]);
  if (devicePayload.purchase_proof !== true) requiredKinds.add("invoice_photo");
  if (devicePayload.box_included !== true) requiredKinds.add("box_photo");

  const existingKinds = new Set(
    mockInventoryAttachments
      .filter((attachment) => attachment.item_id === item.id)
      .map((attachment) => attachment.kind),
  );
  const missingKinds = Array.from(requiredKinds).filter((kind) => !existingKinds.has(kind));
  if (missingKinds.length > 0) {
    throw new Error(`缺少成交凭证：${missingKinds.map(inventoryAttachmentKindLabel).join("、")}`);
  }
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

function insertMockBuybackPaymentTransaction(item: InventoryItem, nowIso: string) {
  if (item.source_type !== "buyback") return;
  if ((item.buyback_price ?? 0) <= 0) return;
  const exists = mockInventoryTransactions.some(
    (transaction) =>
      transaction.item_id === item.id && transaction.transaction_type === "buyback_payment",
  );
  if (exists) return;
  mockInventoryTransactions.unshift({
    id: crypto.randomUUID(),
    item_id: item.id,
    transaction_type: "buyback_payment",
    amount: item.buyback_price,
    currency_code: CURRENCY_CODE,
    method: item.payment_method,
    note: "回收成交付款",
    created_at: nowIso,
  });
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
