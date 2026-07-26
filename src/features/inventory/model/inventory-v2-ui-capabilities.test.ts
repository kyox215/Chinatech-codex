import { describe, expect, it } from "vitest";
import { resolveInventoryV2UiCapabilities } from "./inventory-v2-ui-capabilities";

describe("resolveInventoryV2UiCapabilities", () => {
  it("keeps V2 intake unavailable when the actor cannot allocate cost", () => {
    expect(
      resolveInventoryV2UiCapabilities({
        canSellInventory: true,
        inventoryV2CommandsEnabled: true,
        inventoryV2UiEnabled: false,
      }),
    ).toEqual({ canUseIntake: false, canUseAtomicSale: true, canUseWorkflow: true });
  });

  it("does not expose an atomic sale unless both the rollout and sale permission are enabled", () => {
    expect(
      resolveInventoryV2UiCapabilities({
        canSellInventory: true,
        inventoryV2CommandsEnabled: false,
        inventoryV2UiEnabled: true,
      }),
    ).toEqual({ canUseIntake: false, canUseAtomicSale: false, canUseWorkflow: false });
  });

  it("enables both paths for an actor with intake and sale authority", () => {
    expect(
      resolveInventoryV2UiCapabilities({
        canSellInventory: true,
        inventoryV2CommandsEnabled: true,
        inventoryV2UiEnabled: true,
      }),
    ).toEqual({ canUseIntake: true, canUseAtomicSale: true, canUseWorkflow: true });
  });
});
