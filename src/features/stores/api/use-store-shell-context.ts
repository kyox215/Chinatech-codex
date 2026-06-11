"use client";

import { useQuery } from "@tanstack/react-query";

import { getOnboardingStatus, getStoreContext } from "@/lib/repairdesk/api";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";

export function useStoreShellContext() {
  const onboardingQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: getOnboardingStatus,
    retry: false,
    staleTime: 30_000,
  });

  const hasActiveStore = Boolean(onboardingQuery.data?.activeStore);
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: getStoreContext,
    enabled: hasActiveStore,
    retry: false,
    staleTime: 30_000,
  });

  return {
    activeStore: storeContextQuery.data?.activeStore ?? onboardingQuery.data?.activeStore,
    stores: storeContextQuery.data?.stores ?? onboardingQuery.data?.stores ?? [],
    isPlatformAdmin: Boolean(onboardingQuery.data?.isPlatformAdmin),
    isLoading: onboardingQuery.isLoading || (hasActiveStore && storeContextQuery.isLoading),
    isError: onboardingQuery.isError || storeContextQuery.isError,
  };
}
