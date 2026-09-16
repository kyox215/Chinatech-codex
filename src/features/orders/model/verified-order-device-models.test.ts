import { describe, expect, it } from "vitest";
import models from "./verified-order-device-models.json";
import {
  getOrderModelSuggestions,
  orderBrandSuggestions,
  shouldClearModelOnBrandChange,
} from "./device-autocomplete";

describe("verified European order device identities", () => {
  it("keeps official evidence on every identity without inventing missing regional codes", () => {
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(model.evidence_status).toBe("verified");
      if (model.brand !== "Apple") {
        expect(model).toHaveProperty("source_evidence_status");
      }
      expect(model.source_urls.length).toBeGreaterThan(0);
      expect(model.source_catalog_id).toBeTruthy();
      for (const source of model.source_urls) expect(new URL(source).protocol).toBe("https:");
      expect(model).not.toHaveProperty("colors");
    }
  });

  it("makes every imported identity reachable from its brand, including name-only models", () => {
    const normalize = (value: string) =>
      value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\+/g, "plus")
        .replace(/[^\p{L}\p{N}]/gu, "");
    const brands = [...new Set(models.map((model) => model.brand))];
    for (const brand of brands) {
      expect(orderBrandSuggestions.some((option) => option.value === brand)).toBe(true);
      const options = new Set(
        getOrderModelSuggestions(brand).map((option) => normalize(option.value)),
      );
      for (const model of models.filter((row) => row.brand === brand)) {
        expect(
          options.has(normalize(model.marketing_name)),
          `${brand}: ${model.marketing_name}`,
        ).toBe(true);
      }
    }
    expect(models.filter((row) => row.brand === "Samsung").length).toBeGreaterThan(200);
    expect(models.some((row) => row.brand === "vivo")).toBe(true);
    expect(models.some((row) => row.brand !== "Apple" && row.model_codes.length === 0)).toBe(true);
  });

  it("supports research-only brands without changing inventory options or discarding manual models", () => {
    for (const brand of ["Alcatel", "HTC", "LG", "Wiko"]) {
      const options = getOrderModelSuggestions(brand.toLowerCase());
      expect(options.length).toBeGreaterThan(0);
      expect(shouldClearModelOnBrandChange(brand, "Samsung", options[0].value)).toBe(true);
      expect(shouldClearModelOnBrandChange(brand, "Samsung", "Custom workshop device")).toBe(false);
    }
  });

  it("imports the European iPhone identity without promoting US or China codes", () => {
    const model = models.find((row) => row.brand === "Apple" && row.marketing_name === "iPhone 11");
    expect(model?.model_codes).toEqual(["A2221"]);
    expect(model?.aliases).not.toContain("A2111");
    expect(model?.aliases).not.toContain("A2223");
  });

  it("keeps the requested A135F family and Plus variants distinguishable", () => {
    const samsung = models.filter((row) => row.brand === "Samsung");
    const a13 = samsung.find((row) => row.marketing_name === "Galaxy A13");
    expect(a13?.model_codes).toContain("SM-A135F/DSN");
    expect(a13?.aliases).toContain("A135F");
    expect(samsung.find((row) => row.marketing_name === "Galaxy S24")?.model_codes).toContain(
      "SM-S921B",
    );
    expect(samsung.find((row) => row.marketing_name === "Galaxy S24+")?.model_codes).toContain(
      "SM-S926B",
    );
  });
});
