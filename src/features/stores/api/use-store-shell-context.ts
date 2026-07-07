"use client";

import { useQuery } from "@tanstack/react-query";

import { getOnboardingStatus, getStoreContext } from "@/lib/repairdesk/api";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { resolveStoreShellContext } from "@/features/stores/model/store-shell-context";
import { CACHE_TIMES } from "@/lib/query-performance";

export function useStoreShellContext() {
  const onboardingQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    retry: false,
    staleTime: CACHE_TIMES.shell,
  });

  const hasActiveStore = Boolean(onboardingQuery.data?.activeStore);
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
    enabled: hasActiveStore,
    retry: false,
    staleTime: CACHE_TIMES.shell,
  });

  return resolveStoreShellContext({
    onboardingStatus: onboardingQuery.data,
    storeContext: storeContextQuery.data,
    onboardingLoading: onboardingQuery.isLoading,
    storeContextLoading: storeContextQuery.isLoading,
    onboardingError: onboardingQuery.isError,
    storeContextError: storeContextQuery.isError,
  });
}
