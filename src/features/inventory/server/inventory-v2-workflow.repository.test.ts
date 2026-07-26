import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyInventoryWorkflowV2 } from "./inventory-v2-workflow.repository";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn() }));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      }),
    }),
  }),
}));

vi.mock("./inventory-v2-access", () => ({ assertInventoryV2WorkflowAccess: vi.fn() }));

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  storeId: "00000000-0000-4000-8000-000000000010",
  displayName: "Owner",
};
const input = {
  expected_updated_at: "2026-07-26T00:00:00.000Z",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  operation: "transition" as const,
  target_status: "listed" as const,
};

describe("applyInventoryWorkflowV2", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.maybeSingle.mockResolvedValue({ data: { id: "unit-1", version: 7 }, error: null });
  });

  it("derives store, actor and unit CAS version on the server", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "applied",
        workflow_command_id: "command-1",
        item_id: "item-1",
        stock_unit_id: "unit-1",
        previous_status: "ready_for_sale",
        status: "listed",
        item_updated_at: "2026-07-26T00:01:00.000Z",
        unit_version: 8,
        applied_at: "2026-07-26T00:01:00.000Z",
      },
      error: null,
    });

    await expect(applyInventoryWorkflowV2("item-1", input, actor)).resolves.toMatchObject({
      code: "applied",
      unit_version: 8,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_apply_inventory_unit_workflow_v2",
      expect.objectContaining({
        p_store_id: actor.storeId,
        p_actor_id: actor.id,
        p_item_id: "item-1",
        p_expected_unit_version: 7,
      }),
    );
  });

  it("fails closed for missing units, projection errors and incomplete responses", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(applyInventoryWorkflowV2("item-1", input, actor)).rejects.toThrow(/未找到/);

    mocks.rpc.mockResolvedValueOnce({
      data: { ok: false, code: "projection_mismatch" },
      error: null,
    });
    await expect(applyInventoryWorkflowV2("item-1", input, actor)).rejects.toThrow(/版本不一致/);

    mocks.rpc.mockResolvedValueOnce({ data: { ok: true, code: "applied" }, error: null });
    await expect(applyInventoryWorkflowV2("item-1", input, actor)).rejects.toThrow(/结果不完整/);
  });
});
