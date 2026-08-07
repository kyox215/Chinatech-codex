import { describe, expect, it } from "vitest";

import { EU_PHONE_MODELS } from "./eu-phone-catalog";
import {
  INVENTORY_PRODUCT_REFERENCE_IMAGES,
  inventoryProductColorStyle,
  matchInventoryProductColor,
  matchInventoryProductReference,
} from "./inventory-product-reference-image";

describe("inventory product reference images", () => {
  it.each([
    ["Nintendo", "Switch OLED", "switch"],
    ["任天堂", "Nintendo Switch Lite", "switch"],
    ["Sony", "PS4 Slim", "ps4"],
    ["PlayStation", "PlayStation 4 Pro", "ps4"],
    ["Sony", "PlayStation 5 Slim", "ps5"],
    ["Apple", "iPhone 7 Plus", "iphone-classic"],
    ["Apple", "iPhone SE (3rd generation)", "iphone-classic"],
    ["Apple", "iPhone XS Max", "iphone-standard"],
    ["Apple", "iPhone 14", "iphone-standard"],
    ["Apple", "iPhone 14 Pro", "iphone-modern"],
    ["Apple", "iPhone 15 Pro Max", "iphone-modern"],
    ["Apple", "iPhone 17 Air", "iphone-modern"],
    ["Apple", "iPhone 17e", "iphone-modern"],
  ] as const)("matches %s %s to %s", (brand, model, family) => {
    expect(matchInventoryProductReference({ brand, model })?.family).toBe(family);
  });

  it("does not match unrelated devices or let Sony model numbers impersonate consoles", () => {
    expect(
      matchInventoryProductReference({ brand: "Samsung", model: "Galaxy S24" }),
    ).toBeUndefined();
    expect(matchInventoryProductReference({ brand: "Sony", model: "Xperia 5 V" })).toBeUndefined();
    expect(
      matchInventoryProductReference({ brand: "Apple", model: 'MacBook Air M2 13"' }),
    ).toBeUndefined();
    expect(matchInventoryProductReference({ brand: "Apple", model: "iPad Air 5" })).toBeUndefined();
    expect(matchInventoryProductReference({ brand: "Nintendo", model: "Wii U" })).toBeUndefined();
    expect(matchInventoryProductReference({ brand: "Nintendo", model: "3DS XL" })).toBeUndefined();
  });

  it("resolves Apple colors from catalog ids, Chinese names, English names, and legacy specs", () => {
    expect(
      matchInventoryProductColor({
        brand: "Apple",
        model: "iPhone 15 Pro",
        color: "natural-titanium",
        specification: "256 GB",
      })?.option?.id,
    ).toBe("natural-titanium");
    expect(
      matchInventoryProductColor({
        brand: "Apple",
        model: "iPhone 17 Pro",
        color: "Cosmic Orange",
        specification: "256 GB",
      })?.option?.id,
    ).toBe("cosmic-orange");
    expect(
      matchInventoryProductColor({
        brand: "iPhone",
        model: "iPhone 17 Air",
        specification: "256 GB · 天蓝色",
      })?.option?.id,
    ).toBe("sky-blue");
    expect(
      matchInventoryProductColor({
        brand: "Apple",
        model: "iPhone 17",
        color: "未在目录中的颜色",
        specification: "256 GB",
      }),
    ).toEqual({ value: "未在目录中的颜色" });
    expect(
      matchInventoryProductColor({
        brand: "Apple",
        model: "iPhone 13",
        specification: "256 GB · 特殊紫色",
      }),
    ).toEqual({ value: "特殊紫色" });
  });

  it("keeps every Apple catalog model on a reference family", () => {
    for (const model of EU_PHONE_MODELS.filter((item) => item.brandId === "apple")) {
      expect(matchInventoryProductReference({ brand: "Apple", model: model.name })).toBeDefined();
      for (const option of model.colors) {
        const color = matchInventoryProductColor({
          brand: "Apple",
          model: model.name,
          color: option.id,
        });
        expect(color?.option?.id, `${model.name} ${option.id}`).toBe(option.id);
        expect(inventoryProductColorStyle(option).background).toBeTruthy();
      }
    }
  });

  it("keeps local same-origin paths for all original references", () => {
    for (const image of Object.values(INVENTORY_PRODUCT_REFERENCE_IMAGES)) {
      expect(image.src).toMatch(/^\/inventory-reference\/[a-z0-9-]+\.webp$/);
      expect(image.alt).toContain("参考图");
    }
  });
});
