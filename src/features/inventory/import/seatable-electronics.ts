import crypto from "node:crypto";

import { parseMoney, parseSeaTableCsv } from "@/features/orders/import/seatable-riparazione";
import { CURRENCY_CODE } from "@/lib/money";
import type {
  ElectronicsImportPreview,
  ElectronicsImportWarning,
  InventoryItemStatus,
} from "@/lib/repairdesk/types";
import { normalizePhoneBook } from "@/shared/lib/phone";

export interface ElectronicsImportOptions {
  now?: Date;
  delimiter?: string;
  idFactory?: (prefix: string, rowNumber: number) => string;
  limit?: number;
}

interface NormalizedElectronicsRow {
  rowNumber: number;
  raw: Record<string, string>;
  status: string;
  name: string;
  phone: string;
  category: string;
  brand: string;
  model: string;
  color: string;
  storage: string;
  paymentMethod: string;
  price: string;
  buybackPrice: string;
  deposit: string;
  notes: string;
  battery: string;
  imei: string;
  pickupDate: string;
  createdDate: string;
}

const FIELD_ALIASES = {
  status: ["状态", "stato", "status"],
  name: ["nome", "cliente", "nominativo", "客户"],
  phone: ["numero telefono", "numerotelefono", "telefono", "tel", "手机号", "电话"],
  category: ["categoria", "category", "类别"],
  brand: ["marca", "brand", "品牌"],
  model: ["modello", "model", "型号"],
  color: ["colore", "color", "颜色"],
  storage: ["memoria", "storage", "容量", "内存"],
  paymentMethod: ["metodo di pagamento", "metododipagamento", "payment method", "付款方式"],
  price: ["prezzo", "price", "售价"],
  buybackPrice: ["prezzo pagato", "prezzopagato", "paid price", "回收价"],
  deposit: ["acconto", "deposit", "订金"],
  notes: ["note", "notes", "备注"],
  battery: ["batteria", "battery", "电池"],
  imei: ["imei/序列号", "imei", "seriale", "serial", "序列号"],
  pickupDate: ["data ritiro", "dataritiro", "ritiro", "取走日期"],
  createdDate: ["data", "created", "创建日期"],
} satisfies Record<keyof Omit<NormalizedElectronicsRow, "rowNumber" | "raw">, string[]>;

