import { describe, expect, it } from "vitest";

import { inventoryProductKeys } from "./query-keys";
import { inventoryProductsQueryOptions } from "./query-options";

describe("inventoryProductsQueryOptions", () => {
  it("keeps previous filtered data only inside the same store scope", () => {
    const previousData = { marker: "store-a-products" };
    const sameStoreOptions = inventoryProductsQueryOptions({ search: "iphone" }, "store-a");
    const otherStoreOptions = inventoryProductsQueryOptions({ search: "iphone" }, "store-b");
    const previousQuery = {
      queryKey: inventoryProductKeys.list({ search: "ipad" }, "store-a"),
    };

    expect(resolvePlaceholder(sameStoreOptions.placeholderData, previousData, previousQuery)).toBe(
      previousData,
    );
    expect(
      resolvePlaceholder(otherStoreOptions.placeholderData, previousData, previousQuery),
    ).toBeUndefined();
  });

  it("does not keep unscoped previous data", () => {
    const options = inventoryProductsQueryOptions({}, "store-a");
    const previousQuery = { queryKey: inventoryProductKeys.list({}, null) };

    expect(resolvePlaceholder(options.placeholderData, { marker: "unscoped" }, previousQuery)).toBe(
      undefined,
    );
  });
});

function resolvePlaceholder(
  placeholderData: unknown,
  previousData: unknown,
  previousQuery: { queryKey: readonly unknown[] },
) {
  if (typeof placeholderData !== "function") throw new Error("Expected placeholder callback");
  return placeholderData(previousData, previousQuery);
}
