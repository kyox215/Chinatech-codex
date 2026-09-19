"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { QueryFreshnessCoordinator } from "../model/query-freshness-coordinator";

export type RealtimeConnectionState =
  | "disabled"
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "synced";

export type RealtimeSyncContextValue = {
  connectionState: RealtimeConnectionState;
  coordinator: QueryFreshnessCoordinator | null;
  lastSyncedAt: number | null;
  storeId: string | null;
};

const RealtimeSyncContext = createContext<RealtimeSyncContextValue>({
  connectionState: "disabled",
  coordinator: null,
  lastSyncedAt: null,
  storeId: null,
});

type RealtimeCoordinatorValue = Pick<RealtimeSyncContextValue, "coordinator" | "storeId">;
const RealtimeCoordinatorContext = createContext<RealtimeCoordinatorValue>({
  coordinator: null,
  storeId: null,
});

export function RealtimeSyncContextProvider({
  value,
  children,
}: {
  value: RealtimeSyncContextValue;
  children?: ReactNode;
}) {
  const coordinatorValue = useMemo(
    () => ({ coordinator: value.coordinator, storeId: value.storeId }),
    [value.coordinator, value.storeId],
  );
  return (
    <RealtimeCoordinatorContext.Provider value={coordinatorValue}>
      <RealtimeSyncContext.Provider value={value}>{children}</RealtimeSyncContext.Provider>
    </RealtimeCoordinatorContext.Provider>
  );
}

/** Business screens need refresh coordination, not every connection-status tick. */
export function useRealtimeCoordinator() {
  return useContext(RealtimeCoordinatorContext);
}

export function useRealtimeSync() {
  return useContext(RealtimeSyncContext);
}