export function buildSeaTableElectronicsImport(
  csvContent: string,
  options: ElectronicsImportOptions = {},
): ElectronicsImportPreview {
  const now = options.now ?? new Date();
  const parsed = parseSeaTableCsv(csvContent, options.delimiter);
  const records = rowsToObjects(parsed).slice(0, options.limit);
  const warnings: ElectronicsImportWarning[] = [];
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const customersByRaw = new Map<
    string,
    { id: string; name: string; phone: string; phoneRaw: string; contacts: string[] }
  >();
  const customers: Record<string, unknown>[] = [];
  const items: Record<string, unknown>[] = [];
  const transactions: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];

  for (const record of records) {
    const row = normalizeRecord(record);
    const createdAt = parseElectronicsDate(row.createdDate, now, row.rowNumber, "DATA", warnings);
    const soldAt = row.pickupDate
      ? parseElectronicsDate(row.pickupDate, now, row.rowNumber, "DATA RITIRO", warnings)
      : undefined;
    const buybackPrice = parseMoney(row.buybackPrice, row.rowNumber, "PREZZO PAGATO", warnings);
    const listOrSalePrice = parseMoney(row.price, row.rowNumber, "PREZZO", warnings);
    const deposit = parseMoney(row.deposit, row.rowNumber, "ACCONTO", warnings);
    const status = inferElectronicsStatus(row.status, {
      soldAt,
      price: listOrSalePrice,
      buybackPrice,
    });
    const phoneBook = normalizePhoneBook(row.phone);
    const phoneRaw = phoneBook.primaryRaw || `NO_PHONE_ROW_${row.rowNumber}`;
    const customerName = cleanText(row.name) || phoneBook.primary || `Cliente ${row.rowNumber}`;

    let customer = customersByRaw.get(phoneRaw);
    if (!customer) {
      customer = {
        id: idFactory("cus_electronics", row.rowNumber),
        name: customerName,
        phone: phoneBook.primary || `NO_PHONE_ROW_${row.rowNumber}`,
        phoneRaw,
        contacts: phoneBook.contacts,
      };
      customersByRaw.set(phoneRaw, customer);
      customers.push({
        id: customer.id,
        name: customer.name,
        phone_e164: customer.phone,
        phone_raw: customer.phoneRaw,
        contact_phones: customer.contacts,
        consent_marketing: false,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
        created_at: createdAt,
        updated_at: createdAt,
      });
    } else {
      customer.contacts = mergeContacts(customer.contacts, phoneBook.contacts);
      const target = customers.find((entry) => entry.id === customer?.id);
      if (target) target.contact_phones = customer.contacts;
    }

    if (!phoneBook.primaryRaw) {
      warnings.push({
        row: row.rowNumber,
        field: "NUMERO TELEFONO",
        message: "缺少有效手机号，已生成导入占位客户",
        value: row.phone,
      });
    }

    const itemId = idFactory("inv_electronics", row.rowNumber);
    const eventId = idFactory("inv_evt_electronics", row.rowNumber);
    const label = `${cleanText(row.brand)} ${cleanText(row.model)}`.trim();
    const updatedAt = soldAt ?? createdAt;
    const batteryHealth = parseBatteryHealth(row.battery, row.rowNumber, warnings);

    items.push({
      id: itemId,
      status,
      source_type: "seatable_electronics",
      source_ref: `电子产品:${row.rowNumber}`,
      legacy_source: "seatable:电子产品",
      customer_id: customer.id,
      category: cleanText(row.category) || "phone",
      brand: cleanText(row.brand) || "Unknown",
      model: cleanText(row.model) || "Unknown",
      color: cleanText(row.color) || null,
      storage_capacity: cleanText(row.storage) || null,
      serial_or_imei: cleanText(row.imei) || null,
      imei_check_status: cleanText(row.imei) ? "unknown" : "unchecked",
      activation_lock_status: "unchecked",
      data_wipe_status: status === "sold" ? "unknown" : "unchecked",
      cosmetic_grade: "unknown",
      functional_grade: "untested",
      battery_health: batteryHealth,
      buyback_price: buybackPrice,
      list_price: status === "sold" ? listOrSalePrice : listOrSalePrice,
      sale_price: status === "sold" ? listOrSalePrice : 0,
      deposit_amount: deposit,
      repair_cost_amount: 0,
      fees_amount: 0,
      currency_code: CURRENCY_CODE,
      payment_method: cleanText(row.paymentMethod) || null,
      sale_channel: status === "sold" || status === "listed" ? "store" : null,
      warranty_months: 12,
      warranty_until: status === "sold" && soldAt ? addMonthsIso(soldAt, 12) : null,
      purchased_at: buybackPrice > 0 ? createdAt : null,
      listed_at:
        status === "listed" || status === "reserved" || status === "sold" ? createdAt : null,
      sold_at: soldAt ?? null,
      returned_at: null,
      recycled_at: status === "recycled" ? updatedAt : null,
      cancelled_at: status === "cancelled" ? updatedAt : null,
      notes: cleanText(row.notes) || null,
      legacy_payload: {
        source: "seatable:电子产品",
        row_number: row.rowNumber,
        item_label: label,
        raw: row.raw,
      },
      created_at: createdAt,
      updated_at: updatedAt,
    });

    if (buybackPrice > 0) {
      transactions.push({
        id: idFactory("inv_tx_buyback", row.rowNumber),
        item_id: itemId,
        transaction_type: "buyback_payment",
        amount: buybackPrice,
        currency_code: CURRENCY_CODE,
        method: cleanText(row.paymentMethod) || null,
        note: "SeaTable 电子产品导入回收价",
        created_at: createdAt,
      });
    }

    if (status === "sold" && listOrSalePrice > 0) {
      transactions.push({
        id: idFactory("inv_tx_sale", row.rowNumber),
        item_id: itemId,
        transaction_type: "sale_payment",
        amount: listOrSalePrice,
        currency_code: CURRENCY_CODE,
        method: cleanText(row.paymentMethod) || null,
        note: "SeaTable 电子产品导入售价",
        created_at: soldAt ?? updatedAt,
      });
    }

    events.push({
      id: eventId,
      item_id: itemId,
      event_type: "imported",
      from_status: null,
      to_status: status,
      payload: {
        source: "seatable:电子产品",
        row_number: row.rowNumber,
        inferred_from: {
          status: row.status,
          has_pickup_date: Boolean(soldAt),
          price: listOrSalePrice,
          buyback_price: buybackPrice,
        },
        raw: row.raw,
      },
      operator_name: "SeaTable Import",
      created_at: updatedAt,
    });
  }

  return {
    items,
    customers,
    transactions,
    events,
    report: {
      totalRows: records.length,
      importedRows: items.length,
      itemCount: items.length,
      customerCount: customers.length,
      transactionCount: transactions.length,
      eventCount: events.length,
      totalBuyback: roundMoney(
        items.reduce((sum, item) => sum + Number(item.buyback_price ?? 0), 0),
      ),
      totalListPrice: roundMoney(
        items.reduce((sum, item) => sum + Number(item.list_price ?? 0), 0),
      ),
      totalSalePrice: roundMoney(
        items.reduce((sum, item) => sum + Number(item.sale_price ?? 0), 0),
      ),
      warnings,
    },
  };
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  const [headers = [], ...records] = rows;
  return records.map((record, index) => {
    const row: Record<string, string> = { __rowNumber: String(index + 2) };
    headers.forEach((header, headerIndex) => {
      row[header.trim()] = record[headerIndex]?.trim() ?? "";
    });
    return row;
  });
}

