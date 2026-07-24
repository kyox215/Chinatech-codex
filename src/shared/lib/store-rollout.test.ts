import { describe, expect, it } from "vitest";

import { isStoreRolloutEnabled, parseStoreRolloutList } from "./store-rollout";

describe("store rollout policy", () => {
  it("keeps an empty rollout fail closed", () => {
    expect(isStoreRolloutEnabled({ storeId: "store-a" })).toBe(false);
    expect(isStoreRolloutEnabled({ storeId: null, allStoresEnabled: "1" })).toBe(false);
    expect(isStoreRolloutEnabled({ storeId: " store-a", allStoresEnabled: "1" })).toBe(false);
  });

  it("supports exact allowlist entries without treating wildcard text as magic", () => {
    expect(isStoreRolloutEnabled({ storeId: "store-a", allowlist: "store-a, store-b" })).toBe(true);
    expect(isStoreRolloutEnabled({ storeId: "store-c", allowlist: "store-a,*" })).toBe(false);
  });

  it("allows all valid stores only through the explicit global switch", () => {
    expect(isStoreRolloutEnabled({ storeId: "store-c", allStoresEnabled: "1" })).toBe(true);
    expect(isStoreRolloutEnabled({ storeId: "store-c", allStoresEnabled: "true" })).toBe(false);
  });

  it("lets an exact denylist entry override global and allowlist rollout", () => {
    expect(
      isStoreRolloutEnabled({
        storeId: "store-b",
        allStoresEnabled: "1",
        allowlist: "store-b",
        denylist: "store-b",
      }),
    ).toBe(false);
  });

  it("normalizes comma-separated configuration", () => {
    expect(parseStoreRolloutList(" store-a, ,store-b ")).toEqual(["store-a", "store-b"]);
  });
});
