import type { InventoryListItem } from "@/lib/repairdesk/types";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";

export const INVENTORY_SALE_RECEIPT_TERMS = [
  "La garanzia copre solo difetti funzionali presenti sul prodotto venduto e dichiarati nel periodo indicato.",
  "Sono esclusi cadute, urti, danni da liquidi, ossidazione, manomissioni, uso improprio e interventi di terzi.",
  "Batteria, accessori, parti estetiche e difetti gia dichiarati sono coperti solo se indicato espressamente nella scheda vendita.",
  "Per richiedere assistenza e necessario presentare questo documento e il dispositivo con IMEI o seriale leggibile.",
];

export interface InventorySaleReceiptSnapshot {
  receipt_no: string;
  sold_at: string;
  warranty_months: number;
  warranty_until?: string;
  terms: string[];
}

export interface InventorySaleReceiptData extends InventorySaleReceiptSnapshot {
  store_name: string;
  store_address: string;
  item_no: string;
  item_label: string;
  category: string;
  color?: string;
  storage_capacity?: string;
  serial_or_imei?: string;
  buyer_name?: string;
  buyer_phone?: string;
  sale_price: number;
  deposit_amount: number;
  payment_method?: string;
  sale_channel?: string;
  notes?: string;
}

export function buildInventorySaleReceiptSnapshot(input: {
  publicNo: string;
  soldAt: string;
  warrantyMonths: number;
  warrantyUntil?: string;
  terms?: string[];
}): InventorySaleReceiptSnapshot {
  return {
    receipt_no: getInventorySaleReceiptNo(input.publicNo, input.soldAt),
    sold_at: input.soldAt,
    warranty_months: Math.max(0, Math.trunc(input.warrantyMonths || 0)),
    warranty_until: input.warrantyUntil,
    terms: input.terms?.length ? input.terms : INVENTORY_SALE_RECEIPT_TERMS,
  };
}

export function getInventorySaleReceiptNo(publicNo: string, soldAt: string) {
  const date = new Date(soldAt);
  const yyyymmdd = Number.isNaN(date.getTime())
    ? "00000000"
    : date.toISOString().slice(0, 10).replaceAll("-", "");
  return `${publicNo || "INV"}-${yyyymmdd}`;
}

export function readInventorySaleReceiptSnapshot(
  legacyPayload: Record<string, unknown> | undefined,
): InventorySaleReceiptSnapshot | undefined {
  const raw = legacyPayload?.sale_receipt;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const receiptNo = stringValue(record.receipt_no);
  const soldAt = stringValue(record.sold_at);
  const warrantyMonths = numberValue(record.warranty_months);
  const terms = stringArray(record.terms);
  if (!receiptNo || !soldAt || warrantyMonths === undefined) return undefined;

  return {
    receipt_no: receiptNo,
    sold_at: soldAt,
    warranty_months: warrantyMonths,
    warranty_until: stringValue(record.warranty_until),
    terms: terms.length ? terms : INVENTORY_SALE_RECEIPT_TERMS,
  };
}

export function buildInventorySaleReceiptData(
  item: InventoryListItem,
  options: {
    storeIdentity: Pick<StoreOutputIdentity, "storeName" | "storeAddress">;
    buyerName?: string;
    buyerPhone?: string;
  },
): InventorySaleReceiptData {
  const soldAt = item.sold_at ?? new Date().toISOString();
  const warrantyMonths = Math.max(0, Math.trunc(item.warranty_months || 0));
  const snapshot =
    readInventorySaleReceiptSnapshot(item.legacy_payload) ??
    buildInventorySaleReceiptSnapshot({
      publicNo: item.public_no,
      soldAt,
      warrantyMonths,
      warrantyUntil: item.warranty_until,
    });

  return {
    ...snapshot,
    store_name: options.storeIdentity.storeName,
    store_address: options.storeIdentity.storeAddress,
    item_no: item.public_no,
    item_label: item.item_label,
    category: item.category,
    color: item.color,
    storage_capacity: item.storage_capacity,
    serial_or_imei: item.serial_or_imei,
    buyer_name: options.buyerName || item.buyer_name,
    buyer_phone: options.buyerPhone || item.buyer_phone,
    sale_price: item.sale_price,
    deposit_amount: item.deposit_amount,
    payment_method: item.payment_method,
    sale_channel: item.sale_channel,
    notes: item.notes,
  };
}

export function getInventoryWarrantyState(
  item: Pick<InventoryListItem, "status" | "warranty_months" | "warranty_until">,
  now = new Date(),
): { key: "not_sold" | "none" | "active" | "expired"; label: string } {
  if (item.status !== "sold") return { key: "not_sold", label: "未售出" };
  if (!item.warranty_months || item.warranty_months <= 0 || !item.warranty_until) {
    return { key: "none", label: "无保修" };
  }
  const until = new Date(item.warranty_until);
  if (Number.isNaN(until.getTime())) return { key: "none", label: "保修未定" };
  return until.getTime() >= now.getTime()
    ? { key: "active", label: "保修中" }
    : { key: "expired", label: "已过保" };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}
