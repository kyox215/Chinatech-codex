import { describe, expect, it } from "vitest";

import { resolveInventoryIntakeRoute } from "./inventory-intake-route";

describe("resolveInventoryIntakeRoute", () => {
  it.each([false, true])(
    "waits for stable store authority before choosing a route (v2=%s)",
    (inventoryV2Available) => {
      expect(
        resolveInventoryIntakeRoute({
          requested: true,
          authorityReady: false,
          inventoryV2Available,
        }),
      ).toBe("wait");
    },
  );

  it("chooses V2 only after stable authority confirms both flags", () => {
    expect(
      resolveInventoryIntakeRoute({
        requested: true,
        authorityReady: true,
        inventoryV2Available: true,
      }),
    ).toBe("v2");
  });

  it("chooses the legacy flow only after stable authority rejects V2", () => {
    expect(
      resolveInventoryIntakeRoute({
        requested: true,
        authorityReady: true,
        inventoryV2Available: false,
      }),
    ).toBe("legacy");
  });

  it("ignores navigation when no intake was requested", () => {
    expect(
      resolveInventoryIntakeRoute({
        requested: false,
        authorityReady: false,
        inventoryV2Available: false,
      }),
    ).toBe("ignore");
  });
});
