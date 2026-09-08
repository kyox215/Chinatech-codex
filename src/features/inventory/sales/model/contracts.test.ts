import { describe, expect, it } from "vitest";
import {
  inventorySalesCommandBodySchema,
  inventorySalesListBodySchema,
  inventorySalesReceiptBodySchema,
} from "./contracts";
const uuid = "10000000-0000-4000-8000-000000000001";
const date = "2026-09-01T12:00:00Z";
const command = () => ({
  command: "sale.create",
  idempotency_key: uuid,
  payload: {
    inventory_item_id: uuid,
    stock_unit_id: uuid,
    expected_item_updated_at: date,
    expected_unit_version: 1,
    customer_id: uuid,
    price_cents: 10000,
    agreed_at: date,
    payment: { amount_cents: 3000, method: "cash", occurred_at: date },
    used_device: true,
    terms_version: "inventory-sales-2026-09-v1",
  },
});
describe("sales transaction contract", () => {
  it("defaults to 24 months, held in store, and no shortening consent", () => {
    expect(inventorySalesCommandBodySchema.parse(command()).payload).toMatchObject({
      warranty_months: 24,
      deliver: false,
      shortening_agreed: false,
    });
  });
  it.each([0, -1, 0.1, NaN, Infinity, 10000000001, "30.00"])(
    "rejects non-positive or non-integer payment %s",
    (amount_cents) => {
      const input = command();
      expect(
        inventorySalesCommandBodySchema.safeParse({
          ...input,
          payload: { ...input.payload, payment: { ...input.payload.payment, amount_cents } },
        }).success,
      ).toBe(false);
    },
  );
  it("requires an initial payment and rejects overpayment or underpaid delivery", () => {
    const input = command();
    expect(
      inventorySalesCommandBodySchema.safeParse({
        ...input,
        payload: { ...input.payload, payment: undefined },
      }).success,
    ).toBe(false);
    expect(
      inventorySalesCommandBodySchema.safeParse({
        ...input,
        payload: { ...input.payload, deliver: true, delivered_at: date },
      }).success,
    ).toBe(false);
    expect(
      inventorySalesCommandBodySchema.safeParse({
        ...input,
        payload: { ...input.payload, price_cents: 2000 },
      }).success,
    ).toBe(false);
  });
  it("requires an explicit used-device agreement before allowing 12 months", () => {
    const input = command();
    expect(
      inventorySalesCommandBodySchema.safeParse({
        ...input,
        payload: { ...input.payload, warranty_months: 12 },
      }).success,
    ).toBe(false);
    expect(
      inventorySalesCommandBodySchema.safeParse({
        ...input,
        payload: {
          ...input.payload,
          warranty_months: 12,
          shortening_agreed: true,
          shortening_agreed_at: date,
        },
      }).success,
    ).toBe(true);
  });
  it("rejects injected authority at either level and missing CAS", () => {
    const input = command();
    for (const extra of [{ store_id: uuid }, { actor_id: uuid }, { role: "owner" }]) {
      expect(inventorySalesCommandBodySchema.safeParse({ ...input, ...extra }).success).toBe(false);
      expect(
        inventorySalesCommandBodySchema.safeParse({
          ...input,
          payload: { ...input.payload, ...extra },
        }).success,
      ).toBe(false);
    }
    expect(
      inventorySalesCommandBodySchema.safeParse({
        ...input,
        payload: { ...input.payload, expected_unit_version: undefined },
      }).success,
    ).toBe(false);
  });
  it("binds payment receipts to one stable payment and bounds bulk reads", () => {
    expect(inventorySalesReceiptBodySchema.safeParse({ id: uuid, kind: "payment" }).success).toBe(
      false,
    );
    expect(
      inventorySalesReceiptBodySchema.safeParse({ id: uuid, kind: "sale", payment_id: uuid })
        .success,
    ).toBe(false);
    expect(inventorySalesListBodySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(inventorySalesListBodySchema.parse({})).toEqual({
      queue: "all",
      search: "",
      offset: 0,
      limit: 30,
    });
  });
});
