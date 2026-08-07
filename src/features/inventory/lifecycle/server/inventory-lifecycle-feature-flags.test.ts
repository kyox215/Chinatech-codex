import { describe, expect, it } from "vitest";

import {
  InventoryLifecycleFeatureDisabledError,
  assertInventoryLifecycleReadEnabled,
  isInventoryLifecycleCommandEnabledForStore,
  isInventoryLifecycleReadEnabledForStore,
  isInventoryLifecycleUiEnabled,
} from "./inventory-lifecycle-feature-flags";

describe("inventory lifecycle feature flags", () => {
  const enabled = {
    INVENTORY_LIFECYCLE_SCHEMA_READY: "1",
    INVENTORY_LIFECYCLE_COMMANDS: "1",
    INVENTORY_LIFECYCLE_UI: "1",
    INVENTORY_LIFECYCLE_STORE_ALLOWLIST: "store-a",
  };

  it("fails closed without schema, command flag, or exact store allowlist", () => {
    expect(isInventoryLifecycleCommandEnabledForStore("store-a", enabled)).toBe(true);
    expect(isInventoryLifecycleCommandEnabledForStore("store-b", enabled)).toBe(false);
    expect(
      isInventoryLifecycleCommandEnabledForStore("store-a", {
        ...enabled,
        INVENTORY_LIFECYCLE_SCHEMA_READY: "0",
      }),
    ).toBe(false);
  });

  it("keeps UI independent and dormant by default", () => {
    expect(isInventoryLifecycleUiEnabled({})).toBe(false);
    expect(isInventoryLifecycleUiEnabled(enabled)).toBe(true);
    expect(isInventoryLifecycleReadEnabledForStore("store-a", enabled)).toBe(true);
    expect(
      isInventoryLifecycleReadEnabledForStore("store-a", {
        ...enabled,
        INVENTORY_LIFECYCLE_UI: "0",
      }),
    ).toBe(false);
    expect(() => assertInventoryLifecycleReadEnabled("store-a")).toThrow(
      InventoryLifecycleFeatureDisabledError,
    );
  });
});
