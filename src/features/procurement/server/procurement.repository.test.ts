import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, ReceivePartLotInput } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));

import { receivePartLot } from "./procurement.repository";

const storeId = "00000000-0000-4000-8000-000000000001";
const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Manager",
  storeId,
  storeRole: "manager",
  permissionGrants: ["inventory:cost_allocate"],
};
const base: ReceivePartLotInput = {
  expected_store_id: storeId,
  part_item_id: "00000000-0000-4000-8000-000000000002",
  lot_code: "LOT-1",
  quantity: 2,
  original_unit_cost: 10,
  original_currency_code: "EUR",
  idempotency_key: "00000000-0000-4000-8000-000000000003",
};

beforeEach(() => {
  mocks.rpc.mockReset();
  vi.stubEnv("REPAIRDESK_ORDER_COSTS_ENABLED", "1");
  vi.stubEnv("REPAIRDESK_PARTS_PROCUREMENT_ENABLED", "1");
});

afterEach(() => vi.unstubAllEnvs());

describe("procurement receipt currency contract", () => {
  it("keeps feature-off receipts EUR-only with an exact base snapshot", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: true, code: "received", id: "00000000-0000-4000-8000-000000000004" },
      error: null,
    });
    await expect(
      receivePartLot(
        {
          ...base,
          fx_rate_to_eur: 1,
          fx_rate_at: "2026-07-18T10:00:00.000Z",
          fx_rate_source: "store_base",
        },
        actor,
      ),
    ).resolves.toMatchObject({ replayed: false });
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe("repairdesk_receive_part_lot_rpc");
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_original_currency_code: "EUR",
      p_fx_rate_to_eur: 1,
      p_fx_rate_source: "store_base",
    });
  });

  it("rejects a non-EUR or injected EUR rate before the feature is enabled", async () => {
    await expect(
      receivePartLot({ ...base, original_currency_code: "USD" }, actor),
    ).rejects.toMatchObject({
      code: "multi_currency_disabled",
    });
    await expect(
      receivePartLot({ ...base, fx_rate_to_eur: 0.9, fx_rate_source: "manual" }, actor),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses v2 server-resolved FX and returns the immutable snapshot", async () => {
    vi.stubEnv("REPAIRDESK_COST_MULTI_CURRENCY_ENABLED", "1");
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "received",
        id: "00000000-0000-4000-8000-000000000004",
        unit_cost_eur: 9,
        fx_rate_to_eur: 0.9,
        fx_rate_at: "2026-07-18T10:00:00.000Z",
        fx_rate_source: "owner_manual",
        fx_rate_revision: 2,
      },
      error: null,
    });
    await expect(
      receivePartLot(
        {
          ...base,
          original_currency_code: "USD",
          fx_rate_to_eur: 999,
          fx_rate_at: "2000-01-01T00:00:00.000Z",
          fx_rate_source: "untrusted_client",
        },
        actor,
      ),
    ).resolves.toMatchObject({ unit_cost_eur: 9, fx_rate_to_eur: 0.9, fx_rate_revision: 2 });
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe("repairdesk_receive_part_lot_v2_rpc");
    expect(mocks.rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_fx_rate_to_eur");
  });
});
