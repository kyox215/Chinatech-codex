import { queryOptions } from "@tanstack/react-query";

import { getAiAssistantCapabilities } from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";
import { aiAssistantKeys } from "./query-keys";

export function aiAssistantCapabilitiesQueryOptions(storeId?: string | null) {
  return queryOptions({
    queryKey: aiAssistantKeys.capabilities(storeId),
    queryFn: ({ signal }) => getAiAssistantCapabilities({ signal }),
    staleTime: CACHE_TIMES.options,
  });
}
