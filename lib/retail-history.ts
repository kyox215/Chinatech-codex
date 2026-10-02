import { can, type StaffMember } from "./staff";

/** An original source row, not a new sale, payment or independently verified physical unit. */
export type RetailHistoryRecord = {
  id: string; source: "seatable"; sourceSnapshot: string; sourceRow: number;
  sourceStatus: string | null; condition: "翻新机";
  customerName: string | null; customerPhone: string | null;
  category: string | null; brand: string | null; model: string | null;
  color: string | null; memory: string | null; paymentMethod: string | null;
  askingPriceCents: number | null; salePriceCents: number | null; depositCents: number | null; costCents: number | null;
  notes: string | null; batteryPercent: number | null; identifier: string | null;
  intakeAt: string; pickupDate: string | null; sourceUpdatedAt: string; importedAt: string;
  reviewReasons: string[];
};

export function retailHistoryStatus(record: RetailHistoryRecord) {
  return record.sourceStatus === "以售" ? "已售" : record.sourceStatus || "状态未记录";
}
export function retailHistoryCode(record: RetailHistoryRecord) { return `ST-${String(record.sourceRow - 1).padStart(4, "0")}`; }
export function retailHistorySearch(record: RetailHistoryRecord, query: string) {
  const values = [retailHistoryCode(record), record.sourceStatus, retailHistoryStatus(record), record.condition,
    record.customerName, record.customerPhone, record.category, record.brand, record.model, record.color,
    record.memory, record.identifier, record.notes, record.intakeAt, record.pickupDate];
  return values.join(" ").normalize("NFKC").toLowerCase().includes(query.normalize("NFKC").trim().toLowerCase());
}
export function projectRetailHistory(records: readonly RetailHistoryRecord[], member: StaffMember | null): RetailHistoryRecord[] {
  if (!can(member, "retail.view")) return [];
  // Source notes may contain unstructured purchase costs. Do not serialize them to a non-financial client.
  return records.map(record => can(member, "financial.read") ? record : { ...record, costCents: null, notes: null });
}

const textFields = ["sourceStatus", "customerName", "customerPhone", "category", "brand", "model", "color", "memory", "paymentMethod", "notes", "identifier"] as const;
const moneyFields = ["askingPriceCents", "salePriceCents", "depositCents", "costCents"] as const;
export function isRetailHistoryDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function isRetailHistoryTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value);
  return Boolean(match && isRetailHistoryDate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60
    && (!match[5] || Number(match[6]) < 24 && Number(match[7]) < 60) && Number.isFinite(Date.parse(value)));
}
export function validateRetailHistoryRecord(record: RetailHistoryRecord): RetailHistoryRecord {
  if (!record || typeof record !== "object" || record.source !== "seatable" || record.condition !== "翻新机"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.id) || !/^[0-9a-f]{64}$/.test(record.sourceSnapshot)
    || !Number.isSafeInteger(record.sourceRow) || record.sourceRow < 2) throw new Error("历史整机来源无效。");
  for (const field of textFields) if (record[field] !== null && (typeof record[field] !== "string" || record[field]!.length > 10000)) throw new Error("历史整机文字格式无效。");
  for (const field of moneyFields) if (record[field] !== null && (!Number.isSafeInteger(record[field]) || record[field]! < 0 || record[field]! > 100000000)) throw new Error("历史整机金额格式无效。");
  if (record.batteryPercent !== null && (!Number.isInteger(record.batteryPercent) || record.batteryPercent < 0 || record.batteryPercent > 100)) throw new Error("历史电池健康无效。");
  for (const field of ["intakeAt", "sourceUpdatedAt", "importedAt"] as const) if (!isRetailHistoryTimestamp(record[field])) throw new Error("历史整机日期无效。");
  if (record.pickupDate !== null && !isRetailHistoryDate(record.pickupDate)) throw new Error("历史拿走日期无效。");
  if (!Array.isArray(record.reviewReasons) || record.reviewReasons.length > 30 || record.reviewReasons.some(value => typeof value !== "string" || value.length > 200)) throw new Error("历史待核对信息无效。");
  return record;
}
