import { describe, expect, it } from "vitest";
import {
  batchOrderPurchasesBodySchema,
  orderPurchasingMockReadBodySchema,
  orderPurchasingReadBodySchema,
  saveOrderPurchaseBodySchema,
} from "./repairdesk-schemas";

const storeId = "10000000-0000-4000-8000-000000000010";
const orderId = "10000000-0000-4000-8000-000000000301";

describe("order purchasing request schemas", () => {
  it("keeps production IDs strict while admitting legacy IDs only through the mock schema", () => {
    const input = { expected_store_id: "mock-store", order_ids: ["order-1"] };
    expect(orderPurchasingReadBodySchema.safeParse(input).success).toBe(false);
    expect(orderPurchasingMockReadBodySchema.safeParse(input).success).toBe(true);
  });

  it("preserves nullable cost and requires complete ordered rows", () => {
    const base = {
      expected_store_id: storeId,
      order_id: orderId,
      part_name: "Screen",
      supplier_id: null,
      unit_cost_eur: null,
      quantity: 1,
      expected_revision: 0,
      idempotency_key: "10000000-0000-4000-8000-000000000501",
    };
    expect(saveOrderPurchaseBodySchema.safeParse({ ...base, status: "needed" }).success).toBe(true);
    expect(saveOrderPurchaseBodySchema.safeParse({ ...base, status: "ordered" }).success).toBe(
      false,
    );
    expect(
      saveOrderPurchaseBodySchema.safeParse({
        ...base,
        status: "ordered",
        supplier_id: "10000000-0000-4000-8000-000000000201",
        unit_cost_eur: "0",
      }).success,
    ).toBe(true);
  });

  it("requires one batch operation and unique positive-version items", () => {
    const base = {
      expected_store_id: storeId,
      operation: "mark_arrived",
      items: [{ id: "10000000-0000-4000-8000-000000000501", expected_revision: 1 }],
      idempotency_key: "10000000-0000-4000-8000-000000000502",
    };
    expect(batchOrderPurchasesBodySchema.safeParse(base).success).toBe(true);
    expect(
      batchOrderPurchasesBodySchema.safeParse({ ...base, items: [...base.items, ...base.items] })
        .success,
    ).toBe(false);
  });
});
