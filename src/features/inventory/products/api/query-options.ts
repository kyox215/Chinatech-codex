import { queryOptions } from "@tanstack/react-query";

import {
  getInventoryProduct,
  getInventoryProductEditData,
  listInventoryProducts,
  searchInventoryCatalog,
} from "@/lib/repairdesk/api";
import type {
  InventoryCatalogSearchInput,
  InventoryProductListFilters,
} from "@/lib/repairdesk/types";
import { CACHE_TIMES } from "@/lib/query-performance";

import { inventoryCatalogKeys, inventoryProductKeys } from "./query-keys";

export function isInventoryCatalogSearchSafe(input: InventoryCatalogSearchInput) {
  return ![input.brand, input.query].some((value) => value?.includes("*"));
}

export function inventoryCatalogQueryOptions(
  input: InventoryCatalogSearchInput,
  storeId?: string | null,
) {
  return queryOptions({
    queryKey: inventoryCatalogKeys.search(input, storeId),
    queryFn: ({ signal }) =>
      isInventoryCatalogSearchSafe(input)
        ? searchInventoryCatalog(input, { signal })
        : Promise.resolve({ items: [] }),
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}

export function inventoryProductsQueryOptions(
  filters: InventoryProductListFilters = {},
  storeId?: string | null,
) {
  return queryOptions({
    queryKey: inventoryProductKeys.list(filters, storeId),
    queryFn: ({ signal }) => listInventoryProducts(filters, { signal }),
    placeholderData: (previousData, previousQuery) =>
      isInventoryProductListQueryForStore(previousQuery?.queryKey, storeId)
        ? previousData
        : undefined,
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}

function isInventoryProductListQueryForStore(
  queryKey: readonly unknown[] | undefined,
  storeId?: string | null,
) {
  return Boolean(
    storeId &&
    queryKey?.[0] === inventoryProductKeys.all[0] &&
    queryKey[1] === "list" &&
    queryKey[2] === "store" &&
    queryKey[3] === storeId,
  );
}

export function inventoryProductEditQueryOptions(id: string, storeId?: string | null) {
  return queryOptions({
    queryKey: inventoryProductKeys.edit(id, storeId),
    queryFn: ({ signal }) => getInventoryProductEditData(id, { signal }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
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
