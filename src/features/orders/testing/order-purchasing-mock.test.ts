import { beforeEach, describe, expect, it } from "vitest";
import {
  batchMockOrderPurchases,
  readMockOrderPurchasingBoard,
  resetMockOrderPurchasing,
  saveMockOrderPurchase,
} from "./order-purchasing-mock";

const actor = {
  id: "actor",
  storeId: "mock-store",
  storeRole: "owner" as const,
  displayName: "Owner",
};
const orderId = "order-1";
const supplierA = "00000000-0000-4000-8000-000000000401";
const supplierB = "00000000-0000-4000-8000-000000000402";

beforeEach(() => resetMockOrderPurchasing());

describe("order purchasing mock supplier projection", () => {
  it("uses one supplier source for save, batch assignment, arrival, and board reads", async () => {
    const saved = await saveMockOrderPurchase(
      {
        expected_store_id: "mock-store",
        order_id: orderId,
        part_name: "Screen",
        supplier_id: supplierA,
        unit_cost_eur: "12.00",
        quantity: 1,
        status: "needed",
        expected_revision: 0,
        idempotency_key: "00000000-0000-4000-8000-000000000501",
      },
      actor,
    );
    expect(saved.line.supplier_name).toBe("UTOPYA");

    await batchMockOrderPurchases(
      {
        expected_store_id: "mock-store",
        operation: "assign_supplier",
        supplier_id: supplierB,
        items: [{ id: saved.line.id, expected_revision: 1 }],
        idempotency_key: "00000000-0000-4000-8000-000000000502",
      },
      actor,
    );
    await batchMockOrderPurchases(
      {
        expected_store_id: "mock-store",
        operation: "mark_ordered",
        items: [{ id: saved.line.id, expected_revision: 2 }],
        idempotency_key: "00000000-0000-4000-8000-000000000503",
      },
      actor,
    );
    await batchMockOrderPurchases(
      {
        expected_store_id: "mock-store",
        operation: "mark_arrived",
        items: [{ id: saved.line.id, expected_revision: 3 }],
        idempotency_key: "00000000-0000-4000-8000-000000000504",
      },
      actor,
    );

    const board = await readMockOrderPurchasingBoard(
      { expected_store_id: "mock-store", order_ids: [orderId] },
      actor,
    );
    expect(board.groups[0]?.lines[0]).toMatchObject({
      supplier_id: supplierB,
      supplier_name: "MobileSentrix",
      status: "arrived",
    });
  });
});
