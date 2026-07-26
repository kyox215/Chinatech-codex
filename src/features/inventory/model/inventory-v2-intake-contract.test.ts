import { describe, expect, it } from "vitest";

import {
  createInventoryUnitV2InputSchema,
  isValidInventoryV2Imei,
  parseInventoryV2MoneyDraft,
} from "./inventory-v2-intake-contract";

const valid = {
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  source_type: "manual_stock" as const,
  category: "phone",
  brand: "Apple",
  model: "iPhone 15",
  storage_capacity: "128 GB",
  identifiers: [
    { kind: "imei1" as const, value: "490154203237518", source: "manual" as const, primary: true },
  ],
  cost_amount: 500,
  list_price: 699,
  warranty_months: 12,
  notes: "历史库存盘点补录",
  standardization_status: "unstandardized" as const,
  created_at: "2026-07-18T18:00:00.000Z",
};

describe("inventory V2 intake contract", () => {
  it("parses explicit Italian or dot-decimal money drafts without treating blanks as zero", () => {
    expect(parseInventoryV2MoneyDraft("129,90")).toBe(129.9);
    expect(parseInventoryV2MoneyDraft("129.90")).toBe(129.9);
    expect(parseInventoryV2MoneyDraft("")).toBeNaN();
    expect(parseInventoryV2MoneyDraft("12,345")).toBeNaN();
  });

  it("validates IMEI deterministically", () => {
    expect(isValidInventoryV2Imei("490154203237518")).toBe(true);
    expect(isValidInventoryV2Imei("490154203237519")).toBe(false);
  });

  it("accepts one primary identifier and blocks duplicates", () => {
    expect(createInventoryUnitV2InputSchema.parse(valid)).toEqual(valid);
    expect(
      createInventoryUnitV2InputSchema.safeParse({
        ...valid,
        identifiers: [...valid.identifiers, { ...valid.identifiers[0], kind: "serial" }],
      }).success,
    ).toBe(false);
  });

  it("requires the correct source party", () => {
    expect(
      createInventoryUnitV2InputSchema.safeParse({ ...valid, source_type: "supplier_purchase" })
        .success,
    ).toBe(false);
    expect(
      createInventoryUnitV2InputSchema.safeParse({ ...valid, source_type: "repair_resale" })
        .success,
    ).toBe(false);
    expect(
      createInventoryUnitV2InputSchema.safeParse({
        ...valid,
        source_type: "supplier_purchase",
        supplier_id: "supplier-1",
        customer_id: "customer-1",
      }).success,
    ).toBe(false);
    expect(createInventoryUnitV2InputSchema.safeParse({ ...valid, notes: undefined }).success).toBe(
      false,
    );
  });

  it("requires IMEI or serial as the primary identifier", () => {
    expect(
      createInventoryUnitV2InputSchema.safeParse({
        ...valid,
        identifiers: [{ kind: "ean", value: "1234567890123", source: "scan", primary: true }],
      }).success,
    ).toBe(false);
  });
});
