import { describe, expect, it } from "vitest";

import {
  normalizeFaultPrices,
  toFaultPriceItems,
} from "@/components/orders/fault-diagnosis-picker";

import {
  createFinanceDraftState,
  emptyFinanceFaultDraft,
  normalizeFinanceDraft,
} from "./order-finance-draft";

describe("order finance draft", () => {
  it("assigns catalog identity and preserves custom line identity through the picker mapping", () => {
    const catalogLineId = "00000000-0000-4000-8000-000000000110";
    const customLineId = "00000000-0000-4000-8000-000000000111";

    const normalized = normalizeFaultPrices([
      {
        line_id: catalogLineId,
        catalog_key: "display:glass",
        name: "屏幕 - 外屏碎裂",
        price: 80,
      },
      { line_id: customLineId, name: "人工检测", price: 20 },
      { line_id: "00000000-0000-4000-8000-000000000112", name: "屏幕", price: 30 },
    ]);

    expect(toFaultPriceItems(normalized)).toMatchObject([
      {
        line_id: catalogLineId,
        catalog_key: "display:glass",
        name: "屏幕 - 外屏碎裂",
        price: 80,
      },
      { line_id: customLineId, name: "人工检测", price: 20 },
      { line_id: "00000000-0000-4000-8000-000000000112", name: "屏幕", price: 30 },
    ]);
    expect(toFaultPriceItems(normalized)[1]).not.toHaveProperty("catalog_key");
    expect(toFaultPriceItems(normalized)[2]).not.toHaveProperty("catalog_key");
  });

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
    expect(normalized.faultPrices).toMatchObject([{ name: "Display", price: 12 }]);
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
          {
            line_id: "00000000-0000-4000-8000-000000000101",
            catalog_key: "display:main",
            name: "Display",
            priceText: "80,50",
            note: "OLED",
          },
          {
            line_id: "00000000-0000-4000-8000-000000000102",
            name: "Labor",
            priceText: "20",
            note: "",
          },
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
        {
          line_id: "00000000-0000-4000-8000-000000000101",
          catalog_key: "display:main",
          name: "Display",
          price: 80.5,
          note: "OLED",
        },
        {
          line_id: "00000000-0000-4000-8000-000000000102",
          name: "Labor",
          price: 20,
        },
      ],
    });
  });

  it("preserves line identity while editing prices", () => {
    const draft = createFinanceDraftState(
      [
        {
          line_id: "00000000-0000-4000-8000-000000000103",
          catalog_key: "battery:health",
          name: "电池 - 健康度低",
          price: 59,
        },
      ],
      0,
    );
    draft.faults[0].priceText = "69";

    expect(normalizeFinanceDraft(draft, 0).faultPrices).toEqual([
      {
        line_id: "00000000-0000-4000-8000-000000000103",
        catalog_key: "battery:health",
        name: "电池 - 健康度低",
        price: 69,
      },
    ]);
  });

  it("repairs missing line identities once and keeps them stable across saves", () => {
    const firstDraft = createFinanceDraftState(
      [
        { name: "屏幕", price: 80, catalog_key: "display:main" },
        { name: "屏幕", price: 20 },
      ],
      0,
    );
    const firstSave = normalizeFinanceDraft(firstDraft, 0);
    const firstIds = firstSave.faultPrices.map((item) => item.line_id);

    expect(firstIds).toHaveLength(2);
    expect(new Set(firstIds).size).toBe(2);
    expect(firstSave.faultPrices[0]).toMatchObject({ catalog_key: "display:main" });

    const reordered = createFinanceDraftState([...firstSave.faultPrices].reverse(), 0);
    const secondSave = normalizeFinanceDraft(reordered, 0);
    expect(secondSave.faultPrices.map((item) => item.line_id)).toEqual([...firstIds].reverse());
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
