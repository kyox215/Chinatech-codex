import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileInventoryV2 } from "./inventory-v2-reconciliation.repository";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
vi.mock("./inventory-v2-feature-flags", () => ({
  assertInventoryV2ShadowReadEnabled: vi.fn(),
}));

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  storeId: "00000000-0000-4000-8000-000000000010",
  displayName: "Owner",
};

const healthyReport = {
  ok: true,
  code: "reconciled",
  store_id: actor.storeId,
  checked_at: "2026-07-18T20:00:00.000Z",
  healthy: true,
  total_units: 1,
  total_v1_marked_items: 1,
  linked_pairs: 1,
  missing_v2_units: 0,
  missing_v1_items: 0,
  payload_link_mismatches: 0,
  status_mismatches: 0,
  movement_mismatches: 0,
  identifier_mismatches: 0,
  intake_ledger_mismatches: 0,
  sale_ledger_mismatches: 0,
};

describe("reconcileInventoryV2", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("injects the authenticated store and actor into the read-only RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: healthyReport, error: null });

    await expect(reconcileInventoryV2(actor)).resolves.toEqual(healthyReport);
    expect(mocks.rpc).toHaveBeenCalledWith("repairdesk_inventory_v2_reconcile", {
      p_store_id: actor.storeId,
      p_actor_id: actor.id,
    });
  });

  it("fails closed on authorization or malformed metrics", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "actor_forbidden" }, error: null });
    await expect(reconcileInventoryV2(actor)).rejects.toThrow(/店主或店长/);

    mocks.rpc.mockResolvedValue({
      data: { ...healthyReport, movement_mismatches: -1 },
      error: null,
    });
    await expect(reconcileInventoryV2(actor)).rejects.toThrow(/结果不完整/);
  });

  it("does not expose Supabase details when the dependency fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "SECRET database schema detail" },
    });
    await expect(reconcileInventoryV2(actor)).rejects.toMatchObject({
      code: "INVENTORY_V2_DEPENDENCY_UNAVAILABLE",
      status: 503,
      message: "库存 V2 对账服务暂时不可用",
    });
  });
});
