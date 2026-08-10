import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

import {
  assertInventoryAfterSalesClosePreconditions,
  assertInventoryAfterSalesUpdatePreconditions,
  assertInventoryReservationCreatePreconditions,
  runInventoryLifecycleCommand,
  resolveInventoryLifecycleAllowedActions,
} from "./inventory-lifecycle.repository";

const supabaseMock = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/server/supabase", () => supabaseMock);

afterEach(() => {
  vi.unstubAllEnvs();
  supabaseMock.getSupabaseAdmin.mockReset();
});

function actor(role: StoreRole): AuditActor {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "staff@example.test",
    displayName: "Staff",
    storeId: "00000000-0000-4000-8000-000000000002",
    storeName: "Test Store",
    role,
    storeRole: role,
  };
}

describe("inventory lifecycle allowed action projection", () => {
  it("projects intake, inspection and reservation only for an in-stock item", () => {
    expect(
      resolveInventoryLifecycleAllowedActions(actor("owner"), {
        businessStatus: "in_stock",
        balance: 0,
        hasActiveCase: false,
      }),
    ).toEqual(
      expect.arrayContaining(["acquisition.save", "inspection.save", "reservation.create"]),
    );
  });

  it("requires an exact paid balance before exposing sale completion", () => {
    const unpaid = resolveInventoryLifecycleAllowedActions(actor("owner"), {
      businessStatus: "reserved",
      orderStatus: "reserved",
      balance: 20,
      hasActiveCase: false,
    });
    const paid = resolveInventoryLifecycleAllowedActions(actor("owner"), {
      businessStatus: "reserved",
      orderStatus: "reserved",
      balance: 0,
      hasActiveCase: false,
    });
    expect(unpaid).toContain("payment.append");
    expect(unpaid).not.toContain("sale.complete");
    expect(paid).toContain("sale.complete");
  });

  it("does not infer mutation capabilities for a viewer", () => {
    expect(
      resolveInventoryLifecycleAllowedActions(actor("viewer"), {
        businessStatus: "delivered",
        orderStatus: "sold",
        balance: 0,
        hasActiveCase: false,
      }),
    ).toEqual([]);
  });

  it("keeps after-sales actions independent from the original sale", () => {
    const delivered = resolveInventoryLifecycleAllowedActions(actor("manager"), {
      businessStatus: "delivered",
      orderStatus: "sold",
      balance: 0,
      hasActiveCase: false,
    });
    const activeCase = resolveInventoryLifecycleAllowedActions(actor("manager"), {
      businessStatus: "after_sales",
      orderStatus: "sold",
      balance: 0,
      hasActiveCase: true,
      afterSalesStatus: "in_progress",
    });
    expect(delivered).toEqual(expect.arrayContaining(["warranty.adjust", "after_sales.create"]));
    expect(activeCase).toContain("after_sales.update");
    expect(activeCase).not.toContain("after_sales.close");
    expect(activeCase).not.toContain("after_sales.create");
  });

  it("requires returned custody and the expected case version before close", () => {
    expect(() =>
      assertInventoryAfterSalesClosePreconditions({
        currentStatus: "in_progress",
        currentVersion: 2,
        expectedVersion: 2,
      }),
    ).toThrow(/必须先登记已返还/);
    expect(() =>
      assertInventoryAfterSalesClosePreconditions({
        currentStatus: "returned",
        returnedAt: "2026-08-10T10:00:00.000Z",
        currentVersion: 3,
        expectedVersion: 2,
      }),
    ).toThrow(/刚刚发生变化/);
    expect(() =>
      assertInventoryAfterSalesClosePreconditions({
        currentStatus: "returned",
        returnedAt: "2026-08-10T10:00:00.000Z",
        currentVersion: 3,
        expectedVersion: 3,
      }),
    ).not.toThrow();
  });

  it("rejects closed as an update target and blocks illegal jumps", () => {
    expect(() =>
      assertInventoryAfterSalesUpdatePreconditions({
        currentStatus: "open",
        targetStatus: "closed",
        currentVersion: 2,
        expectedVersion: 2,
      }),
    ).toThrow(/售后状态刚刚发生变化/);
    expect(() =>
      assertInventoryAfterSalesUpdatePreconditions({
        currentStatus: "returned",
        targetStatus: "in_progress",
        currentVersion: 2,
        expectedVersion: 2,
      }),
    ).toThrow(/售后状态刚刚发生变化/);
  });

  it("allows only a legal update transition", () => {
    expect(() =>
      assertInventoryAfterSalesUpdatePreconditions({
        currentStatus: "open",
        targetStatus: "in_progress",
        currentVersion: 2,
        expectedVersion: 2,
      }),
    ).not.toThrow();
  });

  it("requires listed item and unit versions with no active order or after-sales conflict", () => {
    const base = {
      itemId: "item-1",
      itemStatus: "listed",
      unitItemId: "item-1",
      unitStatus: "listed",
      unitVersion: 2,
      expectedUnitVersion: 2,
    };
    expect(() => assertInventoryReservationCreatePreconditions(base)).not.toThrow();
    expect(() =>
      assertInventoryReservationCreatePreconditions({ ...base, itemStatus: "ready_for_sale" }),
    ).toThrow(/当前状态不能执行/);
    expect(() =>
      assertInventoryReservationCreatePreconditions({
        ...base,
        unitVersion: 3,
      }),
    ).toThrow(/刚刚发生变化/);
    expect(() =>
      assertInventoryReservationCreatePreconditions({
        ...base,
        activeOrder: { inventory_item_id: "item-1" },
      }),
    ).toThrow(/当前状态不能执行/);
    expect(() =>
      assertInventoryReservationCreatePreconditions({
        ...base,
        activeAfterSales: { inventory_item_id: "item-1" },
      }),
    ).toThrow(/当前状态不能执行/);
  });

  it("rechecks the current case before forwarding update commands", async () => {
    vi.stubEnv("INVENTORY_LIFECYCLE_SCHEMA_READY", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_COMMANDS", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_ALL_STORES_ENABLED", "1");
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, code: "updated" }, error: null });
    const currentCase = {
      status: "open",
      returned_at: null,
      version: 2,
    };
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: vi.fn().mockResolvedValue({ data: currentCase, error: null }),
    };
    supabaseMock.getSupabaseAdmin.mockReturnValue({ from: () => query, rpc });
    const base = {
      idempotency_key: "00000000-0000-4000-8000-000000000003",
      payload: {
        case_id: "00000000-0000-4000-8000-000000000004",
        expected_case_version: 2,
        status: "in_progress" as const,
      },
    };

    await expect(
      runInventoryLifecycleCommand({ command: "after_sales.update", ...base }, actor("owner")),
    ).resolves.toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockClear();
    await expect(
      runInventoryLifecycleCommand(
        {
          command: "after_sales.update",
          ...base,
          payload: { ...base.payload, status: "closed" },
        } as never,
        actor("owner"),
      ),
    ).rejects.toMatchObject({ code: "invalid_transition" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechecks item, unit, order and after-sales facts before reservation", async () => {
    vi.stubEnv("INVENTORY_LIFECYCLE_SCHEMA_READY", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_COMMANDS", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_ALL_STORES_ENABLED", "1");
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, code: "reserved" }, error: null });
    const validUnit = {
      id: "00000000-0000-4000-8000-000000000005",
      legacy_inventory_item_id: "00000000-0000-4000-8000-000000000006",
      status: "listed",
      version: 4,
    };
    const tableRows: Record<string, unknown> = {
      inventory_items: { id: validUnit.legacy_inventory_item_id, status: "listed" },
      inventory_sale_orders: null,
      inventory_after_sales_cases: null,
    };
    const builderFor = (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        neq: () => chain,
        maybeSingle: vi.fn().mockResolvedValue({
          data: table === "inventory_stock_units" ? validUnit : tableRows[table],
          error: null,
        }),
      };
      return chain;
    };
    supabaseMock.getSupabaseAdmin.mockReturnValue({
      from: (table: string) => builderFor(table),
      rpc,
    });
    const base = {
      idempotency_key: "00000000-0000-4000-8000-000000000007",
      payload: {
        stock_unit_id: validUnit.id,
        expected_unit_version: validUnit.version,
        agreed_price: 420,
        customer_id: "00000000-0000-4000-8000-000000000008",
      },
    };

    await expect(
      runInventoryLifecycleCommand({ command: "reservation.create", ...base }, actor("owner")),
    ).resolves.toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockClear();
    tableRows.inventory_items = {
      id: validUnit.legacy_inventory_item_id,
      status: "ready_for_sale",
    };
    await expect(
      runInventoryLifecycleCommand({ command: "reservation.create", ...base }, actor("owner")),
    ).rejects.toMatchObject({ code: "invalid_state" });
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockClear();
    tableRows.inventory_items = { id: validUnit.legacy_inventory_item_id, status: "listed" };
    tableRows.inventory_after_sales_cases = {
      id: "00000000-0000-4000-8000-000000000009",
      inventory_item_id: validUnit.legacy_inventory_item_id,
      status: "open",
    };
    await expect(
      runInventoryLifecycleCommand({ command: "reservation.create", ...base }, actor("owner")),
    ).rejects.toMatchObject({ code: "invalid_state" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
