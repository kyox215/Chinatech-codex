import { describe, expect, it } from "vitest";

import { classifyPriorityTag, normalizeOrderTagInput } from "./order-tags";

describe("order tag classification", () => {
  it("keeps priority tags visible", () => {
    expect(classifyPriorityTag("VIP")).toBe("VIP");
    expect(classifyPriorityTag("加急")).toBe("加急");
    expect(classifyPriorityTag("urgent")).toBe("加急");
  });

  it("moves accessory-like tags into accessory notes", () => {
    expect(
      normalizeOrderTagInput({
        internalTag: "SIM卡托 手机壳",
        accessoryNotes: "充电器",
      }),
    ).toEqual({
      internalTag: undefined,
      accessoryNotes: "充电器；SIM卡托 手机壳",
    });
  });

  it("keeps VIP and preserves mixed accessory text as notes", () => {
    expect(
      normalizeOrderTagInput({
        internalTag: "VIP SIM卡托",
      }),
    ).toEqual({
      internalTag: "VIP",
      accessoryNotes: "VIP SIM卡托",
    });
  });
});
