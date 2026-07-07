import { useEffect } from "react";

import type {
  RepairDeskRealtimeDomain,
  RepairDeskRealtimeEvent,
} from "@/features/realtime/model/realtime-events";

import {
  createRepairDeskRealtimeClient,
  getRepairDeskRealtimeDomains,
  isRepairDeskRealtimeEnabled,
  subscribeToRepairDeskRealtimeDomain,
  type RepairDeskRealtimeClient,
  type RepairDeskRealtimeStatus,
} from "./realtime-client";

export type UseRepairDeskRealtimeOptions = {
  enabled?: boolean;
  storeId?: string | null;
  domains?: readonly RepairDeskRealtimeDomain[];
  client?: RepairDeskRealtimeClient;
  onEvent: (event: RepairDeskRealtimeEvent) => void;
  onStatus?: (status: RepairDeskRealtimeStatus, error?: unknown) => void;
};

export function useRepairDeskRealtime({
  enabled = isRepairDeskRealtimeEnabled(),
  storeId,
  domains,
  client,
  onEvent,
  onStatus,
}: UseRepairDeskRealtimeOptions) {
  const domainList = getRepairDeskRealtimeDomains(domains);
  const domainsKey = domainList.join("|");

  useEffect(() => {
    if (!enabled || !storeId) return;

    const realtimeClient = client ?? createRepairDeskRealtimeClient();
    const unsubscribe = domainList
      .map((domain) =>
        subscribeToRepairDeskRealtimeDomain({
          client: realtimeClient,
          storeId,
          domain,
          onEvent,
          onStatus,
        }),
      )
      .filter((cleanup): cleanup is () => void => Boolean(cleanup));

    return () => {
      unsubscribe.forEach((cleanup) => cleanup());
    };
    // domainList is represented by domainsKey so callers can pass stable literals or arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, domainsKey, enabled, onEvent, onStatus, storeId]);
}
