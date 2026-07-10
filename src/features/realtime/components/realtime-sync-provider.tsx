"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getRepairDeskRealtimeDomains,
  isRepairDeskRealtimeEnabled,
  type RepairDeskRealtimeStatus,
} from "@/features/realtime/api/realtime-client";
import type {
  RepairDeskRealtimeDomain,
  RepairDeskRealtimeEvent,
} from "@/features/realtime/model/realtime-events";
import { QueryFreshnessCoordinator } from "@/features/realtime/model/query-freshness-coordinator";

import type { RepairDeskRealtimeClient } from "../api/realtime-client";
import { useRepairDeskRealtime } from "../api/use-repairdesk-realtime";
import { RealtimeSyncContextProvider, type RealtimeConnectionState } from "./realtime-sync-context";

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
  const resolvedEnabled = enabled ?? isRepairDeskRealtimeEnabled();
  const domainList = useMemo(() => getRepairDeskRealtimeDomains(domains), [domains]);
  const expectedDomainsKey = domainList.join("|");
  const statusByDomainRef = useRef(new Map<RepairDeskRealtimeDomain, RepairDeskRealtimeStatus>());
  const hiddenAtRef = useRef<number | null>(null);
  const recoveryPendingRef = useRef(false);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("disabled");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const onFlushRef = useRef<() => void>(() => undefined);
  const [coordinator] = useState(
    () =>
      new QueryFreshnessCoordinator(queryClient, {
        onFlush: () => onFlushRef.current(),
      }),
  );

  const allDomainsSubscribed = useCallback(
    () => domainList.every((domain) => statusByDomainRef.current.get(domain) === "SUBSCRIBED"),
    // expectedDomainsKey represents the normalized domain list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expectedDomainsKey],
  );

  const showSyncedThenLive = useCallback(() => {
    setLastSyncedAt(Date.now());
    if (!recoveryPendingRef.current || !allDomainsSubscribed()) return;
    recoveryPendingRef.current = false;
    setConnectionState("synced");
    if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    syncedTimerRef.current = setTimeout(() => setConnectionState("live"), 3_000);
  }, [allDomainsSubscribed]);

  onFlushRef.current = showSyncedThenLive;

  const startRecovery = useCallback(
    (domain?: RepairDeskRealtimeDomain) => {
      if (!resolvedEnabled || !storeId) return;
      recoveryPendingRef.current = true;
      setConnectionState(
        typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "reconnecting",
      );
      if (domain) coordinator.markDomainDirty(domain);
      else coordinator.markAllDomainsDirty();
    },
    [coordinator, resolvedEnabled, storeId],
  );

  const handleEvent = useCallback(
    (event: RepairDeskRealtimeEvent) => {
      coordinator.handleRealtimeEvent(event);
    },
    [coordinator],
  );

  const handleStatus = useCallback(
    (domain: RepairDeskRealtimeDomain, status: RepairDeskRealtimeStatus) => {
      const previousStatus = statusByDomainRef.current.get(domain);
      statusByDomainRef.current.set(domain, status);

      if (status === "SUBSCRIBED") {
        if (
          previousStatus === "TIMED_OUT" ||
          previousStatus === "CHANNEL_ERROR" ||
          previousStatus === "CLOSED"
        ) {
          startRecovery(domain);
          return;
        }
        if (allDomainsSubscribed() && !recoveryPendingRef.current) setConnectionState("live");
        return;
      }

      if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        recoveryPendingRef.current = true;
        setConnectionState(
          typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "reconnecting",
        );
      }
    },
    [allDomainsSubscribed, startRecovery],
  );

  useEffect(() => {
    coordinator.setStore(storeId);
    statusByDomainRef.current.clear();
    recoveryPendingRef.current = false;
    if (!resolvedEnabled || !storeId) setConnectionState("disabled");
    else setConnectionState("connecting");
  }, [coordinator, expectedDomainsKey, resolvedEnabled, storeId]);

  useEffect(() => {
    const handleOffline = () => {
      coordinator.setOnline(false);
      domainList.forEach((domain) => statusByDomainRef.current.set(domain, "CLOSED"));
      recoveryPendingRef.current = true;
      if (resolvedEnabled && storeId) setConnectionState("offline");
    };
    const handleOnline = () => {
      coordinator.setOnline(true);
      startRecovery();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt && Date.now() - hiddenAt >= 30_000) startRecovery();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [coordinator, domainList, resolvedEnabled, startRecovery, storeId]);

  useEffect(
    () => () => {
      coordinator.dispose();
      if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
    },
    [coordinator],
  );

  useRepairDeskRealtime({
    client,
    domains,
    enabled: resolvedEnabled,
    storeId,
    onEvent: handleEvent,
    onStatus: handleStatus,
  });

  const contextValue = useMemo(
    () => ({ connectionState, coordinator, lastSyncedAt, storeId: storeId ?? null }),
    [connectionState, coordinator, lastSyncedAt, storeId],
  );

  return <RealtimeSyncContextProvider value={contextValue}>{children}</RealtimeSyncContextProvider>;
}
