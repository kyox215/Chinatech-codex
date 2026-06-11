import { describe, expect, it } from "vitest";

import {
  createFinanceDraftState,
  emptyFinanceFaultDraft,
  normalizeFinanceDraft,
} from "./order-finance-draft";

describe("order finance draft", () => {
  it("keeps an emptied price field empty in the draft", () => {
    const draft = createFinanceDraftState([{ name: "Display", price: 80 }], 10);
    draft.faults[0].priceText = "";

    expect(draft.faults[0].priceText).toBe("");
    expect(normalizeFinanceDraft(draft, 0)).toMatchObject({
      canSave: false,
      error: "请补全报价项目名称和金额。",
    });
  });

  it("saves a newly typed number without a leading zero", () => {
    const draft = createFinanceDraftState([{ name: "Display", price: 80 }], 0);
    draft.faults[0].priceText = "";
    draft.faults[0].priceText = `${draft.faults[0].priceText}12`;

    const normalized = normalizeFinanceDraft(draft, 0);
    expect(draft.faults[0].priceText).toBe("12");
    expect(normalized).toMatchObject({
      canSave: true,
      quotation: 12,
      deposit: 0,
      balance: 12,
    });
    expect(normalized.faultPrices).toEqual([{ name: "Display", price: 12 }]);
  });

  it("ignores fully empty rows and rejects half-filled rows", () => {
    const draft = {
      faults: [{ name: "Display", priceText: "80", note: "" }, emptyFinanceFaultDraft()],
      depositText: "10",
    };

    expect(normalizeFinanceDraft(draft, 0)).toMatchObject({
      canSave: true,
      quotation: 80,
      deposit: 10,
      balance: 70,
      faultPrices: [{ name: "Display", price: 80 }],
    });

    draft.faults[1] = { name: "Battery", priceText: "", note: "" };
    expect(normalizeFinanceDraft(draft, 0)).toMatchObject({
      canSave: false,
      error: "请补全报价项目名称和金额。",
    });
  });

  it("uses one normalized result for quotation, balance and payload", () => {
    const normalized = normalizeFinanceDraft(
      {
        faults: [
          { name: "Display", priceText: "80,50", note: "OLED" },
          { name: "Labor", priceText: "20", note: "" },
        ],
        depositText: "",
      },
      10,
    );

    expect(normalized).toMatchObject({
      canSave: true,
      quotation: 100.5,
      deposit: 0,
      balance: 90.5,
      faultPrices: [
        { name: "Display", price: 80.5, note: "OLED" },
        { name: "Labor", price: 20 },
      ],
    });
  });

  it("rejects deposit above quotation", () => {
    expect(
      normalizeFinanceDraft(
        { faults: [{ name: "Display", priceText: "80", note: "" }], depositText: "90" },
        0,
      ),
    ).toMatchObject({
      canSave: false,
      error: "押金不能超过总报价。",
    });
  });
});
