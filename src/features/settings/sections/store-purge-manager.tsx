"use client";

import type { ActorStoreMembership, StoreLifecycleActionCapability } from "@/lib/repairdesk/types";

import { StorePurgeConfirmationSurface } from "./store-purge-confirmation-surface";
import { useStorePurgeManagerState } from "./store-purge-manager-state";
import { StorePurgeStatusCard, StorePurgeUnavailable } from "./store-purge-status-card";

export function StorePurgeManager({
  store,
  capability,
}: {
  store: ActorStoreMembership;
  capability: StoreLifecycleActionCapability;
}) {
  const state = useStorePurgeManagerState({ store, capability });

  if (!state.canReadStatus) {
    return <StorePurgeUnavailable code={capability.code} />;
  }

  return (
    <>
      <StorePurgeStatusCard state={state} />
      <StorePurgeConfirmationSurface state={state} />
    </>
  );
}
