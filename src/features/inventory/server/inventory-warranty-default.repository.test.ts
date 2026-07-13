import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveInventoryIntakeWarrantyMonths } from "@/features/inventory/server/inventory-warranty-default.repository";

const mocks = vi.hoisted(() => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

describe("inventory warranty defaults", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
  });

  it("uses an explicit override without reading mutable store settings", async () => {
    await expect(resolveInventoryIntakeWarrantyMonths("store-a", 0)).resolves.toBe(0);
    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("reads the authenticated store setting when the create input omits a warranty", async () => {
    const query = createSettingsQuery({
      data: { default_inventory_warranty_months: 18 },
      error: null,
    });
    mocks.supabase.from.mockReturnValue(query);

    await expect(resolveInventoryIntakeWarrantyMonths("store-a", undefined)).resolves.toBe(18);
    expect(mocks.supabase.from).toHaveBeenCalledWith("store_settings");
    expect(query.select).toHaveBeenCalledWith("default_inventory_warranty_months");
    expect(query.eq).toHaveBeenCalledWith("store_id", "store-a");
  });

  it("falls back to the shared system default only when the store row is absent", async () => {
    const query = createSettingsQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValue(query);

    await expect(resolveInventoryIntakeWarrantyMonths("store-b", undefined)).resolves.toBe(12);
    expect(query.eq).toHaveBeenCalledWith("store_id", "store-b");
  });

  it("fails closed when the store-scoped settings read fails", async () => {
    const query = createSettingsQuery({ data: null, error: { message: "db unavailable" } });
    mocks.supabase.from.mockReturnValue(query);

    await expect(resolveInventoryIntakeWarrantyMonths("store-a", undefined)).rejects.toThrow(
      "读取库存默认保修失败",
    );
  });
});

function createSettingsQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => result),
  };
  return query;
}
