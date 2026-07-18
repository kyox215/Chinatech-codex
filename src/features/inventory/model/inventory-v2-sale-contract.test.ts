import { describe, expect, it } from "vitest";

import { completeInventorySaleV2InputSchema } from "./inventory-v2-sale-contract";

const validInput = {
  expected_updated_at: "2026-07-18T17:00:00.000Z",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  sale_price: 399.99,
  payment_amount: 399.99,
  payment_method: "card",
  sale_channel: "store",
  warranty_months: 12,
  warranty_snapshot: {
    version: "inventory-sale-v2-it-1",
    language: "it" as const,
    terms: ["Garanzia legale applicabile secondo la normativa vigente."],
  },
  fiscal_status: "pending" as const,
  sold_at: "2026-07-18T17:01:00.000Z",
};

describe("completeInventorySaleV2InputSchema", () => {
  it("accepts a strict full-payment command", () => {
    expect(completeInventorySaleV2InputSchema.parse(validInput)).toEqual(validInput);
  });

  it("rejects partial payment, unknown keys and missing fiscal reference", () => {
    expect(
      completeInventorySaleV2InputSchema.safeParse({ ...validInput, payment_amount: 100 }).success,
    ).toBe(false);
    expect(
      completeInventorySaleV2InputSchema.safeParse({ ...validInput, unexpected: true }).success,
    ).toBe(false);
    expect(
      completeInventorySaleV2InputSchema.safeParse({
        ...validInput,
        fiscal_status: "recorded",
      }).success,
    ).toBe(false);
  });
});
