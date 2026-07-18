import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInventoryUnitV2 } from "./inventory-v2-intake.repository";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));
vi.mock("./inventory-v2-feature-flags", () => ({ assertInventoryV2CommandEnabled: vi.fn() }));

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  storeId: "00000000-0000-4000-8000-000000000010",
  displayName: "Owner",
};
const input = {
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  source_type: "manual_stock" as const,
  category: "phone",
  brand: "Apple",
  model: "iPhone 15",
  identifiers: [
    { kind: "imei1" as const, value: "490154203237518", source: "manual" as const, primary: true },
  ],
  cost_amount: 500,
  list_price: 699,
  warranty_months: 12,
  standardization_status: "unstandardized" as const,
  created_at: "2026-07-18T18:00:00.000Z",
};

describe("createInventoryUnitV2", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("injects tenant and actor into the dormant atomic RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "created",
        item_id: "item-1",
        stock_unit_id: "unit-1",
        created_at: input.created_at,
      },
      error: null,
    });
    await expect(createInventoryUnitV2(input, actor)).resolves.toMatchObject({ item_id: "item-1" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_create_inventory_unit_v2",
      expect.objectContaining({ p_store_id: actor.storeId, p_actor_id: actor.id }),
    );
  });

  it("maps duplicate identifiers without falling back to V1", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: false, code: "duplicate_identifier" },
      error: null,
    });
    await expect(createInventoryUnitV2(input, actor)).rejects.toThrow(/已经绑定/);
  });
});
