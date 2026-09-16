import { describe, expect, it } from "vitest";
import {
  getOrderModelSuggestions,
  orderBrandSuggestions,
  rankDeviceSuggestions,
  shouldClearModelOnBrandChange,
} from "./device-autocomplete";

describe("order device autocomplete", () => {
  it("prioritizes brand prefixes and preserves unknown manual input", () => {
    expect(rankDeviceSuggestions(orderBrandSuggestions, "a")[0].value).toBe("Apple");
    expect(rankDeviceSuggestions(orderBrandSuggestions, "s")[0].value).toBe("Samsung");
    expect(rankDeviceSuggestions(orderBrandSuggestions, "my handmade device")).toEqual([]);
  });
  it("resolves the verified 4G model code without matching the A13 5G", () => {
    const models = getOrderModelSuggestions("SAMSUNG");
    expect(rankDeviceSuggestions(models, "A135F").map((item) => item.value)).toEqual([
      "Galaxy A13",
    ]);
    expect(rankDeviceSuggestions(models, "SM-A135F/DSN")[0].value).toBe("Galaxy A13");
    expect(rankDeviceSuggestions(getOrderModelSuggestions("Apple"), "A135F")).toEqual([]);
  });
  it("clears an incompatible catalog selection but retains unknown typed models", () => {
    expect(shouldClearModelOnBrandChange("Apple", "Samsung", "iPhone 15")).toBe(true);
    expect(shouldClearModelOnBrandChange("Apple", "APPLE", "iPhone 15")).toBe(false);
    expect(shouldClearModelOnBrandChange("Apple", "Samsung", "CUSTOM-123")).toBe(false);
    expect(getOrderModelSuggestions("my brand")).toEqual([]);
  });
  it("merges European verified codes into existing market names", () => {
    const apple = getOrderModelSuggestions("Apple");
    expect(rankDeviceSuggestions(apple, "A2221")[0].value).toBe("iPhone 11");
    expect(apple.filter((model) => model.value === "iPhone 11")).toHaveLength(1);
    expect(rankDeviceSuggestions(getOrderModelSuggestions("Samsung"), "SM-S926B")[0].value).toBe(
      "Galaxy S24+",
    );
  });
  it("keeps base, Plus, Ultra and FE models distinct and ranks the exact Plus first", () => {
    const models = getOrderModelSuggestions("Samsung");
    expect(models.map((model) => model.value)).toEqual(
      expect.arrayContaining(["Galaxy S24", "Galaxy S24+", "Galaxy S24 Ultra", "Galaxy S20 FE 5G"]),
    );
    expect(rankDeviceSuggestions(models, "Galaxy S24+")[0].value).toBe("Galaxy S24+");
    expect(rankDeviceSuggestions(models, "S24+")[0].value).toBe("Galaxy S24+");
    expect(rankDeviceSuggestions(models, "Galaxy S24")[0].value).toBe("Galaxy S24");
  });
  it("maps HMD/Nokia and Nothing/CMF aliases to the same brand catalogs", () => {
    expect(rankDeviceSuggestions(orderBrandSuggestions, "HMD")[0].value).toBe("HMD / Nokia");
    expect(rankDeviceSuggestions(orderBrandSuggestions, "Nothing")[0].value).toBe("Nothing / CMF");
    expect(getOrderModelSuggestions("HMD")).toEqual(getOrderModelSuggestions("Nokia"));
    expect(getOrderModelSuggestions("Nothing")).toEqual(getOrderModelSuggestions("CMF"));
  });
});
