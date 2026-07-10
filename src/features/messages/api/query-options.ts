import { queryOptions } from "@tanstack/react-query";

import { getStoreSettings } from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";

import { messageSettingsKeys } from "./query-keys";

export function storeSettingsQueryOptions(storeId?: string | null) {
  return queryOptions({
    queryKey: messageSettingsKeys.storeScoped(storeId),
    queryFn: ({ signal }) => getStoreSettings({ signal }),
    staleTime: CACHE_TIMES.settings,
  });
}
