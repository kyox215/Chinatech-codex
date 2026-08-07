import { describe, expect, it } from "vitest";

import {
  EU_PHONE_BRANDS,
  EU_PHONE_MODELS,
  findEuPhoneBrand,
  findEuPhoneColor,
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

  it("keeps every Apple model color-addressable by id and display name", () => {
    const asOf = new Date("2026-08-07T00:00:00.000Z");
    const appleModels = EU_PHONE_MODELS.filter((item) => item.brandId === "apple");
    expect(appleModels.length).toBeGreaterThan(30);
    for (const model of appleModels) {
      expect(model.colors.length, model.name).toBeGreaterThan(0);
      for (const color of model.colors) {
        expect(color.name, `${model.name} color name`).toBeTruthy();
        expect(color.swatches.length, `${model.name} ${color.id} swatch`).toBeGreaterThan(0);
        expect(findEuPhoneColor("apple", model.name, color.id, asOf)?.id).toBe(color.id);
        expect(findEuPhoneColor("apple", model.name, color.name, asOf)?.id).toBe(color.id);
      }
    }
  });

  it("uses the corrected 2026 Apple family colors", () => {
    const asOf = new Date("2026-08-07T00:00:00.000Z");
    expect(findEuPhoneModel("apple", "iPhone 17e", asOf)?.colors.map((item) => item.name)).toEqual([
      "淡粉色",
      "白色",
      "黑色",
    ]);
    expect(
      findEuPhoneModel("apple", "iPhone 17 Air", asOf)?.colors.map((item) => item.name),
    ).toEqual(["天蓝色", "浅金色", "云白色", "深空黑"]);
    expect(findEuPhoneModel("apple", "iPhone 17", asOf)?.colors.map((item) => item.name)).toEqual([
      "薰衣草紫",
      "鼠尾草绿",
      "雾蓝色",
      "白色",
      "黑色",
    ]);
    expect(findEuPhoneColor("apple", "iPhone 17 Pro", "Cosmic Orange", asOf)?.id).toBe(
      "cosmic-orange",
    );
    expect(findEuPhoneColor("apple", "iPhone 17 Air", "sky blue", asOf)?.id).toBe("sky-blue");
  });
});
