"use client";
import { useContext, useEffect, useMemo } from "react";
import { BackendSnapshotContext } from "./backend-snapshot";
import { ProcurementProvider } from "./procurement/procurement-provider";
import { RetailProvider } from "./retail/retail-provider";
import { backendIdentityKey, backendScopeKey, pagePlanKey } from "@/lib/backend/read-plan";
import { reconcileBackendInitial } from "@/lib/backend/client";
import type { BackendSnapshot } from "@/lib/backend/contracts";

// The page supplies its own server snapshot on the first render, so necessary
// content remains in HTML. It does not create a second global store or own the
// root bootstrap's cleanup/recovery lifetime.
export function BackendPageData({ initial, children }: { initial: BackendSnapshot; children: React.ReactNode }) {
  const parent = useContext(BackendSnapshotContext);
  if (!parent) throw new Error("后台资料暂不可用。");
  const view = useMemo(() => ({ ...parent, server: () => initial, read: () => {
    const current = parent.read();
    if (!current?.read || !initial.read || backendIdentityKey(current.read.scope) !== backendIdentityKey(initial.read.scope)) return null;
    if (current.read.scope.memberRevision > initial.read.scope.memberRevision && backendScopeKey(current.read.scope) !== backendScopeKey(initial.read.scope)) return current;
    if (pagePlanKey(current.read.plan) !== pagePlanKey(initial.read.plan)) return initial;
    return current.revision >= initial.revision ? current : initial;
  } }), [parent, initial]);
  useEffect(() => {
    let live = true;
    // Parent bootstrap activation is a passive effect. Reconcile after the
    // entire commit so child-first effect order cannot lose the initial page.
    queueMicrotask(() => { if (live) reconcileBackendInitial(initial); });
    return () => { live = false; };
  }, [initial]);
  return <BackendSnapshotContext.Provider value={view}><ProcurementProvider><RetailProvider>{children}</RetailProvider></ProcurementProvider></BackendSnapshotContext.Provider>;
}
