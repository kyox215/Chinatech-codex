import { queryOptions } from "@tanstack/react-query";

import { getAiAssistantCapabilities, getAiAssistantUsageSummary } from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";
import { aiAssistantKeys } from "./query-keys";

export function aiAssistantCapabilitiesQueryOptions(storeId?: string | null) {
  return queryOptions({
    queryKey: aiAssistantKeys.capabilities(storeId),
    queryFn: ({ signal }) => getAiAssistantCapabilities({ signal }),
    staleTime: CACHE_TIMES.options,
  });
}

export function aiAssistantUsageQueryOptions(storeId?: string | null) {
  return queryOptions({
    queryKey: aiAssistantKeys.usage(storeId),
    queryFn: ({ signal }) => getAiAssistantUsageSummary({ signal }),
    staleTime: CACHE_TIMES.settings,
  });
}
