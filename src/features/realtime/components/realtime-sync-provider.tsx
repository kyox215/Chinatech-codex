"use client";

import { useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RepairDeskRealtimeDomain } from "@/features/realtime/model/realtime-events";
import { getRepairDeskRealtimeInvalidationTargets } from "@/features/realtime/model/query-invalidation-map";

import type { RepairDeskRealtimeClient } from "../api/realtime-client";
import { useRepairDeskRealtime } from "../api/use-repairdesk-realtime";

export type RealtimeSyncProviderProps = {
  children?: ReactNode;
  client?: RepairDeskRealtimeClient;
  domains?: readonly RepairDeskRealtimeDomain[];
  enabled?: boolean;
  storeId?: string | null;
};

export function RealtimeSyncProvider({
  children = null,
  client,
  domains,
  enabled,
  storeId,
}: RealtimeSyncProviderProps) {
  const queryClient = useQueryClient();
  const handleEvent = useCallback(
    (event: Parameters<typeof getRepairDeskRealtimeInvalidationTargets>[0]) => {
      getRepairDeskRealtimeInvalidationTargets(event).forEach(({ queryKey }) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    },
    [queryClient],
  );

  useRepairDeskRealtime({
    client,
    domains,
    enabled,
    storeId,
    onEvent: handleEvent,
  });

  return children;
}
