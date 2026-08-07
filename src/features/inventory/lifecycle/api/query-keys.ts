import { storeQueryScope } from "@/shared/lib/store-query-scope";

/**
 * Lifecycle reads are intentionally scoped by the active store.  A product id
 * can be reused across authorities in a cached browser, so the store segment
 * must remain part of every key.
 */
export const inventoryLifecycleKeys = {
  all: ["inventory-lifecycle"] as const,
  summaries: () => [...inventoryLifecycleKeys.all, "summary"] as const,
  summary: (itemId: string, storeId?: string | null) =>
    [...inventoryLifecycleKeys.summaries(), itemId, ...storeQueryScope(storeId)] as const,
  queues: () => [...inventoryLifecycleKeys.all, "queue"] as const,
  sale: (saleOrderId: string, storeId?: string | null) =>
    [...inventoryLifecycleKeys.all, "sale", saleOrderId, ...storeQueryScope(storeId)] as const,
  afterSales: (storeId?: string | null) =>
    [...inventoryLifecycleKeys.all, "after-sales", ...storeQueryScope(storeId)] as const,
  afterSalesCase: (caseId: string, storeId?: string | null) =>
    [
      ...inventoryLifecycleKeys.all,
      "after-sales-case",
      caseId,
      ...storeQueryScope(storeId),
    ] as const,
};
