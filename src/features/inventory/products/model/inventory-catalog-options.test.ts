import { describe, expect, it } from "vitest";

import type { InventoryCatalogOption } from "@/lib/repairdesk/types";

import {
  hasLearnedCatalogModel,
  learnedCatalogBrandsForCategory,
  learnedCatalogOptionsForBrand,
  mergeInventoryCatalogOptions,
} from "./inventory-catalog-options";

const learned: InventoryCatalogOption[] = [
  { category: "phone", brand: "Apple", model: "iPhone 17", source: "learned" },
  { category: "phone", brand: "Apple", model: "iPhone 16", source: "learned" },
  { category: "phone", brand: "Samsung", model: "Galaxy S25", source: "learned" },
];

describe("inventory catalog option merge", () => {
  it("keeps curated options first and deduplicates learned values case-insensitively", () => {
    expect(
      mergeInventoryCatalogOptions(
        [
          { value: "Apple", group: "常用品牌" },
          { value: "Samsung", group: "常用品牌" },
        ],
        [
          { value: "apple", group: "已录入品牌" },
          { value: "Google", group: "已录入品牌" },
        ],
      ).map((option) => option.value),
    ).toEqual(["Apple", "Samsung", "Google"]);
  });

  it("keeps learned rows inspection-neutral while filtering by current category/brand", () => {
    expect(learnedCatalogBrandsForCategory(learned, "phone").map((item) => item.value)).toEqual([
      "Apple",
      "Samsung",
    ]);
    expect(
      learnedCatalogOptionsForBrand(learned, "phone", "apple").map((item) => item.value),
    ).toEqual(["iPhone 17", "iPhone 16"]);
    expect(hasLearnedCatalogModel(learned, "phone", "Apple", "iPhone 17")).toBe(true);
    expect(hasLearnedCatalogModel(learned, "tablet", "Apple", "iPhone 17")).toBe(false);
  });
});
