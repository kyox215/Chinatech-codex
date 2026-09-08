import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as permissions from "@/server/permissions";
import type { AuditActor } from "@/lib/repairdesk/types";
import { inventorySalesCommandBodySchema, type InventorySalesSummary } from "../model/contracts";
import {
  readInventorySalesReceipt,
  readInventorySalesSummary,
  readInventorySalesList,
  readInventorySalesDetail,
  inventorySalesCapabilities,
  withInventorySalesActions,
  runInventorySalesCommand,
} from "./sales.repository";
import { inventorySalesRequiredPermissions } from "./sales-access";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.audit }));
const store = "10000000-0000-4000-8000-000000000001",
  id = "20000000-0000-4000-8000-000000000001",
  date = "2026-09-01T12:00:00Z";
const actor: AuditActor = {
  id,
  activeMembershipId: "synthetic-member",
  storeId: store,
  storeName: "Synthetic",
  role: "owner",
  displayName: "Synthetic",
};
function input() {
  return inventorySalesCommandBodySchema.parse({
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
}
function summary(overrides: Partial<InventorySalesSummary> = {}): InventorySalesSummary {
  return {
    inventory_item_id: id,
    stock_unit_id: id,
    item_updated_at: date,
    unit_version: 1,
    item_status: "listed",
    inspection_missing: [],
    inspection_href: `/inventory/${id}/edit`,
    inspection: {
      imei_check_status: "pass",
      activation_lock_status: "pass",
      data_wipe_status: "pass",
      functional_grade: "passed",
      cosmetic_grade: "good",
      list_price_cents: 10000,
    },
    capabilities: inventorySalesCapabilities(actor),
    allowed_actions: [],
    order: null,
    ...overrides,
  };
}
const flags = {
  INVENTORY_SALES_SCHEMA_READY: "1",
  INVENTORY_SALES_UI: "1",
  INVENTORY_SALES_COMMANDS: "1",
  INVENTORY_SALES_STORE_ALLOWLIST: store,
};
describe("sales BFF repository boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.audit.mockReset().mockResolvedValue({ ok: true });
    for (const [key, value] of Object.entries(flags)) vi.stubEnv(key, value);
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("injects authenticated scope and preserves idempotency key", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        code: "completed",
        sale_order_id: id,
        inventory_item_id: id,
        stock_unit_id: id,
        item_updated_at: date,
        unit_version: 2,
        order_version: 1,
        paid_cents: 3000,
        balance_cents: 7000,
        status: "awaiting_payment",
      },
      error: null,
    });
    await runInventorySalesCommand(input(), actor);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_inventory_sales_command",
      expect.objectContaining({ p_store_id: store, p_actor_id: id, p_idempotency_key: id }),
    );
  });
  it("performs all permission checks for composite commands", () => {
    const create = input();
    expect(inventorySalesRequiredPermissions(create)).toEqual([
      "inventory:read",
      "inventory:sale",
      "reservation:create",
      "payment:collect",
    ]);
    if (create.command === "sale.create") {
      create.payload.payment.amount_cents = 10000;
      create.payload.deliver = true;
      create.payload.delivered_at = date;
    }
    expect(inventorySalesRequiredPermissions(create)).toEqual([
      "inventory:read",
      "inventory:sale",
      "payment:collect",
      "pickup:confirm",
    ]);
  });
  it.each(["technician", "viewer"] as const)("blocks %s before DB", async (role) => {
    await expect(runInventorySalesCommand(input(), { ...actor, role })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("stays dormant with no schema and never touches absent tables", async () => {
    vi.stubEnv("INVENTORY_SALES_SCHEMA_READY", "0");
    await expect(readInventorySalesSummary(id, actor)).rejects.toMatchObject({
      status: 503,
      code: "feature_disabled",
    });
    await expect(runInventorySalesCommand(input(), actor)).rejects.toMatchObject({ status: 503 });
    await expect(
      readInventorySalesList({ queue: "all", search: "", limit: 30, offset: 0 }, actor),
    ).rejects.toMatchObject({ status: 503 });
    await expect(readInventorySalesReceipt({ id, kind: "sale" }, actor)).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("denies an unallowlisted store before querying", async () => {
    await expect(readInventorySalesSummary(id, { ...actor, storeId: id })).rejects.toMatchObject({
      code: "feature_disabled",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("maps conflicts and hides raw database errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ok: false, code: "stale_version" } });
    await expect(runInventorySalesCommand(input(), actor)).rejects.toMatchObject({
      status: 409,
      code: "stale_version",
    });
    mocks.rpc.mockResolvedValueOnce({ error: { message: "private table SECRET" } });
    await expect(runInventorySalesCommand(input(), actor)).rejects.toMatchObject({
      status: 503,
      code: "unavailable",
    });
  });
  it("gates store output identity before fetching receipt PII", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { store_id: store, store_name: "Synthetic" },
      error: null,
    });
    const receipt = await readInventorySalesReceipt({ id, kind: "sale" }, actor);
    expect(receipt).toMatchObject({
      store_id: store,
      language: "it",
      document: null,
      output_identity: { canOutput: false, recoveryTarget: "store" },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes current identity separately from persisted receipt snapshots", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        store_id: store,
        store_name: "Synthetic",
        store_address: "Synthetic Road",
        store_phone: "+39000000001",
        message_signature: "Synthetic",
        print_footer: "Synthetic footer",
        inventory_sales_print_language: "en",
      },
      error: null,
    });
    mocks.rpc
      .mockResolvedValueOnce({ data: { allowed: true }, error: null })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          data: {
            kind: "payment",
            order: { balance_cents: 7000, inventory_item_id: id },
            product: { identifier: "SYN-PRIVATE-SERIAL" },
            store: { name: "Original Synthetic" },
          },
        },
      });
    const receipt = await readInventorySalesReceipt({ id, kind: "payment", payment_id: id }, actor);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "repairdesk_inventory_sales_read",
      expect.objectContaining({ p_language: "en" }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "read_sensitive",
        entityType: "inventory_product_identifiers",
        entityId: id,
        after: { identifier_count: 1, source: "inventory_sales_receipt", sale_order_id: id },
      }),
    );
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("SYN-PRIVATE-SERIAL");
    expect(receipt).toMatchObject({
      language: "en",
      output_identity: { canOutput: true },
      document: { order: { balance_cents: 7000 }, store: { name: "Original Synthetic" } },
    });
  });
  function readySeller() {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        store_id: store,
        store_name: "Synthetic",
        store_address: "Synthetic Road",
        store_phone: "+39000000001",
        message_signature: "Synthetic",
        print_footer: "Synthetic footer",
      },
      error: null,
    });
  }
  it.each([
    [{ data: { allowed: false } }, 429],
    [{ data: null, error: { message: "Synthetic offline" } }, 503],
  ])("does not read a receipt after limiter refusal", async (result, status) => {
    readySeller();
    mocks.rpc.mockResolvedValueOnce(result);
    await expect(readInventorySalesReceipt({ id, kind: "sale" }, actor)).rejects.toMatchObject({
      status,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("repairdesk_consume_authenticated_rate_limit_rpc");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("requires membership for plain identifiers", async () => {
    readySeller();
    await expect(
      readInventorySalesReceipt({ id, kind: "sale" }, { ...actor, activeMembershipId: undefined }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("fails output if sensitive-read audit fails", async () => {
    readySeller();
    mocks.rpc.mockResolvedValueOnce({ data: { allowed: true } }).mockResolvedValueOnce({
      data: {
        ok: true,
        data: { order: { inventory_item_id: id }, product: { identifier: "SYN-PRIVATE-SERIAL" } },
      },
    });
    mocks.audit.mockRejectedValueOnce(new Error("Synthetic audit unavailable"));
    await expect(readInventorySalesReceipt({ id, kind: "sale" }, actor)).rejects.toThrow(
      "Synthetic audit unavailable",
    );
  });
  it("exposes a historical seller block without replacing snapshot from current settings", async () => {
    readySeller();
    mocks.rpc
      .mockResolvedValueOnce({ data: { allowed: true } })
      .mockResolvedValueOnce({ data: { ok: false, code: "historical_store_identity_incomplete" } });
    await expect(readInventorySalesReceipt({ id, kind: "sale" }, actor)).rejects.toMatchObject({
      code: "historical_store_identity_incomplete",
      status: 409,
      message: expect.stringContaining("销售时保存的店铺资料不完整"),
    });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("keeps print capability aligned with the plaintext inventory-update permission", () => {
    const original = permissions.can;
    const spy = vi
      .spyOn(permissions, "can")
      .mockImplementation((candidate, action, context) =>
        action === "inventory:update" ? false : original(candidate, action, context),
      );
    try {
      expect(inventorySalesCapabilities(actor).print_kinds).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
  it("reports workflow rollout and role permissions independently of sales commands", () => {
    vi.stubEnv("INVENTORY_V2_SCHEMA_READY", "0");
    expect(inventorySalesCapabilities(actor, summary())).toMatchObject({
      ui_enabled: true,
      can_reserve: true,
      can_collect_and_deliver: true,
      can_inspect: false,
      inspection_block_reason: "workflow_disabled",
    });
    vi.stubEnv("INVENTORY_V2_SCHEMA_READY", "1");
    vi.stubEnv("INVENTORY_V2_COMMANDS", "1");
    vi.stubEnv("INVENTORY_V2_STORE_ALLOWLIST", store);
    expect(inventorySalesCapabilities({ ...actor, role: "sales" }, summary())).toMatchObject({
      can_inspect: false,
      inspection_block_reason: "permission_denied",
      can_prepare_for_sale: true,
    });
    expect(inventorySalesCapabilities({ ...actor, role: "technician" }, summary())).toMatchObject({
      can_inspect: true,
      can_collect: false,
      can_reserve: false,
      print_kinds: [],
    });
    expect(inventorySalesCapabilities(actor, summary({ stock_unit_id: null }))).toMatchObject({
      can_inspect: false,
      can_prepare_for_sale: false,
      inspection_block_reason: "stock_unit_required",
    });
  });
  it("keeps intake and old no-unit rows readable without sale actions", async () => {
    expect(
      withInventorySalesActions(
        summary({ inspection_missing: ["functional", "ready_for_sale"], item_status: "intake" }),
        actor,
      )?.allowed_actions,
    ).toEqual([]);
    const legacy = summary({
      stock_unit_id: null,
      unit_version: null,
      inspection_missing: ["stock_unit_required"],
    });
    expect(withInventorySalesActions(legacy, actor)?.allowed_actions).toEqual([]);
    expect(withInventorySalesActions(summary(), actor)?.allowed_actions).toEqual(["sale.create"]);
  });
  it("denies receipt to technician before settings or customer reads", async () => {
    await expect(
      readInventorySalesReceipt({ id, kind: "sale" }, { ...actor, role: "technician" }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("redacts detail customer independently of receipt permission", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        data: {
          ...summary(),
          payments: [],
          warranty: null,
          customer: { name: "Synthetic", phone: "Synthetic" },
        },
      },
    });
    const detail = await readInventorySalesDetail(id, { ...actor, role: "technician" });
    expect(detail?.customer).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    [{ store_id: id }, null, "store_context_mismatch", "reload_store_context"],
    [null, { message: "synthetic error" }, "settings_load_failed", "retry_settings"],
  ])(
    "returns a safe blocked receipt with recovery target",
    async (data, error, blockCode, recoveryTarget) => {
      mocks.maybeSingle.mockResolvedValue({ data, error });
      const receipt = await readInventorySalesReceipt({ id, kind: "sale" }, actor);
      expect(receipt).toMatchObject({
        document: null,
        output_identity: { canOutput: false, blockCode, recoveryTarget },
      });
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("uses one bulk RPC and redacts customer summary for technician", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ok: true,
        data: {
          rows: [{ order: {}, product: {}, customer: { name: "Synthetic", phone: "Synthetic" } }],
          counts: { awaiting_payment: 1, paid_pending_pickup: 0, delivered: 0 },
          total: 1,
        },
      },
    });
    const rows = await readInventorySalesList(
      { queue: "all", search: "", offset: 0, limit: 30 },
      { ...actor, role: "technician" },
    );
    expect(rows.rows[0].customer).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
