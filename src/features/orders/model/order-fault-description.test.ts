import { describe, expect, it } from "vitest";

import {
  appendFaultDescriptionItems,
  countMissingFaultDescriptionItems,
  type FaultDescriptionSourceItem,
  getFaultDescriptionSourceItems,
  hasFaultDescriptionItem,
} from "./order-fault-description";

const sourceItems: FaultDescriptionSourceItem[] = [
  { name: "屏幕 - 外屏碎裂", price: 80, note: "Vetro esterno rotto" },
  { name: "尾插", price: 25 },
  { name: "123", price: 20 },
];

describe("order fault description helpers", () => {
  it("filters empty and duplicate repair items", () => {
    expect(
      getFaultDescriptionSourceItems([
        { name: "屏幕", price: 80 },
        { name: " ", price: 10 },
        { name: "屏幕", price: 90 },
      ]),
    ).toEqual([{ name: "屏幕", price: 80 }]);
  });

  it("appends missing repair item names without replacing manual text", () => {
    expect(appendFaultDescriptionItems("客户反馈无法正常使用", sourceItems)).toBe(
      ["客户反馈无法正常使用", "屏幕 - 外屏碎裂", "尾插", "123"].join("\n"),
    );
  });

  it("does not append repair items already present in multiline text", () => {
    expect(appendFaultDescriptionItems("屏幕 - 外屏碎裂\n尾插", sourceItems)).toBe(
      ["屏幕 - 外屏碎裂", "尾插", "123"].join("\n"),
    );
  });

  it("recognizes comma and Chinese separator separated item names", () => {
    expect(countMissingFaultDescriptionItems("屏幕 - 外屏碎裂、尾插", sourceItems)).toBe(1);
    expect(hasFaultDescriptionItem("屏幕 - 外屏碎裂，尾插", sourceItems[1]!)).toBe(true);
  });

  it("does not treat partial short numeric matches as the same custom item", () => {
    expect(hasFaultDescriptionItem("1234", sourceItems[2]!)).toBe(false);
    expect(appendFaultDescriptionItems("1234", [sourceItems[2]!])).toBe("1234\n123");
  });
});