function normalizeRecord(record: Record<string, string>): NormalizedElectronicsRow {
  const indexed = new Map<string, string>();
  for (const [key, value] of Object.entries(record)) {
    indexed.set(compactHeader(key), value);
  }

  const pick = (field: keyof typeof FIELD_ALIASES) => {
    for (const alias of FIELD_ALIASES[field]) {
      const value = indexed.get(compactHeader(alias));
      if (value !== undefined) return value.trim();
    }
    return "";
  };

  return {
    rowNumber: Number(record.__rowNumber ?? 0),
    raw: Object.fromEntries(Object.entries(record).filter(([key]) => key !== "__rowNumber")),
    status: pick("status"),
    name: pick("name"),
    phone: pick("phone"),
    category: pick("category"),
    brand: pick("brand"),
    model: pick("model"),
    color: pick("color"),
    storage: pick("storage"),
    paymentMethod: pick("paymentMethod"),
    price: pick("price"),
    buybackPrice: pick("buybackPrice"),
    deposit: pick("deposit"),
    notes: pick("notes"),
    battery: pick("battery"),
    imei: pick("imei"),
    pickupDate: pick("pickupDate"),
    createdDate: pick("createdDate"),
  };
}

function inferElectronicsStatus(
  statusValue: string,
  values: { soldAt?: string; price: number; buybackPrice: number },
): InventoryItemStatus {
  const status = statusValue.toLowerCase();
  if (/(annull|cancel|取消|作废)/i.test(status)) return "cancelled";
  if (/(reso|return|退回|售后)/i.test(status)) return "returned";
  if (/(ricicl|recycl|报废|回收处理)/i.test(status)) return "recycled";
  if (values.soldAt || /(vendut|sold|consegn|ritir|已售|取走)/i.test(status)) return "sold";
  if (/(prenot|reserved|预订)/i.test(status)) return "reserved";
  if (/(list|vendita|上架|售卖)/i.test(status)) return "listed";
  if (/(pulit|wipe|清除)/i.test(status)) return "data_wipe";
  if (/(riprist|refurb|整备|维修)/i.test(status)) return "refurbishing";
  if (/(prevent|offer|报价)/i.test(status)) return "offer_made";
  if (/(valut|check|检测|估价)/i.test(status)) return "evaluating";
  if (values.price > 0) return "listed";
  if (values.buybackPrice > 0) return "purchased";
  return "intake";
}

function parseBatteryHealth(
  value: string,
  row: number,
  warnings: ElectronicsImportWarning[],
): number | null {
  const input = cleanText(value);
  if (!input) return null;
  const match = input.replace(",", ".").match(/\d+(\.\d+)?/);
  if (!match) {
    warnings.push({ row, field: "BATTERIA", message: "电池健康无法解析", value });
    return null;
  }
  const amount = Number(match[0]);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
    warnings.push({ row, field: "BATTERIA", message: "电池健康超出 0-100 范围", value });
    return null;
  }
  return roundMoney(amount);
}

function parseElectronicsDate(
  value: string,
  fallback: Date,
  row: number,
  field: string,
  warnings: ElectronicsImportWarning[],
): string {
  const input = cleanText(value);
  if (!input) return fallback.toISOString();

  const iso = Date.parse(input);
  if (Number.isFinite(iso)) return new Date(iso).toISOString();

  const italian = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (italian) {
    const [, day, month, year, hour = "0", minute = "0"] = italian;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(
      Number(fullYear),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  warnings.push({ row, field, message: "日期无法解析，已使用导入时间", value });
  return fallback.toISOString();
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function compactHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_:\-/.]+/g, "");
}

function mergeContacts(left: string[], right: string[]) {
  const seen = new Set(left.map((value) => value.replace(/\D/g, "")));
  const merged = [...left];
  for (const contact of right) {
    const raw = contact.replace(/\D/g, "");
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    merged.push(contact);
  }
  return merged;
}

function addMonthsIso(value: string, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
