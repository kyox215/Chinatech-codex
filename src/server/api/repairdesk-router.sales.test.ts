import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditActor } from "@/lib/repairdesk/types";
const mocks = vi.hoisted(() => ({
  command: vi.fn(),
  summary: vi.fn(),
  detail: vi.fn(),
  receipt: vi.fn(),
  list: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock("@/server/supabase", () => ({ hasSupabaseConfig: () => true, getSupabaseAdmin: vi.fn() }));
vi.mock("@/features/inventory/sales/server/sales.repository", () => ({
  runInventorySalesCommand: mocks.command,
  readInventorySalesSummary: mocks.summary,
  readInventorySalesDetail: mocks.detail,
  readInventorySalesReceipt: mocks.receipt,
  readInventorySalesList: mocks.list,
}));
vi.mock("@/features/realtime/server/realtime-broadcast", () => ({
  queueRepairDeskRealtimeBroadcast: mocks.broadcast,
}));
import { handleRepairDeskPost } from "./repairdesk-router";
const id = "20000000-0000-4000-8000-000000000001",
  store = "10000000-0000-4000-8000-000000000001",
  date = "2026-09-01T10:00:00Z";
const actor: AuditActor = { id, role: "owner", storeId: store, displayName: "Synthetic" };
const create = () => ({
  command: "sale.create",
  idempotency_key: id,
  payload: {
    inventory_item_id: id,
    stock_unit_id: id,
    expected_item_updated_at: date,
    expected_unit_version: 1,
    customer_id: id,
    price_cents: 10000,
    agreed_at: date,
    payment: { amount_cents: 3000, method: "cash", occurred_at: date },
    used_device: true,
    terms_version: "inventory-sales-2026-09-v1",
  },
});
describe("sales routes authorization and metadata-only realtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INVENTORY_SALES_SCHEMA_READY", "1");
    vi.stubEnv("INVENTORY_SALES_UI", "1");
    vi.stubEnv("INVENTORY_SALES_COMMANDS", "1");
    vi.stubEnv("INVENTORY_SALES_STORE_ALLOWLIST", store);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("requires command permissions at the router, even if repository is replaced", async () => {
    expect(
      (
        await handleRepairDeskPost("inventory/sales/command", create(), {
          ...actor,
          role: "technician",
        })
      ).status,
    ).toBe(403);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("rejects injected store and actor data", async () => {
    expect(
      (
        await handleRepairDeskPost(
          "inventory/sales/command",
          { ...create(), store_id: store },
          actor,
        )
      ).status,
    ).toBe(400);
    expect(
      (await handleRepairDeskPost("inventory/sales/summary", { id, actor_id: id }, actor)).status,
    ).toBe(400);
    expect(mocks.command).not.toHaveBeenCalled();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it("broadcasts only safe invalidation metadata after committed success", async () => {
    mocks.command.mockResolvedValue({
      ok: true,
      code: "completed",
      sale_order_id: id,
      paid_cents: 3000,
    });
    expect((await handleRepairDeskPost("inventory/sales/command", create(), actor)).status).toBe(
      200,
    );
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
    expect(JSON.stringify(mocks.broadcast.mock.calls)).not.toContain("paid_cents");
  });
  it("does not emit successful invalidation for a rejected transaction", async () => {
    mocks.command.mockRejectedValue(
      Object.assign(new Error("conflict"), { code: "stale_version", status: 409 }),
    );
    expect((await handleRepairDeskPost("inventory/sales/command", create(), actor)).status).toBe(
      409,
    );
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });
  it("distinguishes scoped inventory reading from receipt output permission", async () => {
    mocks.detail.mockResolvedValue(null);
    const tech = { ...actor, role: "technician" as const };
    expect((await handleRepairDeskPost("inventory/sales/detail", { id }, tech)).status).toBe(200);
    expect(
      (await handleRepairDeskPost("inventory/sales/receipt", { id, kind: "sale" }, tech)).status,
    ).toBe(403);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
  it("refuses dormant sales reads without calling the new repository", async () => {
    vi.stubEnv("INVENTORY_SALES_SCHEMA_READY", "0");
    expect((await handleRepairDeskPost("inventory/sales/list", {}, actor)).status).toBe(503);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
