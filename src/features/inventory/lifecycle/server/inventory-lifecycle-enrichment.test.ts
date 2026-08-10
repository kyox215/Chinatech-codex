import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, InventoryProductListItem } from "@/lib/repairdesk/types";

const supabaseMock = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("@/server/supabase", () => supabaseMock);

import { enrichInventoryProductLifecycle } from "./inventory-lifecycle.repository";

const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "staff@example.test",
  displayName: "Staff",
  storeId: "00000000-0000-4000-8000-000000000002",
  storeName: "Test Store",
  role: "owner",
  storeRole: "owner",
};

const item = {
  id: "00000000-0000-4000-8000-000000000003",
  sku: "SKU-001",
  category: "phone",
  brand: "Apple",
  model: "iPhone 15",
  status: "in_stock",
  legacy_status: "ready_for_sale",
  currency_code: "EUR",
  updated_at: "2026-08-10T10:00:00.000Z",
} as InventoryProductListItem;

beforeEach(() => {
  vi.stubEnv("INVENTORY_LIFECYCLE_SCHEMA_READY", "0");
  vi.stubEnv("INVENTORY_LIFECYCLE_UI", "0");
  vi.stubEnv("INVENTORY_LIFECYCLE_ALL_STORES_ENABLED", "0");
  supabaseMock.getSupabaseAdmin.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("inventory lifecycle list enrichment", () => {
  it("does not query lifecycle tables while flags are dormant", async () => {
    const result = await enrichInventoryProductLifecycle([item], actor);

    expect(result.lifecycle_projection).toMatchObject({ mode: "compatible" });
    expect(result.items[0].lifecycle).toMatchObject({
      mode: "compatible",
      status: "processing",
      allowed_actions: [],
    });
    expect(supabaseMock.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("uses four fixed batch reads in exact mode", async () => {
    vi.stubEnv("INVENTORY_LIFECYCLE_SCHEMA_READY", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_UI", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_ALL_STORES_ENABLED", "1");
    const calls: string[] = [];
    const builder = (table: string) => {
      calls.push(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        neq: () => chain,
        order: async () => ({
          data:
            table === "inventory_sale_orders"
              ? [
                  {
                    id: "00000000-0000-4000-8000-000000000004",
                    inventory_item_id: item.id,
                    stock_unit_id: "00000000-0000-4000-8000-000000000005",
                    status: "reserved",
                    agreed_price: 420,
                    reserved_at: null,
                    expires_at: null,
                    expected_pickup_at: null,
                    sold_at: null,
                    actual_pickup_at: null,
                    version: 1,
                  },
                ]
              : [],
          error: null,
        }),
      };
      return chain;
    };
    supabaseMock.getSupabaseAdmin.mockReturnValue({ from: builder });

    const result = await enrichInventoryProductLifecycle([item], actor);

    expect(result.lifecycle_projection.mode).toBe("exact");
    expect(calls).toEqual([
      "inventory_stock_units",
      "inventory_sale_orders",
      "inventory_sale_payment_entries",
      "inventory_after_sales_cases",
    ]);
  });

  it("keeps exact read mode but removes command actions when commands are off", async () => {
    vi.stubEnv("INVENTORY_LIFECYCLE_SCHEMA_READY", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_UI", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_ALL_STORES_ENABLED", "1");
    vi.stubEnv("INVENTORY_LIFECYCLE_COMMANDS", "0");
    const exactItem = {
      ...item,
      legacy_status: "listed",
    } as InventoryProductListItem;
    const responseFor = (table: string) => ({
      data:
        table === "inventory_stock_units"
          ? [
              {
                id: "00000000-0000-4000-8000-000000000005",
                legacy_inventory_item_id: exactItem.id,
                status: "listed",
                version: 1,
              },
            ]
          : [],
      error: null,
    });
    const builder = (table: string) => {
      const response = responseFor(table);
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        neq: () => chain,
        order: () => Promise.resolve(response),
        then: (resolve: (value: typeof response) => unknown) =>
          Promise.resolve(response).then(resolve),
      };
      return chain;
    };
    supabaseMock.getSupabaseAdmin.mockReturnValue({ from: builder });

    const result = await enrichInventoryProductLifecycle([exactItem], actor);

    expect(result.lifecycle_projection.mode).toBe("exact");
    expect(result.items[0].lifecycle).toMatchObject({
      mode: "exact",
      status: "in_stock",
      allowed_actions: [],
    });
  });
});
