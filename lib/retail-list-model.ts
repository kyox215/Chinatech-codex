import { currentRetailSale, retailCategories, retailSpec, retailStatuses, type RetailUnit } from "./retail";
import { retailHistoryCode, retailHistoryStatus, type RetailHistoryRecord } from "./retail-history";

export type RetailView = "available" | "sold" | "other";
export const retailViewLabels: Record<RetailView, string> = { available: "在售商品", sold: "已售历史", other: "其他状态" };
export type RetailListSort = "name-asc" | "sold-newest" | "newest" | "oldest" | "price-asc" | "price-desc";
export function defaultRetailListSort(view: RetailView): RetailListSort {
  return view === "available" ? "name-asc" : view === "sold" ? "sold-newest" : "newest";
}
export function resolveRetailListSort(view: RetailView, value: string | null): RetailListSort {
  if (value === "name-asc" || value === "newest" || value === "oldest" || value === "price-asc" || value === "price-desc"
    || value === "sold-newest" && view === "sold") return value;
  return defaultRetailListSort(view);
}
export type RetailListItem = {
  key: string; id: string; source: "unit" | "history"; view: RetailView;
  code: string; title: string; condition: "新机" | "翻新机"; category: string;
  color: string | null; specification: string | null; identifier: string | null; phone: string | null;
  intakeDate: string; pickupDate: string | null; saleSortDate: string | null; priceCents: number | null; salePriceCents: number | null;
  status: string; reviewCount: number; search: string;
};
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const names = new Intl.Collator("en", { sensitivity: "base", numeric: true });
export function historyRetailView(status: string | null): RetailView {
  return status === "在售" ? "available" : status === "以售" || status === "已售" ? "sold" : "other";
}
export function retailViewFromParams(params: Pick<URLSearchParams, "get">): RetailView {
  const view = params.get("view");
  if (view === "available" || view === "sold" || view === "other") return view;
  // Preserve old detail return links and bookmarks without keeping the mixed default.
  if (params.get("source") === "history") {
    const status = params.get("status");
    return status && status !== "all" ? historyRetailView(status) : "sold";
  }
  return "available";
}
export function buildRetailListIndex(units: readonly RetailUnit[], history: readonly RetailHistoryRecord[]): RetailListItem[] {
  const items: RetailListItem[] = history.map(record => {
    const code = retailHistoryCode(record);
    const title = [record.brand, record.model].filter(Boolean).join(" ") || "商品名称未记录";
    return { key: `history:${record.id}`, id: record.id, source: "history", view: historyRetailView(record.sourceStatus),
      code, title, condition: record.condition, category: record.category || "未记录", color: record.color, specification: record.memory,
      identifier: record.identifier, phone: record.customerPhone, intakeDate: record.intakeAt, pickupDate: record.pickupDate,
      // The imported source has a pickup date, but no separate sale timestamp.
      saleSortDate: record.pickupDate,
      priceCents: record.askingPriceCents, salePriceCents: record.salePriceCents, status: retailHistoryStatus(record), reviewCount: record.reviewReasons.length,
      search: normalize([code,title,record.sourceStatus,retailHistoryStatus(record),record.condition,record.customerName,record.customerPhone,
        record.category,record.color,record.memory,record.identifier,record.notes,record.intakeAt,record.pickupDate].join(" ")) };
  });
  for (const unit of units) {
    const sale = unit.status === "sold" ? currentRetailSale(unit) : undefined;
    const specification = retailSpec(unit);
    const title = [unit.brand, unit.model].filter(Boolean).join(" ") || "商品名称未记录";
    items.push({ key:`unit:${unit.id}`, id:unit.id, source:"unit", view:unit.status === "available" ? "available" : unit.status === "sold" ? "sold" : "other",
      code:unit.code, title, condition:unit.condition, category:retailCategories[unit.category], color:unit.color, specification,
      identifier:unit.imei1 || unit.serial || unit.productCode || null, phone:sale?.customerPhone || unit.reservation?.phone || null,
      intakeDate:unit.intakeDate, pickupDate:sale?.deliveryDate || null, priceCents:unit.priceCents, salePriceCents:sale?.priceCents ?? null,
      saleSortDate:sale?.time || null,
      status:retailStatuses[unit.status].label, reviewCount:0,
      search:normalize([unit.code,title,unit.condition,retailCategories[unit.category],unit.color,specification,unit.imei1,unit.imei2,unit.serial,unit.productCode,
        unit.knownIssues,unit.location,unit.intakeDate,sale?.customerName,sale?.customerPhone,sale?.deliveryDate,unit.reservation?.name,unit.reservation?.phone].join(" ")) });
  }
  return items;
}
export type RetailListFilters = { view:RetailView; condition:string; query:string; category:string; review:boolean; status:string; sort:string; page:number };
export function queryRetailList(items: readonly RetailListItem[], filters: RetailListFilters) {
  const viewCounts = { available:0, sold:0, other:0 };
  const conditionCounts = { all:0, 新机:0, 翻新机:0 };
  const query = normalize(filters.query);
  const sort = resolveRetailListSort(filters.view, filters.sort);
  const scoped:RetailListItem[]=[];
  const categories = new Set<string>();
  const statuses = new Set<string>();
  for(const item of items) {
    viewCounts[item.view]++;
    if(item.view !== filters.view) continue;
    categories.add(item.category); statuses.add(item.status);
    if(query && !item.search.includes(query) || filters.category !== "all" && item.category !== filters.category
      || filters.review && !item.reviewCount || filters.status !== "all" && item.status !== filters.status) continue;
    conditionCounts.all++; conditionCounts[item.condition]++;
    if(filters.condition === "all" || filters.condition === item.condition) scoped.push(item);
  }
  scoped.sort((a,b) => {
    if(sort === "name-asc") return names.compare(normalize(a.title), normalize(b.title)) || a.key.localeCompare(b.key);
    if(sort === "sold-newest") {
      if(!a.saleSortDate || !b.saleSortDate) return !a.saleSortDate && !b.saleSortDate ? a.key.localeCompare(b.key) : !a.saleSortDate ? 1 : -1;
      return b.saleSortDate.replace("T", " ").localeCompare(a.saleSortDate.replace("T", " ")) || a.key.localeCompare(b.key);
    }
    if(sort === "price-asc" || sort === "price-desc") {
      if(a.priceCents === null || b.priceCents === null) return a.priceCents === b.priceCents ? a.key.localeCompare(b.key) : a.priceCents === null ? 1 : -1;
      return (a.priceCents-b.priceCents)*(sort === "price-asc" ? 1 : -1) || a.key.localeCompare(b.key);
    }
    return (a.intakeDate.localeCompare(b.intakeDate) || a.key.localeCompare(b.key))*(sort === "oldest" ? 1 : -1);
  });
  const pageCount = Math.max(1, Math.ceil(scoped.length/50));
  const page = Math.min(pageCount, Number.isSafeInteger(filters.page) && filters.page > 0 ? filters.page : 1);
  return { viewCounts, conditionCounts, total:scoped.length, page, pageCount, items:scoped.slice((page-1)*50,page*50),
    categories:[...categories].sort(), statuses:[...statuses].sort() };
}
