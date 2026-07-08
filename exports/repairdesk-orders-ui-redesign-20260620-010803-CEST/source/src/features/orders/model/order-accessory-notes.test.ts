import { describe, expect, it } from "vitest";

import { formatAccessoryNotes, parseAccessoryNotes } from "./order-accessory-notes";

describe("order accessory notes", () => {
  it("keeps none as an exclusive option", () => {
    expect(parseAccessoryNotes("无、手机壳")).toEqual({ selected: ["无"], customText: "" });
    expect(formatAccessoryNotes({ selected: ["无", "手机壳"], customText: "贴纸" })).toBe("无");
  });

  it("round-trips fixed options and custom notes", () => {
    const parsed = parseAccessoryNotes("SIM卡托、手机壳、其他：钥匙扣");
    expect(parsed).toEqual({
      selected: ["SIM卡托", "手机壳", "其他"],
      customText: "钥匙扣",
    });
    expect(formatAccessoryNotes(parsed)).toBe("SIM卡托、手机壳、其他：钥匙扣");
  });
});
