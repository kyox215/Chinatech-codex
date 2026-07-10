"use client";

import { createContext, useContext } from "react";

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

export const RealtimeSyncContextProvider = RealtimeSyncContext.Provider;

export function useRealtimeSync() {
  return useContext(RealtimeSyncContext);
}
