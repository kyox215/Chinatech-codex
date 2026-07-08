import { describe, expect, it } from "vitest";

import {
  APPLE_IPHONE_PRICE_GUIDE,
  estimateAppleMarketPricing,
  formatAppleMarketSuggestionLabel,
  getApplePriceGuideCandidates,
  getAppleIPhoneStorageChoices,
  getAppleIPhoneStorageHint,
  getAppleIPhoneStorageOptions,
  getAppleIPhoneSeriesGroups,
} from "./apple-price-guide";

describe("apple price guide", () => {
  it("matches iPhone models and adjusts for storage", () => {
    const suggestion = estimateAppleMarketPricing({
      brand: "Apple",
      model: "iPhone 13 Pro",
      storageCapacity: "256GB",
    });

    expect(suggestion).toBeDefined();
    expect(suggestion!.matched.model).toBe("iPhone 13 Pro");
    expect(suggestion!.requestedStorageGb).toBe(256);
    expect(suggestion!.resaleReference).toBeGreaterThan(suggestion!.matched.refurbRetailFloorEur);
    expect(formatAppleMarketSuggestionLabel(suggestion!)).toBe("iPhone 13 Pro 256GB");
  });

  it("does not return a guide for non-Apple devices", () => {
    expect(
      estimateAppleMarketPricing({
        brand: "Samsung",
        model: "Galaxy S23",
        storageCapacity: "256GB",
      }),
    ).toBeUndefined();
  });

  it("returns bounded candidate results for model search", () => {
    const candidates = getApplePriceGuideCandidates("Pro", 4);
    expect(candidates).toHaveLength(4);
    expect(candidates.every((entry) => entry.model.includes("Pro"))).toBe(true);
  });

  it("covers iPhone 8 through the current iPhone family", () => {
    const models = APPLE_IPHONE_PRICE_GUIDE.map((entry) => entry.model);
    expect(models).toContain("iPhone 8");
    expect(models).toContain("iPhone X");
    expect(models).toContain("iPhone 17e");
    expect(models).toContain("iPhone Air");
    expect(models).toContain("iPhone 17 Pro Max");
  });

  it("exposes storage options for the selected model", () => {
    expect(getAppleIPhoneStorageOptions("iPhone 17 Pro Max")).toEqual([256, 512, 1024]);
  });

  it("keeps 128GB only on 64GB-base models that officially shipped with it", () => {
    expect(getAppleIPhoneStorageOptions("iPhone XR")).toEqual([64, 128, 256]);
    expect(getAppleIPhoneStorageOptions("iPhone 11")).toEqual([64, 128, 256]);
    expect(getAppleIPhoneStorageOptions("iPhone 12 mini")).toEqual([64, 128, 256]);
    expect(getAppleIPhoneStorageOptions("iPhone 11 Pro")).toEqual([64, 256, 512]);
  });

  it("explains 64GB models that do not have a 128GB official option", () => {
    expect(getAppleIPhoneStorageHint("iPhone 11 Pro")).toContain("疑似扩容");
    expect(getAppleIPhoneStorageHint("iPhone 11")).not.toContain("疑似扩容");
  });

  it("allows common unofficial used-market storage while keeping official options separate", () => {
    expect(getAppleIPhoneStorageOptions("iPhone 11 Pro")).toEqual([64, 256, 512]);
    expect(getAppleIPhoneStorageChoices("iPhone 11 Pro")).toEqual([
      { valueGb: 64, label: "64GB", official: true },
      {
        valueGb: 128,
        label: "128GB 非官方",
        official: false,
        note: "二手市场常见扩容/翻新容量，非 Apple 官方出厂容量",
      },
      { valueGb: 256, label: "256GB", official: true },
      { valueGb: 512, label: "512GB", official: true },
    ]);
  });

  it("lowers confidence for unofficial storage selections", () => {
    const suggestion = estimateAppleMarketPricing({
      brand: "Apple",
      model: "iPhone 11 Pro",
      storageCapacity: "128GB",
    });

    expect(suggestion?.confidence).toBe("low");
    expect(suggestion?.storagePremium).toBe(0);
    expect(suggestion?.notes.join(" ")).toContain("疑似扩容");
  });

  it("groups models by guided iPhone series", () => {
    const groups = getAppleIPhoneSeriesGroups();
    expect(groups[0]?.label).toBe("17 / Air");
    expect(groups.some((group) => group.models.some((model) => model.model === "iPhone 8"))).toBe(
      true,
    );
  });
});
