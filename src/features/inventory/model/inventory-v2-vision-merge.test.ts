import { describe, expect, it } from "vitest";

import {
  mergeVisionIdentifiersWithoutOverwrite,
  preferExistingInventoryValue,
} from "./inventory-v2-vision-merge";

describe("inventory V2 Vision draft merge", () => {
  it("replaces only the initial blank identifier with confirmed local candidates", () => {
    expect(
      mergeVisionIdentifiersWithoutOverwrite(
        [{ kind: "imei1", value: "", source: "manual", primary: true }],
        [
          { kind: "imei1", value: "490154203237518", source: "scan", primary: true },
          { kind: "imei2", value: "356938035643809", source: "scan", primary: false },
        ],
      ),
    ).toEqual([
      { kind: "imei1", value: "490154203237518", source: "scan", primary: true },
      { kind: "imei2", value: "356938035643809", source: "scan", primary: false },
    ]);
  });

  it("preserves existing manual values and their primary selection", () => {
    expect(
      mergeVisionIdentifiersWithoutOverwrite(
        [{ kind: "serial", value: "MANUAL-123", source: "manual", primary: true }],
        [{ kind: "imei1", value: "490154203237518", source: "scan", primary: true }],
      ),
    ).toEqual([
      { kind: "serial", value: "MANUAL-123", source: "manual", primary: true },
      { kind: "imei1", value: "490154203237518", source: "scan", primary: false },
    ]);
    expect(preferExistingInventoryValue("Manual model", "AI model")).toBe("Manual model");
    expect(preferExistingInventoryValue("", "AI model")).toBe("AI model");
  });
});
