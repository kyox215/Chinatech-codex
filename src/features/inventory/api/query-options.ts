import { queryOptions } from "@tanstack/react-query";

import { getInventorySummary } from "@/lib/repairdesk/api";
import type { InventoryListFilters } from "@/lib/repairdesk/types";
import { CACHE_TIMES } from "@/lib/query-performance";

import { inventoryKeys } from "./query-keys";

export const defaultInventorySummaryInput: InventoryListFilters = {};

export function inventorySummaryQueryOptions(
  filters: InventoryListFilters = defaultInventorySummaryInput,
  storeId?: string | null,
) {
  return queryOptions({
    queryKey: inventoryKeys.summary(filters, storeId),
    queryFn: ({ signal }) => getInventorySummary(filters, { signal }),
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}
