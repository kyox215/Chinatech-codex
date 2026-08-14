import { describe, expect, it } from "vitest";

import { inventoryCatalogSearchBodySchema } from "@/server/api/repairdesk-schemas";

describe("inventory catalog search contract", () => {
  it("accepts bounded store-neutral search input and strips surrounding whitespace", () => {
    expect(
      inventoryCatalogSearchBodySchema.parse({
        category: "phone",
        brand: " Apple ",
        query: " 17 ",
        limit: 100,
      }),
    ).toEqual({ category: "phone", brand: "Apple", query: "17", limit: 100 });
  });

  it("rejects store identity, unknown fields, empty search text, and out-of-range limits", () => {
    for (const input of [
      { category: "phone", store_id: "store-a" },
      { category: "phone", unknown: true },
      { category: "phone", brand: "   " },
      { category: "phone", query: "   " },
      { category: "phone", brand: "Star*Brand" },
      { category: "phone", query: "Model*Target" },
      { category: "phone", limit: 101 },
    ]) {
      expect(inventoryCatalogSearchBodySchema.safeParse(input).success).toBe(false);
    }
  });
});
