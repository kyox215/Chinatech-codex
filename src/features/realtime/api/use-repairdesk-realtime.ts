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
  syncRepairDeskRealtimeAuth,
} from "./realtime-client";

export type UseRepairDeskRealtimeOptions = {
  enabled?: boolean;
  storeId?: string | null;
  domains?: readonly RepairDeskRealtimeDomain[];
  client?: RepairDeskRealtimeClient;
  onEvent: (event: RepairDeskRealtimeEvent) => void;
  onStatus?: (
    domain: RepairDeskRealtimeDomain,
    status: RepairDeskRealtimeStatus,
    error?: unknown,
  ) => void;
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
    const unsubscribe: Array<() => void> = [];
    let disposed = false;
    let subscribed = false;
    let authRetryTimer: ReturnType<typeof setTimeout> | null = null;

    const subscribe = () => {
      if (disposed || subscribed) return;
      subscribed = true;
      domainList.forEach((domain) => {
        const cleanup = subscribeToRepairDeskRealtimeDomain({
          client: realtimeClient,
          storeId,
          domain,
          onEvent: (event) => {
            if (!disposed) onEvent(event);
          },
          onStatus: (status, error) => {
            if (!disposed) onStatus?.(domain, status, error);
          },
        });
        if (cleanup) unsubscribe.push(cleanup);
      });
    };

    const reportAuthFailure = (error: unknown, attempt: number) => {
      if (disposed) return;
      domainList.forEach((domain) => onStatus?.(domain, "CHANNEL_ERROR", error));
      const retryDelay = Math.min(30_000, 1_000 * 2 ** attempt);
      authRetryTimer = setTimeout(() => syncAuth(attempt + 1), retryDelay);
    };

    const syncAuth = (attempt: number) => {
      try {
        const authSync = syncRepairDeskRealtimeAuth(realtimeClient);
        if (isPromiseLike(authSync)) {
          void Promise.resolve(authSync).then(subscribe, (error: unknown) => {
            reportAuthFailure(error, attempt);
          });
        } else {
          subscribe();
        }
      } catch (error) {
        reportAuthFailure(error, attempt);
      }
    };

    syncAuth(0);

    return () => {
      disposed = true;
      if (authRetryTimer) clearTimeout(authRetryTimer);
      unsubscribe.forEach((cleanup) => cleanup());
    };
    // domainList is represented by domainsKey so callers can pass stable literals or arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, domainsKey, enabled, onEvent, onStatus, storeId]);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value && typeof value === "object" && "then" in value);
}
