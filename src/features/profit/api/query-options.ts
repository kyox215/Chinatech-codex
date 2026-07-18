import { queryOptions } from "@tanstack/react-query";

import { CACHE_TIMES } from "@/lib/query-performance";
import { getProfitCenter } from "@/lib/repairdesk/api";
import type { ProfitCenterInput } from "@/lib/repairdesk/types";

import { profitKeys } from "./query-keys";

export function profitCenterQueryOptions(input: ProfitCenterInput, storeId?: string | null) {
  return queryOptions({
    queryKey: profitKeys.center(input, storeId),
    queryFn: ({ signal }) => getProfitCenter(input, { signal }),
    staleTime: CACHE_TIMES.hotList,
    retry: 1,
  });
}
