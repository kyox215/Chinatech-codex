"use client";

import { useLayoutEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAiAssistantCapabilities,
  getOnboardingStatus,
  getShellBootstrap,
  getStoreContext,
  isRepairDeskAuthorizationError,
  RepairDeskApiError,
} from "@/lib/repairdesk/api";
import { aiAssistantKeys } from "@/features/ai-assistant/api";
import type { AiAssistantCapabilities } from "@/features/ai-assistant/model/contracts";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import type { ShellBootstrap } from "@/features/stores/model/shell-bootstrap";
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
  const bootstrapQuery = useQuery({
    queryKey: storesKeys.bootstrap,
    queryFn: async ({ signal }) => {
      const bootstrap = await loadShellBootstrap(signal);
      queryClient.setQueryData(platformKeys.onboardingStatus, bootstrap.onboarding);
      queryClient.setQueryData(storesKeys.context, bootstrap.storeContext);
      queryClient.setQueryData(
        aiAssistantKeys.capabilities(bootstrap.storeContext.activeStore?.id),
        bootstrap.aiCapabilities,
      );
      return bootstrap;
    },
    retry: false,
    staleTime: CACHE_TIMES.shell,
  });
  const onboardingQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    enabled: bootstrapQuery.isSuccess,
    retry: false,
    staleTime: CACHE_TIMES.shell,
    refetchOnMount: false,
  });

  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: ({ signal }) => getStoreContext({ signal }),
    enabled: bootstrapQuery.isSuccess && onboardingQuery.isSuccess,
    retry: false,
    // Bootstrap owns cold-start hydration; the top-level bridge keeps the narrower authority poll.
    staleTime: monitorAuthority ? 15_000 : CACHE_TIMES.shell,
    refetchInterval:
      monitorAuthority && Boolean(onboardingQuery.data?.activeStore) ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    refetchOnReconnect: monitorAuthority ? "always" : false,
    refetchOnWindowFocus: monitorAuthority ? "always" : false,
  });
  const authorityLost =
    isRepairDeskAuthorizationError(bootstrapQuery.error) ||
    isRepairDeskAuthorizationError(onboardingQuery.error) ||
    isRepairDeskAuthorizationError(storeContextQuery.error);
  const shellContext = resolveStoreShellContext({
    onboardingStatus: onboardingQuery.data,
    storeContext: storeContextQuery.data,
    onboardingLoading: bootstrapQuery.isLoading || onboardingQuery.isLoading,
    storeContextLoading: bootstrapQuery.isLoading || storeContextQuery.isLoading,
    onboardingError: bootstrapQuery.isError || onboardingQuery.isError,
    storeContextError: bootstrapQuery.isError || storeContextQuery.isError,
    authorityLost,
  });
  const authorityFingerprint = shellContext.authorityFingerprint;

  useLayoutEffect(() => {
    if (shellContext.isLoading) return;
    const previous = authorityFingerprintByQueryClient.get(queryClient);
    authorityFingerprintByQueryClient.set(queryClient, authorityFingerprint);
    if (authorityLost) {
      clearAuthorityLostQueryCache(queryClient);
      return;
    }
    if (!previous || previous === authorityFingerprint) return;
    void clearAuthoritySensitiveQueryCache(queryClient);
  }, [authorityFingerprint, authorityLost, queryClient, shellContext.isLoading]);

  return {
    ...shellContext,
    retry: async () => {
      await bootstrapQuery.refetch();
    },
  };
}

async function loadShellBootstrap(signal?: AbortSignal): Promise<ShellBootstrap> {
  try {
    return await getShellBootstrap({ signal });
  } catch (error) {
    if (!isMissingBootstrapEndpoint(error)) throw error;
    const [onboarding, storeContext] = await Promise.all([
      getOnboardingStatus({ signal }),
      getStoreContext({ signal }),
    ]);
    const aiCapabilities = storeContext.activeStore
      ? await getAiAssistantCapabilities({ signal })
      : disabledAiCapabilities();
    return { onboarding, storeContext, aiCapabilities, generatedAt: new Date().toISOString() };
  }
}

function isMissingBootstrapEndpoint(error: unknown) {
  return error instanceof RepairDeskApiError && [404, 405, 501].includes(error.status);
}

function disabledAiCapabilities(): AiAssistantCapabilities {
  return {
    canUseOrderAssistant: false,
    canUseOrderInlineActions: false,
    canUseVisionIntake: false,
    canApplyInventoryDraft: false,
    reason: "feature_off",
  };
}
