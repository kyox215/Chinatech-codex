"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  aiAssistantCapabilitiesQueryOptions,
  aiAssistantKeys,
  aiAssistantUsageQueryOptions,
} from "@/features/ai-assistant/api";
import type { AiAssistantCapabilities } from "@/features/ai-assistant/model/contracts";
import { AiAssistantSheet } from "@/features/ai-assistant/components/ai-assistant-sheet";
import { useStoreShellContext } from "@/features/stores/api/use-store-shell-context";

type AiAssistantWorkspaceContextValue = {
  capabilities?: AiAssistantCapabilities;
  canOpenOrderAssistant: boolean;
  openAssistant: () => void;
};

const AiAssistantWorkspaceContext = createContext<AiAssistantWorkspaceContextValue | null>(null);

export function AiAssistantWorkspaceProvider({ children }: { children: ReactNode }) {
  const shell = useStoreShellContext();
  const queryClient = useQueryClient();
  const activeStoreId = shell.activeStore?.id;
  const [open, setOpen] = useState(false);
  const capabilitiesQuery = useQuery({
    ...aiAssistantCapabilitiesQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId) && !shell.isLoading && !shell.isError,
    retry: false,
  });
  const canOpenOrderAssistant =
    capabilitiesQuery.data?.canUseOrderAssistant === true && Boolean(activeStoreId);
  const canReadAiUsage = shell.permissions?.canReadAggregateFinance === true;
  const usageQuery = useQuery({
    ...aiAssistantUsageQueryOptions(activeStoreId),
    enabled: open && Boolean(activeStoreId) && canReadAiUsage,
    retry: false,
  });

  useEffect(() => setOpen(false), [shell.authorityFingerprint]);

  const openAssistant = useCallback(() => {
    if (canOpenOrderAssistant) setOpen(true);
  }, [canOpenOrderAssistant]);

  const refreshAiUsage = useCallback(() => {
    if (!activeStoreId || !canReadAiUsage) return;
    void queryClient.invalidateQueries({
      queryKey: aiAssistantKeys.usage(activeStoreId),
      exact: true,
    });
  }, [activeStoreId, canReadAiUsage, queryClient]);

  const value = useMemo<AiAssistantWorkspaceContextValue>(
    () => ({ capabilities: capabilitiesQuery.data, canOpenOrderAssistant, openAssistant }),
    [canOpenOrderAssistant, capabilitiesQuery.data, openAssistant],
  );

  return (
    <AiAssistantWorkspaceContext.Provider value={value}>
      {children}
      <AiAssistantSheet
        key={shell.authorityFingerprint}
        open={open}
        onOpenChange={setOpen}
        capabilities={capabilitiesQuery.data}
        capabilitiesLoading={capabilitiesQuery.isLoading}
        capabilitiesError={capabilitiesQuery.isError}
        onRetryCapabilities={() => void capabilitiesQuery.refetch()}
        canReadUsage={canReadAiUsage}
        usage={usageQuery.data}
        usageLoading={usageQuery.isLoading}
        usageError={usageQuery.isError}
        onRetryUsage={() => void usageQuery.refetch()}
        onModelUsageChanged={refreshAiUsage}
        storeKey={shell.authorityFingerprint}
      />
    </AiAssistantWorkspaceContext.Provider>
  );
}

export function useAiAssistantWorkspace() {
  const context = useContext(AiAssistantWorkspaceContext);
  if (!context) {
    throw new Error("useAiAssistantWorkspace must be used inside AiAssistantWorkspaceProvider");
  }
  return context;
}
