import { describe, expect, it } from "vitest";

import {
  canCancelScheduledPurge,
  canTransitionStoreLifecycle,
  isStoreLifecycleWritable,
  storePurgeStepOrder,
} from "@/features/stores/model/store-lifecycle";

describe("store lifecycle state machine", () => {
  it("supports reversible close before purge", () => {
    expect(canTransitionStoreLifecycle("active", "closing")).toBe(true);
    expect(canTransitionStoreLifecycle("closing", "active")).toBe(true);
    expect(canTransitionStoreLifecycle("closing", "archived")).toBe(true);
    expect(canTransitionStoreLifecycle("archived", "active")).toBe(true);
  });

  it("does not allow skipping archive, export, or purge scheduling", () => {
    expect(canTransitionStoreLifecycle("active", "purging")).toBe(false);
    expect(canTransitionStoreLifecycle("archived", "purging")).toBe(false);
    expect(canTransitionStoreLifecycle("purged", "active")).toBe(false);
  });

  it("freezes writes outside active and stops purge cancellation after destruction starts", () => {
    expect(isStoreLifecycleWritable("active")).toBe(true);
    expect(isStoreLifecycleWritable("closing")).toBe(false);
    expect(
      canCancelScheduledPurge({ phase: "purge_scheduled", destructiveStepStarted: false }),
    ).toBe(true);
    expect(
      canCancelScheduledPurge({ phase: "purge_scheduled", destructiveStepStarted: true }),
    ).toBe(false);
  });

  it("deletes Storage before database rows and writes the tombstone last", () => {
    expect(storePurgeStepOrder.indexOf("verify_storage_zero")).toBeLessThan(
      storePurgeStepOrder.indexOf("database_delete_batches"),
    );
    expect(storePurgeStepOrder.at(-2)).toBe("write_tombstone");
    expect(storePurgeStepOrder.at(-1)).toBe("complete");
  });
});
