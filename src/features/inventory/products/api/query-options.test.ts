import { describe, expect, it } from "vitest";

import { inventoryCatalogKeys, inventoryProductKeys } from "./query-keys";
import {
  inventoryCatalogQueryOptions,
  inventoryProductsQueryOptions,
  isInventoryCatalogSearchSafe,
} from "./query-options";

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

describe("inventoryCatalogQueryOptions", () => {
  it("keeps PostgREST wildcard input on the static/manual fallback path", () => {
    expect(isInventoryCatalogSearchSafe({ category: "phone", brand: "Star*Brand" })).toBe(false);
    expect(isInventoryCatalogSearchSafe({ category: "phone", query: "Model*Target" })).toBe(false);
    expect(isInventoryCatalogSearchSafe({ category: "phone", brand: "Star Brand" })).toBe(true);
  });

  it("isolates store, category, brand, and model query scopes", () => {
    const base = { category: "phone" as const, limit: 100 };
    const storeAAll = inventoryCatalogQueryOptions(base, "store-a");
    const storeBAll = inventoryCatalogQueryOptions(base, "store-b");
    const storeAApple = inventoryCatalogQueryOptions({ ...base, brand: "Apple" }, "store-a");
    const storeAAppleQuery = inventoryCatalogQueryOptions(
      { ...base, brand: "Apple", query: "iPhone 17" },
      "store-a",
    );

    expect(storeAAll.queryKey).toEqual(inventoryCatalogKeys.search(base, "store-a"));
    expect(storeAAll.queryKey).not.toEqual(storeBAll.queryKey);
    expect(storeAAll.queryKey).not.toEqual(storeAApple.queryKey);
    expect(storeAApple.queryKey).not.toEqual(storeAAppleQuery.queryKey);
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
