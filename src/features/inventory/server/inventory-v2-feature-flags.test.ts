import { describe, expect, it } from "vitest";

import {
  areLegacyInventoryMutationsEnabled,
  isInventoryV2CommandEnabledForStore,
  isInventoryV2ShadowReadEnabled,
  isInventoryV2ShadowReadEnabledForStore,
  isInventoryV2UiEnabledForStore,
} from "./inventory-v2-feature-flags";

describe("inventory V2 feature flags", () => {
  const enabled = {
    INVENTORY_V2_SCHEMA_READY: "1",
    INVENTORY_V2_SHADOW_READ: "1",
    INVENTORY_V2_COMMANDS: "1",
    INVENTORY_V2_UI: "1",
    INVENTORY_V2_STORE_ALLOWLIST: "store-a, store-b",
  };

  it("requires schema readiness and store allowlist for every V2 surface", () => {
    expect(isInventoryV2ShadowReadEnabled(enabled)).toBe(true);
    expect(isInventoryV2ShadowReadEnabledForStore("store-a", enabled)).toBe(true);
    expect(isInventoryV2ShadowReadEnabledForStore("store-c", enabled)).toBe(false);
    expect(isInventoryV2CommandEnabledForStore("store-a", enabled)).toBe(true);
    expect(isInventoryV2UiEnabledForStore("store-b", enabled)).toBe(true);
    expect(isInventoryV2UiEnabledForStore("store-c", enabled)).toBe(false);
    expect(
      isInventoryV2CommandEnabledForStore("store-a", {
        ...enabled,
        INVENTORY_V2_SCHEMA_READY: "0",
      }),
    ).toBe(false);
  });

  it("keeps V1 mutations enabled unless explicitly disabled", () => {
    expect(areLegacyInventoryMutationsEnabled({})).toBe(true);
    expect(areLegacyInventoryMutationsEnabled({ INVENTORY_LEGACY_MUTATIONS_ENABLED: "0" })).toBe(
      false,
    );
  });
});
