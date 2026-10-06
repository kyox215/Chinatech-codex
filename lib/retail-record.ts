import { emptyRetailUnit, normalizeImei, retailCategories, validateRetailUnit, type Inspection, type RetailCategory, type RetailEvent, type RetailUnit } from "./retail";
import { retailHistoryCode, validateRetailHistoryRecord, type RetailHistoryRecord } from "./retail-history";

export type RetailRecordPreparation = {
  category: RetailCategory | ""; brand: string; model: string;
  identifierKind: "unconfirmed" | "imei" | "serial"; identifier: string;
  storeOwned: boolean; checks: Inspection;
};
export const previewRetailHistoryKey = "chinatech.m1.retail-history.v1";
export function parsePreviewRetailHistory(raw: string | null): RetailHistoryRecord[] {
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || !Array.isArray(value.records) || value.records.length > 2000) throw new Error("商品原资料无法读取，现有记录未被覆盖。");
  const records = value.records.map((record: RetailHistoryRecord) => validateRetailHistoryRecord(record));
  if (new Set(records.map((record: RetailHistoryRecord) => record.id)).size !== records.length) throw new Error("商品原记录编号重复。");
  return records;
}

const categories: Record<string, RetailCategory> = { 手机: "phone", 平板: "tablet", 笔记本: "laptop", 台式电脑: "desktop", 游戏机: "console" };
export function retailRecordHref(id: string, returnTo?: string) {
  return `/app/retail/units/${encodeURIComponent(id)}${returnTo ? `?${new URLSearchParams({ returnTo })}` : ""}`;
}
export function isSoldSource(record: RetailHistoryRecord) { return record.sourceStatus === "已售" || record.sourceStatus === "以售"; }

/** Display only: unknown storage/identity/checks do not become verified facts. */
export function historyDisplayUnit(record: RetailHistoryRecord): RetailUnit {
  return { ...emptyRetailUnit(), id: record.id, code: retailHistoryCode(record),
    category: categories[record.category || ""] || "other", brand: record.brand || "", model: record.model || "",
    color: record.color || "", condition: record.condition, batteryPercent: record.batteryPercent,
    costCents: record.costCents, refurbCents: null, priceCents: record.askingPriceCents,
    warrantyMonths: null, source: "SeaTable", intakeDate: record.intakeAt.slice(0, 10),
    status: isSoldSource(record) ? "sold" : record.sourceStatus === "在售" ? "available" : "hold" };
}
export function initialRecordPreparation(record: RetailHistoryRecord): RetailRecordPreparation {
  const unit = historyDisplayUnit(record);
  return { category: categories[record.category || ""] || "", brand: unit.brand, model: unit.model, identifierKind: "unconfirmed",
    identifier: record.identifier || "", storeOwned: false, checks: { functional: false, ownership: false, data: false } };
}

export function prepareRetailRecord(record: RetailHistoryRecord, draft: RetailRecordPreparation, warrantyMonths: number | null, event: RetailEvent, others: RetailUnit[]): RetailUnit {
  validateRetailHistoryRecord(record);
  if (isSoldSource(record)) throw new Error("原已售记录保留历史，不能重新登记为待售商品。");
  if (!draft || typeof draft !== "object" || Array.isArray(draft) || Object.keys(draft).sort().join(",") !== "brand,category,checks,identifier,identifierKind,model,storeOwned"
    || typeof draft.category !== "string" || !Object.hasOwn(retailCategories, draft.category) || typeof draft.brand !== "string" || draft.brand.length > 100 || typeof draft.model !== "string" || draft.model.length > 200
    || typeof draft.identifier !== "string" || draft.identifier.length > 200 || !["unconfirmed", "imei", "serial"].includes(draft.identifierKind)
    || !draft.checks || typeof draft.checks !== "object" || Array.isArray(draft.checks) || Object.keys(draft.checks).sort().join(",") !== "data,functional,ownership" || !Object.values(draft.checks).every(value => typeof value === "boolean")) throw new Error("请核对商品资料。");
  if (draft.storeOwned !== true) throw new Error("请确认这是门店自有且当前在店的实物。");
  if (others.some(unit => unit.id === record.id || unit.historyOrigin?.recordId === record.id)) throw new Error("商品资料已保存，请刷新并核对当前档案。");
  if (draft.identifierKind === "unconfirmed" && draft.identifier !== (record.identifier || "")) throw new Error("未核对的识别码须保留原文。");
  if (draft.identifierKind === "imei" && !["phone", "tablet"].includes(draft.category)) throw new Error("IMEI 仅适用于手机或平板，请核对商品类型。");
  const identifier = draft.identifier.normalize("NFKC").trim();
  if (draft.identifierKind !== "unconfirmed" && !identifier) throw new Error("请填写并核对实物识别码。");
  const unit: RetailUnit = { ...historyDisplayUnit(record), brand: draft.brand.trim(), model: draft.model.trim(),
    category: draft.category as RetailCategory, storeOwned: true, status: "inspecting", warrantyMonths,
    serial: draft.identifierKind === "serial" ? identifier : "",
    imei1: draft.identifierKind === "imei" ? normalizeImei(identifier) : "",
    inspection: { ...draft.checks }, events: [event],
    historyOrigin: { recordId: record.id, sourceSnapshot: record.sourceSnapshot } };
  validateRetailUnit(unit, others);
  // Source status and saved checks never replace the separate explicit approval.
  return unit;
}
