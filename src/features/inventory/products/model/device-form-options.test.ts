import { describe, expect, it } from "vitest";

import {
  DEVICE_CONDITION_OPTIONS,
  DEVICE_RAM_OPTIONS,
  DEVICE_STORAGE_OPTIONS,
  listDeviceConditionOptions,
  listDeviceColorOptions,
  listDeviceRamOptions,
  listDeviceStorageOptions,
} from "./device-form-options";

describe("device form option contracts", () => {
  it("keeps the bounded storage presets in a stable ascending order", () => {
    expect(listDeviceStorageOptions("phone")).toEqual([...DEVICE_STORAGE_OPTIONS]);
    expect(listDeviceStorageOptions("tablet", ["2 TB", "256 GB", "custom"])).toEqual([
      "8 GB",
      "16 GB",
      "32 GB",
      "64 GB",
      "128 GB",
      "256 GB",
      "512 GB",
      "1 TB",
      "2 TB",
      "4 TB",
      "8 TB",
      "custom",
    ]);
  });

  it("keeps RAM presets category-aware and extensible for computers", () => {
    expect(listDeviceRamOptions("phone")).toEqual([...DEVICE_RAM_OPTIONS]);
    expect(listDeviceRamOptions("computer")).toContain("128 GB");
    expect(listDeviceRamOptions("game_console")).toEqual([]);
    expect(listDeviceRamOptions("computer", ["256 GB", "8 GB"])).toEqual([
      "256 GB",
      "8 GB",
      "2 GB",
      "4 GB",
      "16 GB",
      "32 GB",
      "64 GB",
      "128 GB",
    ]);
  });

  it("exposes maintainable condition labels without changing stored values", () => {
    expect(listDeviceConditionOptions()).toEqual([...DEVICE_CONDITION_OPTIONS]);
    expect(DEVICE_CONDITION_OPTIONS.map((option) => option.value)).toEqual([
      "100",
      "90",
      "80",
      "70",
      "60",
    ]);
  });

  it("uses curated model colors first and a shared category pool for unknown models", () => {
    const modelColor = { id: "model-blue", name: "模型蓝", swatches: ["#123456"] } as const;
    const curated = listDeviceColorOptions("phone", [modelColor]);
    expect(curated[0]).toEqual(modelColor);
    expect(curated.length).toBeGreaterThan(1);
    expect(listDeviceColorOptions("phone", [modelColor, modelColor])).toHaveLength(curated.length);
  });
});
