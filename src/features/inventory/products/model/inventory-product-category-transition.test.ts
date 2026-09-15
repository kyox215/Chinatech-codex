import { describe, expect, it } from "vitest";
import { createInventoryProductFormDraft } from "./inventory-product-form";
import {
  changeInventoryProductCategory,
  hasInventoryCategoryDependentValues,
} from "./inventory-product-category-transition";

describe("inventory category transition", () => {
  it("keeps a same-category selection and empty-form change harmless", () => {
    const draft = createInventoryProductFormDraft();
    expect(hasInventoryCategoryDependentValues(draft)).toBe(false);
    expect(changeInventoryProductCategory(draft, "phone")).toBe(draft);
    expect(changeInventoryProductCategory(draft, "tablet").category).toBe("tablet");
  });
  it("clears device values, identifier provenance and inspection while retaining commercial input", () => {
    const draft = {
      ...createInventoryProductFormDraft(),
      brand: "Samsung",
      model: "Galaxy S23",
      color: "黑色",
      condition: "A",
      gtin: "123",
      primary_identifier_kind: "imei1" as const,
      identifiers: {
        imei1: "490154203237518",
        imei2: "990000000000010",
        serial: "SYNTHETIC-SN",
        eid: "99000000000000000000000000000000",
      },
      identifier_sources: {
        imei1: "scan" as const,
        imei2: "manual" as const,
        serial: "manual" as const,
        eid: "manual" as const,
      },
      specifications: { network: "EU" },
      inspection_battery_health: "91",
      inspection_face_id_status: "normal" as const,
      inspection_touched: true,
      list_price: "399.50",
      cost_amount: "200",
      location: "SYNTHETIC A3",
      warranty_months: "12",
      notes: "Retain note",
    };
    expect(hasInventoryCategoryDependentValues(draft)).toBe(true);
    const result = changeInventoryProductCategory(draft, "computer");
    expect(result).toEqual({
      ...createInventoryProductFormDraft("computer"),
      list_price: "399.50",
      cost_amount: "200",
      location: "SYNTHETIC A3",
      warranty_months: "12",
      notes: "Retain note",
    });
    expect(draft.identifiers.imei1).toBe("490154203237518");
  });
});
