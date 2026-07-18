import type { StoreLifecyclePhase } from "@/lib/repairdesk/types";

export const STORE_ARCHIVE_SIGNED_URL_DRAIN_MS = 60 * 60 * 1000;

export const storeLifecycleTransitions: Readonly<
  Record<StoreLifecyclePhase, readonly StoreLifecyclePhase[]>
> = {
  active: ["closing"],
  closing: ["active", "archived"],
  archived: ["active", "purge_scheduled"],
  purge_scheduled: ["archived", "purging"],
  purging: ["purge_failed", "purged"],
  purge_failed: ["purging"],
  purged: [],
};

export const storePurgeStepOrder = [
  "prepare",
  "storage_delete_batches",
  "verify_storage_zero",
  "database_delete_batches",
  "verify_database_zero",
  "write_tombstone",
  "complete",
] as const;

export function canTransitionStoreLifecycle(
  current: StoreLifecyclePhase,
  target: StoreLifecyclePhase,
) {
  return storeLifecycleTransitions[current].includes(target);
}

export function isStoreLifecycleWritable(phase: StoreLifecyclePhase) {
  return phase === "active";
}

export function canCancelScheduledPurge(input: {
  phase: StoreLifecyclePhase;
  destructiveStepStarted: boolean;
}) {
  return input.phase === "purge_scheduled" && !input.destructiveStepStarted;
}
