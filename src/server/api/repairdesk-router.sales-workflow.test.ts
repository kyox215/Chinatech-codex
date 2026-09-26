import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditActor } from "@/lib/repairdesk/types";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), broadcast: vi.fn() }));
vi.mock("@/server/supabase", () => ({
  hasSupabaseConfig: () => true,
  getSupabaseAdmin: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/features/realtime/server/realtime-broadcast", () => ({
  queueRepairDeskRealtimeBroadcast: mocks.broadcast,
}));
import { handleRepairDeskPost } from "./repairdesk-router";
const id = "20000000-0000-4000-8000-000000000001",
  store = "10000000-0000-4000-8000-000000000001";
const actor: AuditActor = { id, storeId: store, role: "owner", displayName: "Synthetic" };
const input = {
  sale_order_id: id,
  expected_workflow_version: 0,
  idempotency_key: id,
  command: "issue.open",
  payload: { kind: "other", summary: "Private note" },
};
describe("sales workflow BFF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, value] of Object.entries({
      INVENTORY_SALES_SCHEMA_READY: "1",
      INVENTORY_SALES_UI: "1",
      INVENTORY_SALES_COMMANDS: "1",
      INVENTORY_SALES_STORE_ALLOWLIST: store,
    }))
      vi.stubEnv(key, value);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects injected actor/store for all new endpoints", async () => {
    for (const [path, body] of [
      ["command", input],
      ["read", { sale_order_id: id }],
      ["report", { business_date: "2026-09-26" }],
    ] as const) {
      expect(
        (
          await handleRepairDeskPost(
            `inventory/sales/workflow/${path}`,
            { ...body, store_id: store },
            actor,
          )
        ).status,
      ).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("denies ineligible roles before RPC", async () => {
    expect(
      (
        await handleRepairDeskPost(
          "inventory/sales/workflow/read",
          { sale_order_id: id },
          { ...actor, role: "technician" },
        )
      ).status,
    ).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("broadcasts invalidation metadata only after committed command", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ok: true, code: "completed", sale_order_id: id, workflow_version: 1, event_id: id },
      error: null,
    });
    expect(
      (await handleRepairDeskPost("inventory/sales/workflow/command", input, actor)).status,
    ).toBe(200);
    expect(mocks.broadcast).toHaveBeenCalledWith({
      storeId: store,
      domain: "inventory",
      mutation: "updated",
      queryGroups: [
        "inventory.all",
        "inventory.products",
        "inventory.sales",
        "inventory.lifecycle",
      ],
    });
    expect(JSON.stringify(mocks.broadcast.mock.calls)).not.toContain("Private note");
  });
  it("does not invalidate after rejected workflow CAS", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, code: "stale_version" }, error: null });
    expect(
      (await handleRepairDeskPost("inventory/sales/workflow/command", input, actor)).status,
    ).toBe(409);
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });
});
