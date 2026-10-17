"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { backendSnapshot, isBackendClient, subscribeBackend } from "@/lib/backend/client";
import type { BackendSnapshot } from "@/lib/backend/contracts";
import type { createBackendBootstrap } from "@/lib/backend/bootstrap";
import { backendDomainReady, type BackendDomain } from "@/lib/backend/read-plan";

export const BackendSnapshotContext = createContext<(ReturnType<typeof createBackendBootstrap> & { hydrated?: boolean }) | null>(null);
const noSubscription = () => () => {};

export function useBackendState() {
  const scope = useContext(BackendSnapshotContext);
  const snapshot = useSyncExternalStore(scope?.subscribe ?? subscribeBackend, scope?.read ?? backendSnapshot, scope?.server ?? (() => null));
  return { formal: Boolean(scope) || isBackendClient(), snapshot, active:scope?scope.hydrated===true&&scope.isActive():isBackendClient() };
}

export function useBackendMode() { return useBackendState().formal; }

/** Formal SSR/hydration must never run a browser-local fixture reader. */
export function useBackendStore<T>(subscribe: (listener: () => void) => () => void, read: () => T, server: T, project: (snapshot: BackendSnapshot | null) => T, domain?: BackendDomain): T {
  const backend = useBackendState();
  const preview = useSyncExternalStore(backend.formal ? noSubscription : subscribe, backend.formal ? () => server : read, () => server);
  return useMemo(() => backend.formal ? backend.snapshot && domain && !backendDomainReady(backend.snapshot, domain) ? server : project(backend.snapshot) : preview, [backend.formal, backend.snapshot, domain, server, preview, project]);
}
