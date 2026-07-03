import { describe, expect, it } from "vitest";

import {
  DEVICE_UNLOCK_PATTERN_MAX_STEPS,
  normalizeDeviceUnlockInput,
} from "@/features/orders/model/device-unlock";

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

  it("rejects invalid PIN and invalid pattern shapes", () => {
    expect(() => normalizeDeviceUnlockInput({ method: "pin", value: "12a4" })).toThrow("数字 PIN");
    expect(() => normalizeDeviceUnlockInput({ method: "pattern", pattern: [1, 2, 3] })).toThrow(
      "4-9",
    );
    expect(() =>
      normalizeDeviceUnlockInput({
        method: "pattern",
        pattern: Array.from(
          { length: DEVICE_UNLOCK_PATTERN_MAX_STEPS + 1 },
          (_, index) => (index % 9) + 1,
        ),
      }),
    ).toThrow("4-9");
    expect(() => normalizeDeviceUnlockInput({ method: "pattern", pattern: [1, 2, 5, 10] })).toThrow(
      "1-9",
    );
    expect(() => normalizeDeviceUnlockInput({ method: "pattern", pattern: [1, 2, 1, 5] })).toThrow(
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

  it("keeps unique Android-style pattern trajectories", () => {
    const pattern = [1, 2, 5, 9, 8, 7, 4, 6, 3];
    expect(normalizeDeviceUnlockInput({ method: "pattern", pattern })).toEqual({
      method: "pattern",
      value: null,
      pattern,
    });
  });
});
