import { describe, expect, it } from "vitest";

import {
  buildCreateOrderCostInputs,
  buildOrderLineCostUpdates,
  hasTouchedNewOrderCostDrafts,
  isNewOrderCostInputDisabled,
  parseOrderCostDraftAmount,
  syncNewOrderCostDrafts,
  updateNewOrderCostDraft,
} from "./order-cost-draft";

const line = {
  line_id: "11111111-1111-4111-8111-111111111111",
  catalog_key: "display:main",
  name: "屏幕",
  price: 90,
};

describe("order cost draft", () => {
  it("detects touched cost drafts for the unsaved navigation guard", () => {
    expect(hasTouchedNewOrderCostDrafts({})).toBe(false);
    expect(
      hasTouchedNewOrderCostDrafts({
        untouched: { mode: "default", text: "15", touched: false },
        changed: { mode: "manual", text: "20", touched: true },
      }),
    ).toBe(true);
  });

  it("hydrates a catalog default without turning it into a manual override", () => {
    expect(
      syncNewOrderCostDrafts(
        {},
        [line],
        [{ catalog_key: "display:main", catalog_name: "屏幕", default_cost_amount: 15 }],
      ),
    ).toEqual({
      [line.line_id]: { mode: "default", text: "15", touched: false },
    });
  });

  it("keeps blank distinct from explicit zero", () => {
    expect(updateNewOrderCostDraft("").mode).toBe("blank");
    expect(
      buildCreateOrderCostInputs([line], { [line.line_id]: updateNewOrderCostDraft("0") }),
    ).toEqual(
      [{ ...line, name: undefined, price: undefined }].map(() => ({
        line_id: line.line_id,
        catalog_key: line.catalog_key,
        mode: "manual",
        amount: 0,
      })),
    );
  });

  it("keeps a touched cost when the quote mode changes and the same draft line returns", () => {
    const touched = { [line.line_id]: updateNewOrderCostDraft("22") };

    expect(
      syncNewOrderCostDrafts(
        touched,
        [line],
        [{ catalog_key: "display:main", catalog_name: "屏幕", default_cost_amount: 15 }],
      ),
    ).toEqual(touched);
  });

  it("keeps custom cost entry available when only catalog defaults fail", () => {
    expect(
      isNewOrderCostInputDisabled({
        isOnline: true,
        defaultsPending: false,
        defaultsError: true,
      }),
    ).toBe(false);
    expect(
      isNewOrderCostInputDisabled({
        catalogKey: "display:main",
        isOnline: true,
        defaultsPending: false,
        defaultsError: true,
      }),
    ).toBe(true);
  });

  it("rejects invalid manual amounts", () => {
    expect(() =>
      buildCreateOrderCostInputs([line], {
        [line.line_id]: updateNewOrderCostDraft("-1"),
      }),
    ).toThrow("成本金额无效");
    for (const value of ["1e2", "0x10"]) {
      expect(() =>
        buildCreateOrderCostInputs([line], {
          [line.line_id]: updateNewOrderCostDraft(value),
        }),
      ).toThrow("最多保留两位小数");
    }
    expect(parseOrderCostDraftAmount("1e2")).toBeNull();
    expect(parseOrderCostDraftAmount("12,50")).toBe(12.5);
  });

  it("patches only changed lines so untouched default sources are preserved", () => {
    expect(
      buildOrderLineCostUpdates(
        [
          { ...line, cost_amount: 15, source: "store_default" },
          {
            line_id: "22222222-2222-4222-8222-222222222222",
            catalog_key: "battery:main",
            name: "电池",
            cost_amount: 10,
            source: "store_default",
          },
        ],
        {
          [line.line_id]: "16",
          "22222222-2222-4222-8222-222222222222": "10",
        },
      ),
    ).toEqual([{ line_id: line.line_id, mode: "manual", amount: 16 }]);
  });
});
