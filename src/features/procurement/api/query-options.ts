import { queryOptions } from "@tanstack/react-query";

import { getPartsProcurement, readCostCurrencySettings } from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";

import { procurementKeys } from "./query-keys";

export function partsProcurementQueryOptions(storeId?: string | null, orderId?: string) {
  return queryOptions({
    queryKey: procurementKeys.overview(storeId, orderId),
    queryFn: ({ signal }) => getPartsProcurement(orderId, { signal }),
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}

export function costCurrencyQueryOptions(
  storeId: string,
  mode: "settings" | "options" = "options",
) {
  return queryOptions({
    queryKey: procurementKeys.costCurrencies(storeId, mode),
    queryFn: () => readCostCurrencySettings({ expected_store_id: storeId, mode }),
    staleTime: CACHE_TIMES.settings,
    retry: 1,
  });
}
