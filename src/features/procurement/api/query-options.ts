import { queryOptions } from "@tanstack/react-query";

import { getPartsProcurement } from "@/lib/repairdesk/api";
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
