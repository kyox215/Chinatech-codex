import { queryOptions } from "@tanstack/react-query";

import { getInventoryProduct, listInventoryProducts } from "@/lib/repairdesk/api";
import type { InventoryProductListFilters } from "@/lib/repairdesk/types";
import { CACHE_TIMES } from "@/lib/query-performance";

import { inventoryProductKeys } from "./query-keys";

export function inventoryProductsQueryOptions(
  filters: InventoryProductListFilters = {},
  storeId?: string | null,
) {
  return queryOptions({
    queryKey: inventoryProductKeys.list(filters, storeId),
    queryFn: ({ signal }) => listInventoryProducts(filters, { signal }),
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}

export function inventoryProductDetailQueryOptions(id: string, storeId?: string | null) {
  return queryOptions({
    queryKey: inventoryProductKeys.detail(id, storeId),
    queryFn: ({ signal }) => getInventoryProduct(id, { signal }),
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}
