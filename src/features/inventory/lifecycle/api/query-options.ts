import { queryOptions } from "@tanstack/react-query";

import {
  readInventoryLifecycleAfterSalesCase,
  readInventoryLifecycleAfterSalesQueue,
  readInventoryLifecycleSale,
  readInventoryLifecycleSummary,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";

import { inventoryLifecycleKeys } from "./query-keys";

export function inventoryLifecycleSummaryQueryOptions(itemId: string, storeId?: string | null) {
  return queryOptions({
    queryKey: inventoryLifecycleKeys.summary(itemId, storeId),
    queryFn: () => readInventoryLifecycleSummary(itemId),
    staleTime: CACHE_TIMES.hotList,
    retry: false,
  });
}

export function inventoryLifecycleSaleQueryOptions(id: string, storeId?: string | null) {
  return queryOptions({
    queryKey: inventoryLifecycleKeys.sale(id, storeId),
    queryFn: () => readInventoryLifecycleSale(id),
    staleTime: CACHE_TIMES.hotList,
    retry: false,
  });
}

export function inventoryLifecycleAfterSalesQueryOptions(storeId?: string | null) {
  return queryOptions({
    queryKey: inventoryLifecycleKeys.afterSales(storeId),
    queryFn: readInventoryLifecycleAfterSalesQueue,
    staleTime: CACHE_TIMES.hotList,
    retry: false,
  });
}

export function inventoryLifecycleAfterSalesCaseQueryOptions(id: string, storeId?: string | null) {
  return queryOptions({
    queryKey: inventoryLifecycleKeys.afterSalesCase(id, storeId),
    queryFn: () => readInventoryLifecycleAfterSalesCase(id),
    staleTime: CACHE_TIMES.hotList,
    retry: false,
  });
}
