import { describe, expect, it } from "vitest";

import { normalizeDeviceUnlockInput } from "@/features/orders/model/device-unlock";

describe("device unlock normalization", () => {
  it("keeps text passwords and trims whitespace", () => {
    expect(normalizeDeviceUnlockInput({ method: "text", value: " abc123 " })).toEqual({
      method: "text",
      value: "abc123",
      pattern: null,
    });
  });

  it("keeps PIN leading zeroes", () => {
    expect(normalizeDeviceUnlockInput({ method: "pin", value: "001258" })).toEqual({
      method: "pin",
      value: "001258",
      pattern: null,
    });
  });

  it("rejects invalid PIN and repeated pattern points", () => {
    expect(() => normalizeDeviceUnlockInput({ method: "pin", value: "12a4" })).toThrow("数字 PIN");
    expect(() => normalizeDeviceUnlockInput({ method: "pattern", pattern: [1, 2, 2, 5] })).toThrow(
      "不能重复",
    );
  });

  it("normalizes clear and pattern inputs", () => {
    expect(normalizeDeviceUnlockInput({ method: "none" })).toEqual({
      method: null,
      value: null,
      pattern: null,
    });
    expect(normalizeDeviceUnlockInput({ method: "pattern", pattern: [1, 2, 5, 8] })).toEqual({
      method: "pattern",
      value: null,
      pattern: [1, 2, 5, 8],
    });
  });
});
