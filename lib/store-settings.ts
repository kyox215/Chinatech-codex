import { parseRepairGroups, type RepairGroupSettings } from "./repair-groups";
export type PaperFormat = "a4" | "a5" | "half" | "double";
export type SupplierProfile = { id: string; name: string; phone: string; website: string; active: boolean };
export type FinanceEntry = { id: string; kind: "income" | "expense"; amountCents: number; purpose: string; relatedId: string; note: string; time: string; voidReason?: string };
export type StoreSettings = { repairGroups?: RepairGroupSettings; revision: number; shopName: string; address: string; phone: string; paper: PaperFormat; repairWarrantyMonths: number; retailWarrantyMonths: number; suppliers: SupplierProfile[]; finance: FinanceEntry[] };
export const defaultStoreSettings: StoreSettings = { revision: 0, shopName: "ChinaTech", address: "Viale Vittorio Veneto, 7, Floridia (SR)", phone: "+39 3335719865", paper: "a4", repairWarrantyMonths: 6, retailWarrantyMonths: 12, suppliers: [{ id: "demo-mobile", name: "MobileParts SRL", phone: "", website: "", active: true }, { id: "demo-tech", name: "TechSupply Italia", phone: "", website: "", active: true }, { id: "demo-game", name: "GameFix EU", phone: "", website: "", active: true }], finance: [] };
export function validateFinanceEntry(entry: FinanceEntry) {
  if (!entry.id || !["income", "expense"].includes(entry.kind) || !Number.isSafeInteger(entry.amountCents) || entry.amountCents <= 0 || entry.amountCents > 100000000 || !entry.purpose.trim() || !entry.time || entry.note.length > 500 || entry.relatedId.length > 100) throw new Error("请填写有效收支类型、金额与用途。");
  return entry;
}
export function financeTotals(entries: FinanceEntry[]) {
  const active = entries.filter(entry => !entry.voidReason);
  const income = active.filter(entry => entry.kind === "income").reduce((sum, entry) => sum + entry.amountCents, 0);
  const expense = active.filter(entry => entry.kind === "expense").reduce((sum, entry) => sum + entry.amountCents, 0);
  return { income, expense, balance: income - expense };
}
export function parseStoreSettings(raw: string | null): StoreSettings {
  if (!raw) return defaultStoreSettings;
  const data = JSON.parse(raw);
  if (data.version !== 1 || !data.settings) throw new Error("本地设置格式异常。");
  const value = { ...data.settings, repairGroups: parseRepairGroups(data.settings.repairGroups), repairWarrantyMonths: data.settings.repairWarrantyMonths === undefined ? 6 : data.settings.repairWarrantyMonths, retailWarrantyMonths: data.settings.retailWarrantyMonths === undefined ? 12 : data.settings.retailWarrantyMonths } as StoreSettings;
  if (![value.repairWarrantyMonths,value.retailWarrantyMonths].every(months => Number.isSafeInteger(months) && months >= 1 && months <= 120)) throw new Error("默认商家保修须为 1–120 个整数月。");
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || ![value.shopName, value.address, value.phone].every(item => typeof item === "string" && item.length <= 200) || !value.shopName.trim() || !["a4", "a5", "half", "double"].includes(value.paper) || !Array.isArray(value.suppliers) || !Array.isArray(value.finance) || value.finance.length > 5000) throw new Error("本地设置格式异常。");
  const supplierIds = new Set(); const supplierNames = new Set();
  for (const supplier of value.suppliers) {
    if (!supplier || ![supplier.id, supplier.name, supplier.phone, supplier.website].every(item => typeof item === "string" && item.length <= 200) || !supplier.name.trim() || typeof supplier.active !== "boolean" || supplierIds.has(supplier.id) || supplierNames.has(supplier.name.trim().toLowerCase())) throw new Error("供应商资料异常或名称重复。");
    if (supplier.website && !/^https?:\/\//i.test(supplier.website)) throw new Error("网站地址必须以 https:// 或 http:// 开头。");
    supplierIds.add(supplier.id); supplierNames.add(supplier.name.trim().toLowerCase());
  }
  const ids = new Set();
  for (const entry of value.finance) { validateFinanceEntry(entry); if (ids.has(entry.id) || (entry.voidReason !== undefined && (!entry.voidReason.trim() || entry.voidReason.length > 300))) throw new Error("收支记录重复或作废原因异常。"); ids.add(entry.id); }
  return value;
}
