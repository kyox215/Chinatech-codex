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
import { useQuery } from "@tanstack/react-query";

import { aiAssistantCapabilitiesQueryOptions } from "@/features/ai-assistant/api";
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
  const activeStoreId = shell.activeStore?.id;
  const [open, setOpen] = useState(false);
  const capabilitiesQuery = useQuery({
    ...aiAssistantCapabilitiesQueryOptions(activeStoreId),
    enabled: Boolean(activeStoreId) && !shell.isLoading && !shell.isError,
    retry: false,
  });
  const canOpenOrderAssistant =
    capabilitiesQuery.data?.canUseOrderAssistant === true && Boolean(activeStoreId);

  useEffect(() => setOpen(false), [shell.authorityFingerprint]);

  const openAssistant = useCallback(() => {
    if (canOpenOrderAssistant) setOpen(true);
  }, [canOpenOrderAssistant]);

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
