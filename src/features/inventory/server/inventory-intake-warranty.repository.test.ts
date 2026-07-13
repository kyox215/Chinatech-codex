import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInventoryIntake } from "@/features/inventory/server/inventory.repository";
import type { AuditActor } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  supabase: { from: vi.fn() },
  writeAuditLog: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

const actor: AuditActor = {
  id: "user-a",
  displayName: "Owner A",
  storeId: "store-a",
};

describe("inventory intake warranty snapshot", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.writeAuditLog.mockReset().mockResolvedValue(undefined);
  });

  it("persists the actor-store default into the new inventory row", async () => {
    const harness = createIntakeHarness({ defaultWarrantyMonths: 18 });
    mocks.supabase.from.mockImplementation(harness.from);

    await createInventoryIntake(
      {
        source_type: "manual_stock",
        initial_status: "listed",
        brand: "Apple",
        model: "iPhone Snapshot",
      },
      actor,
    );

    expect(harness.settingsQuery.eq).toHaveBeenCalledWith("store_id", "store-a");
    expect(harness.inventoryInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store-a",
        warranty_months: 18,
      }),
    );
    expect(harness.eventInsert.insert).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit zero and does not read mutable store settings", async () => {
    const harness = createIntakeHarness({ defaultWarrantyMonths: 24 });
    mocks.supabase.from.mockImplementation(harness.from);

    await createInventoryIntake(
      {
        source_type: "manual_stock",
        initial_status: "listed",
        brand: "Samsung",
        model: "Galaxy No Warranty",
        warranty_months: 0,
      },
      actor,
    );

    expect(harness.settingsQuery.maybeSingle).not.toHaveBeenCalled();
    expect(harness.inventoryInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ warranty_months: 0 }),
    );
  });

  it("fails before any customer or inventory write when the default read fails", async () => {
    const harness = createIntakeHarness({
      defaultWarrantyMonths: 12,
      settingsError: { message: "db unavailable" },
    });
    mocks.supabase.from.mockImplementation(harness.from);

    await expect(
      createInventoryIntake(
        {
          source_type: "manual_stock",
          initial_status: "listed",
          brand: "Apple",
          model: "iPhone Failure",
          customer_name: "Mario",
          customer_phone: "3330000000",
        },
        actor,
      ),
    ).rejects.toThrow("读取库存默认保修失败");

    expect(harness.inventoryInsert.insert).not.toHaveBeenCalled();
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("customers");
  });
});

function createIntakeHarness({
  defaultWarrantyMonths,
  settingsError = null,
}: {
  defaultWarrantyMonths: number;
  settingsError?: unknown;
}) {
  let inventoryPayload: Record<string, unknown> = {};
  const settingsQuery = {
    select: vi.fn(() => settingsQuery),
    eq: vi.fn(() => settingsQuery),
    maybeSingle: vi.fn(() => ({
      data: settingsError ? null : { default_inventory_warranty_months: defaultWarrantyMonths },
      error: settingsError,
    })),
  };
  const inventoryInsert = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      inventoryPayload = payload;
      return inventoryInsert;
    }),
    select: vi.fn(() => inventoryInsert),
    single: vi.fn(() => ({ data: { ...inventoryPayload, public_no: "I000001" }, error: null })),
  };
  const eventInsert = {
    insert: vi.fn(() => ({ error: null })),
  };
  const from = vi.fn((table: string) => {
    if (table === "store_settings") return settingsQuery;
    if (table === "inventory_items") return inventoryInsert;
    if (table === "inventory_events") return eventInsert;
    throw new Error(`Unexpected table: ${table}`);
  });
  return { from, settingsQuery, inventoryInsert, eventInsert };
}
