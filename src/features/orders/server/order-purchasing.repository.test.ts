import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchOrderPurchases,
  readOrderPurchasingBoard,
  saveOrderPurchase,
} from "./order-purchasing.repository";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => mocks }));

const storeId = "10000000-0000-4000-8000-000000000010";
const actorId = "10000000-0000-4000-8000-000000000001";
const orderId = "10000000-0000-4000-8000-000000000301";
const purchaseId = "10000000-0000-4000-8000-000000000501";
const actor = { id: actorId, storeId, storeRole: "owner" as const, displayName: "Owner" };
const line = {
  id: purchaseId,
  order_id: orderId,
  line_id: null,
  part_name: "Screen",
  supplier_id: null,
  supplier_name: null,
  unit_cost_eur: "0.00",
  quantity: 1,
  status: "needed",
  revision: 1,
  ordered_at: null,
  arrived_at: null,
  updated_at: "2026-09-26T08:00:00Z",
};

beforeEach(() => vi.clearAllMocks());

describe("order purchasing repository", () => {
  it("keeps exact decimal strings and dispatches one dedicated read RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        groups: [{ order_id: orderId, lines: [line] }],
        suppliers: [],
        permissions: { canManage: true, canAssignSupplier: true },
      },
      error: null,
    });
    const result = await readOrderPurchasingBoard(
      { expected_store_id: storeId, order_ids: [orderId] },
      actor,
    );
    expect(result.groups[0]?.lines[0]?.unit_cost_eur).toBe("0.00");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("repairdesk_read_order_purchasing", {
      p_store_id: storeId,
      p_actor_id: actorId,
      p_order_ids: [orderId],
    });
  });

  it("sends null cost without coercing it to zero", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, replayed: false, line }, error: null });
    await saveOrderPurchase(
      {
        expected_store_id: storeId,
        order_id: orderId,
        part_name: "Screen",
        supplier_id: null,
        unit_cost_eur: null,
        quantity: 1,
        status: "needed",
        expected_revision: 0,
        idempotency_key: "10000000-0000-4000-8000-000000000601",
      },
      actor,
    );
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_unit_cost_eur: null,
      p_purchase_id: null,
      p_expected_revision: 0,
    });
  });

  it("preserves batch partial failures and revisions", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        replayed: false,
        results: [
          { id: purchaseId, ok: true, revision: 2 },
          {
            id: "10000000-0000-4000-8000-000000000502",
            ok: false,
            code: "stale_revision",
            revision: 3,
          },
        ],
      },
      error: null,
    });
    await expect(
      batchOrderPurchases(
        {
          expected_store_id: storeId,
          operation: "mark_ordered",
          items: [{ id: purchaseId, expected_revision: 1 }],
          idempotency_key: "10000000-0000-4000-8000-000000000602",
        },
        actor,
      ),
    ).resolves.toMatchObject({
      results: [
        { id: purchaseId, ok: true, revision: 2 },
        { ok: false, code: "stale_revision", revision: 3 },
      ],
    });
  });

  it("rejects cross-store dispatch before calling the database", async () => {
    await expect(
      readOrderPurchasingBoard(
        { expected_store_id: "20000000-0000-4000-8000-000000000010", order_ids: [orderId] },
        actor,
      ),
    ).rejects.toMatchObject({ code: "INVALID_TARGET" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
