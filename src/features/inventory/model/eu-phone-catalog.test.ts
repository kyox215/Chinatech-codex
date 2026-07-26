import { describe, expect, it } from "vitest";

import {
  EU_PHONE_BRANDS,
  EU_PHONE_MODELS,
  findEuPhoneBrand,
  findEuPhoneModel,
  getRollingTenYearCutoff,
  isModelWithinRollingTenYears,
  listCurrentEuPhoneModels,
  phoneColorBackground,
  type EuPhoneModel,
} from "./eu-phone-catalog";

const boundaryModel = (releasedOn: string): EuPhoneModel => ({
  id: `test-${releasedOn}`,
  brandId: "test",
  name: "Boundary Phone",
  releasedOn,
  ramOptions: [],
  storageOptions: [],
  colors: [],
});

describe("European phone catalog", () => {
  it("uses an exact rolling ten-year UTC cutoff", () => {
    const asOf = new Date("2026-07-26T12:00:00.000Z");
    expect(getRollingTenYearCutoff(asOf).toISOString()).toBe("2016-07-26T00:00:00.000Z");
    expect(isModelWithinRollingTenYears(boundaryModel("2016-07-26"), asOf)).toBe(true);
    expect(isModelWithinRollingTenYears(boundaryModel("2016-07-27"), asOf)).toBe(true);
    expect(isModelWithinRollingTenYears(boundaryModel("2016-07-25"), asOf)).toBe(false);
    expect(isModelWithinRollingTenYears(boundaryModel("2026-07-27"), asOf)).toBe(false);
    expect(isModelWithinRollingTenYears(boundaryModel("not-a-date"), asOf)).toBe(false);
    expect(getRollingTenYearCutoff(new Date("2028-02-29T12:00:00.000Z")).toISOString()).toBe(
      "2018-02-28T00:00:00.000Z",
    );
  });

  it("keeps broad European coverage without allowing duplicate canonical ids", () => {
    expect(EU_PHONE_BRANDS.length).toBeGreaterThanOrEqual(18);
    expect(EU_PHONE_MODELS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(EU_PHONE_MODELS.map((item) => item.id)).size).toBe(EU_PHONE_MODELS.length);
    expect(
      listCurrentEuPhoneModels("apple", new Date("2026-07-26T00:00:00.000Z")).length,
    ).toBeGreaterThan(30);
  });

  it("resolves brand and model aliases case-insensitively", () => {
    expect(findEuPhoneBrand(" iphone ")?.id).toBe("apple");
    expect(findEuPhoneBrand("NOKIA")?.id).toBe("hmd");
    expect(findEuPhoneModel("apple", "iphone se 2022")?.name).toBe("iPhone SE (3rd generation)");
  });

  it("preserves accessible names while supporting single and multi-tone swatches", () => {
    const nothing = findEuPhoneModel("nothing", "Nothing Phone (3a)");
    expect(nothing?.colors.every((item) => item.name && item.swatches.length > 0)).toBe(true);
    expect(phoneColorBackground({ id: "single", name: "白色", swatches: ["#fff"] })).toBe("#fff");
    expect(phoneColorBackground({ id: "multi", name: "渐变", swatches: ["#00f", "#f0f"] })).toBe(
      "linear-gradient(135deg, #00f, #f0f)",
    );
  });

  it("does not invent Apple RAM options", () => {
    expect(listCurrentEuPhoneModels("apple").every((item) => item.ramOptions.length === 0)).toBe(
      true,
    );
  });
});
