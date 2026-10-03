"use client";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { BackendSnapshot } from "./contracts";
import { activateBackendPage, backendSnapshot, isBackendClient, subscribeBackend } from "./client";

export const BackendInitialContext = createContext<BackendSnapshot | null>(null);
export function useBackendState() {
  const initial = useContext(BackendInitialContext);
  return useSyncExternalStore(subscribeBackend, () => isBackendClient() ? backendSnapshot() : initial, () => initial);
}
export function useBackendMode() { return useContext(BackendInitialContext) !== null || isBackendClient(); }
export function BackendPageProvider({ initial, children }: { initial: BackendSnapshot; children: React.ReactNode }) {
  useEffect(() => { activateBackendPage(initial); }, [initial]);
  return <BackendInitialContext.Provider value={initial}>{children}</BackendInitialContext.Provider>;
}
