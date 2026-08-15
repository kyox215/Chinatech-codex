import { describe, expect, it } from "vitest";

import {
  GENERIC_DEVICE_COLORS,
  listGenericDeviceColors,
  resolveDeviceColorPolicy,
  type AppleColorApprovalOverlay,
} from "./device-color-policy";

const approvedAppleColors: AppleColorApprovalOverlay = {
  "iPhone 17": [
    { id: "deep-blue", name: "深蓝色", swatches: ["#233d63"] },
    { id: "white", name: "白色", swatches: ["#f5f5f0"] },
  ],
};

describe("device color policy", () => {
  it("keeps generic colors in the shop priority order and deduplicates additions", () => {
    const options = listGenericDeviceColors([
      { id: "black", name: "黑色", swatches: ["#000"] },
      { id: "custom-blue", name: "店内蓝", swatches: ["#09f"] },
    ]);

    expect(options.slice(0, 5).map((option) => option.name)).toEqual([
      "黑色",
      "灰色",
      "深蓝色",
      "绿色",
      "白色",
    ]);
    expect(options.filter((option) => option.id === "black")).toHaveLength(1);
    expect(options.at(-1)?.name).toBe("店内蓝");
    expect(GENERIC_DEVICE_COLORS.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps an unknown Apple model pending with no generic or custom choice", () => {
    const policy = resolveDeviceColorPolicy({
      brand: "Apple",
      model: "手动型号 X",
      colorRequired: false,
    });

    expect(policy.state).toBe("pending-official-color");
    expect(policy.options).toEqual([]);
    expect(policy.allowCustom).toBe(false);
    expect(policy.canSelect).toBe(false);
    expect(policy.save).toEqual({ canSave: true, payloadColor: undefined });
  });

  it("does not block optional Quick Entry save while preserving an existing Apple color", () => {
    const policy = resolveDeviceColorPolicy({
      brand: "Apple",
      model: "iPhone 17",
      existingColor: "黑色",
      selectedColor: "绿色",
      colorRequired: false,
    });

    expect(policy.state).toBe("pending-official-color");
    expect(policy.existingColor).toBe("黑色");
    expect(policy.save).toEqual({
      canSave: true,
      payloadColor: undefined,
      preservedExistingColor: "黑色",
    });
  });

  it("blocks only an independently required color when Apple mapping is pending", () => {
    const policy = resolveDeviceColorPolicy({
      brand: "Apple",
      model: "iPhone 17",
      colorRequired: true,
    });

    expect(policy.state).toBe("pending-official-color");
    expect(policy.save).toEqual({ canSave: false, blockedReason: "color-required" });
  });

  it("uses only the exact injected approved colors for a known Apple model", () => {
    const policy = resolveDeviceColorPolicy({
      brand: "Apple",
      model: "iPhone 17",
      approvedAppleColors,
      selectedColor: "深蓝色",
      colorRequired: true,
    });

    expect(policy.state).toBe("approved");
    expect(policy.options.map((option) => option.name)).toEqual(["深蓝色", "白色"]);
    expect(policy.allowCustom).toBe(false);
    expect(policy.save).toEqual({ canSave: true, payloadColor: "深蓝色" });
  });

  it("rejects a selected Apple color outside the approved exact-model overlay", () => {
    const policy = resolveDeviceColorPolicy({
      brand: "Apple",
      model: "iPhone 17",
      approvedAppleColors,
      selectedColor: "黑色",
    });

    expect(policy.state).toBe("approved");
    expect(policy.save).toEqual({ canSave: false, blockedReason: "color-not-approved" });
  });

  it("allows non-Apple generic selection and custom entry", () => {
    const policy = resolveDeviceColorPolicy({
      brand: "Samsung",
      model: "Galaxy A55",
      selectedColor: "灰色",
      colorRequired: true,
    });

    expect(policy.state).toBe("generic");
    expect(policy.allowCustom).toBe(true);
    expect(policy.save).toEqual({ canSave: true, payloadColor: "灰色" });

    const customPolicy = resolveDeviceColorPolicy({
      brand: "Samsung",
      model: "Galaxy A55",
      selectedColor: "店内蓝",
      colorRequired: true,
    });
    expect(customPolicy.save).toEqual({ canSave: true, payloadColor: "店内蓝" });
  });
});
