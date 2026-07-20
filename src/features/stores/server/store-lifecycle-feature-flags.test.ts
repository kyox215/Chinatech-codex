import { describe, expect, it } from "vitest";

import {
  isStoreLifecycleEnforcementEnabled,
  isStoreLifecycleExportWorkerEnabled,
  isStoreLifecycleMutationEnabled,
  isStoreLifecycleMutationSafeEnabled,
  isStoreLifecyclePurgeWorkerEnabled,
  isStoreLifecyclePurgeSchedulingEnabled,
} from "./store-lifecycle-feature-flags";

describe("store lifecycle feature flags", () => {
  it("keeps enforcement and mutations fail-closed unless explicitly enabled", () => {
    expect(isStoreLifecycleEnforcementEnabled({})).toBe(false);
    expect(isStoreLifecycleMutationEnabled({})).toBe(false);
    expect(isStoreLifecycleExportWorkerEnabled({})).toBe(false);
    expect(isStoreLifecyclePurgeWorkerEnabled({})).toBe(false);
    expect(isStoreLifecyclePurgeSchedulingEnabled({})).toBe(false);
    expect(
      isStoreLifecycleEnforcementEnabled({ STORE_LIFECYCLE_ENFORCEMENT_ENABLED: "true" }),
    ).toBe(false);
    expect(isStoreLifecycleMutationEnabled({ STORE_LIFECYCLE_MUTATIONS_ENABLED: "true" })).toBe(
      false,
    );
    expect(isStoreLifecycleEnforcementEnabled({ STORE_LIFECYCLE_ENFORCEMENT_ENABLED: "1" })).toBe(
      true,
    );
    expect(isStoreLifecycleMutationEnabled({ STORE_LIFECYCLE_MUTATIONS_ENABLED: "1" })).toBe(true);
    expect(
      isStoreLifecycleExportWorkerEnabled({ STORE_LIFECYCLE_EXPORT_WORKER_ENABLED: "1" }),
    ).toBe(true);
    expect(isStoreLifecyclePurgeWorkerEnabled({ STORE_LIFECYCLE_PURGE_WORKER_ENABLED: "1" })).toBe(
      true,
    );
    expect(
      isStoreLifecyclePurgeSchedulingEnabled({
        STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED: "1",
      }),
    ).toBe(true);
  });

  it("allows mutations only after enforcement is already enabled", () => {
    expect(isStoreLifecycleMutationSafeEnabled({})).toBe(false);
    expect(isStoreLifecycleMutationSafeEnabled({ STORE_LIFECYCLE_MUTATIONS_ENABLED: "1" })).toBe(
      false,
    );
    expect(isStoreLifecycleMutationSafeEnabled({ STORE_LIFECYCLE_ENFORCEMENT_ENABLED: "1" })).toBe(
      false,
    );
    expect(
      isStoreLifecycleMutationSafeEnabled({
        STORE_LIFECYCLE_ENFORCEMENT_ENABLED: "1",
        STORE_LIFECYCLE_MUTATIONS_ENABLED: "1",
      }),
    ).toBe(true);
  });
});
