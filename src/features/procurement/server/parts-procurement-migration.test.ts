import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260718113500_order_cost_phase2_parts_procurement.sql",
  ),
  "utf8",
).toLowerCase();

describe("parts procurement migration", () => {
  it("keeps procurement tables store-scoped and browser-private", () => {
    for (const table of [
      "parts_catalog_items",
      "parts_purchase_lots",
      "order_part_allocations",
      "part_stock_movements",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
  });

  it("uses locked, idempotent allocation and compensating release", () => {
    expect(sql).toContain("for update");
    expect(sql).toContain("insufficient_quantity");
    expect(sql).toContain("idempotent_replay");
    expect(sql).toContain("movement_type, quantity_delta");
    expect(sql).toContain("'release', v_allocation.quantity");
  });

  it("protects economic snapshots and exposes RPCs only to service_role", () => {
    expect(sql).toContain("repairdesk_guard_part_lot_immutable");
    expect(sql).toContain("repairdesk_guard_part_allocation_immutable");
    expect(sql).toContain("repairdesk_reject_part_stock_mutation");
    expect(sql).toContain("grant execute on function public.repairdesk_allocate_order_part_rpc");
    expect(sql).not.toContain(
      "grant execute on function public.repairdesk_allocate_order_part_rpc(uuid, uuid, uuid, uuid, uuid, integer, uuid) to authenticated",
    );
  });
});
