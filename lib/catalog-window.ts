import { CatalogError, type CatalogPage } from "./device-catalog";
/** Ten contiguous full-row batches. Evicted ranges must be authorized again. */
export function mergeCatalogWindow(pages: CatalogPage[], incoming: CatalogPage): CatalogPage[] {
  if (!Number.isSafeInteger(incoming.page) || incoming.page < 1 || incoming.pageSize !== 50 || !Number.isSafeInteger(incoming.total) || incoming.total < 0 || !Array.isArray(incoming.rows) || incoming.rows.length > 50 || new Set(incoming.rows.map(row => row.id)).size !== incoming.rows.length) throw new CatalogError("设备目录暂不可用，请稍后重试。", 503);
  if (!pages.length || pages[0].revision !== incoming.revision || incoming.page < pages[0].page - 1 || incoming.page > pages.at(-1)!.page + 1) return [incoming];
  if (pages.some(page => page.total !== incoming.total)) return [incoming];
  const next = [...pages.filter(page => page.page !== incoming.page), incoming].sort((a, b) => a.page - b.page);
  return incoming.page < pages[0].page ? next.slice(0, 10) : next.slice(-10);
}
