"use client";

import { useLayoutEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getOnboardingStatus,
  getStoreContext,
  isRepairDeskAuthorizationError,
} from "@/lib/repairdesk/api";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  resolveStoreShellContext,
  type StoreShellContextSnapshot,
} from "@/features/stores/model/store-shell-context";
import { CACHE_TIMES } from "@/lib/query-performance";
import {
  clearAuthorityLostQueryCache,
  clearAuthoritySensitiveQueryCache,
} from "@/features/stores/api/tenant-cache";

const authorityFingerprintByQueryClient = new WeakMap<object, string>();

export function useStoreShellContext({
  monitorAuthority = false,
}: { monitorAuthority?: boolean } = {}): StoreShellContextSnapshot & {
  retry?: () => Promise<void>;
} {
  const queryClient = useQueryClient();
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
    // This hook is mounted by many screens; only the top-level bridge owns polling.
    staleTime: monitorAuthority ? 15_000 : CACHE_TIMES.shell,
    refetchInterval: monitorAuthority && hasActiveStore ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnMount: monitorAuthority ? "always" : true,
    refetchOnReconnect: monitorAuthority ? "always" : false,
    refetchOnWindowFocus: monitorAuthority ? "always" : false,
  });
  const authorityLost =
    isRepairDeskAuthorizationError(onboardingQuery.error) ||
    isRepairDeskAuthorizationError(storeContextQuery.error);
  const shellContext = resolveStoreShellContext({
    onboardingStatus: onboardingQuery.data,
    storeContext: storeContextQuery.data,
    onboardingLoading: onboardingQuery.isLoading,
    storeContextLoading: storeContextQuery.isLoading,
    onboardingError: onboardingQuery.isError,
    storeContextError: storeContextQuery.isError,
    authorityLost,
  });
  const authorityFingerprint = shellContext.authorityFingerprint;

  useLayoutEffect(() => {
    const previous = authorityFingerprintByQueryClient.get(queryClient);
    authorityFingerprintByQueryClient.set(queryClient, authorityFingerprint);
    if (authorityLost) {
      clearAuthorityLostQueryCache(queryClient);
      return;
    }
    if (!previous || previous === authorityFingerprint) return;
    void clearAuthoritySensitiveQueryCache(queryClient);
  }, [authorityFingerprint, authorityLost, queryClient]);

  return {
    ...shellContext,
    retry: async () => {
      await onboardingQuery.refetch();
      if (hasActiveStore) await storeContextQuery.refetch();
    },
  };
}
