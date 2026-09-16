import { describe, expect, it } from "vitest";
import models from "./verified-order-device-models.json";

describe("verified European order device identities", () => {
  it("keeps evidence and explicit hardware codes on every imported identity", () => {
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(model.evidence_status).toBe("verified");
      expect(model.model_codes.length).toBeGreaterThan(0);
      expect(model.source_urls.length).toBeGreaterThan(0);
      expect(model.source_catalog_id).toBeTruthy();
      for (const source of model.source_urls) expect(new URL(source).protocol).toBe("https:");
      expect(model).not.toHaveProperty("colors");
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
