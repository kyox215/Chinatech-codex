import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260729123000_inventory_product_quick_create.sql"),
  "utf8",
);
const enableMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729123100_inventory_product_quick_create_enable.sql",
  ),
  "utf8",
);

describe("inventory product quick-create migration", () => {
  it("is additive, tenant-scoped and idempotent", () => {
    expect(migration).toContain(
      "create or replace function public.repairdesk_create_inventory_product",
    );
    expect(migration).toContain("public.inventory_intake_command_ledger");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("idempotent_replay");
    expect(migration).toContain("idempotency_conflict");
  });

  it("keeps buyback out of the product command", () => {
    expect(migration).toContain("'manual_stock'");
    expect(migration).toContain("item.source_type <> 'buyback'");
    expect(migration).not.toContain("'buyback', p_category");
    expect(migration).not.toContain("p_customer_id");
  });

  it("keeps expand dormant and grants only through the enable migration", () => {
    expect(migration).toMatch(
      /revoke all on function[\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(migration).not.toMatch(/grant execute on function[\s\S]*to service_role/i);
    expect(enableMigration).toMatch(/grant execute on function[\s\S]*to service_role/i);
    expect(enableMigration).toMatch(/from public, anon, authenticated, service_role/i);
  });

  it("writes the complete V2 unit graph and nullable amount markers", () => {
    expect(migration).toContain("'cost_provided', p_cost_amount is not null");
    expect(migration).toContain("'list_price_provided', p_list_price is not null");
    expect(migration).toContain("'internal_sku', v_public_no");
    expect(migration).toContain("insert into public.inventory_stock_units");
    expect(migration).toContain("insert into public.inventory_stock_unit_identifiers");
    expect(migration).toContain("insert into public.inventory_stock_movements");
    expect(migration).toContain("insert into public.inventory_intake_command_ledger");
    expect(migration).toContain("'intake', 'manual_stock'");
  });

  it("uses server time and locks normalized identifiers across slots", () => {
    expect(migration).toContain("clock_timestamp()");
    expect(migration).toContain(
      "inventory_stock_unit_identifiers_active_external_value_unique_idx",
    );
    expect(migration).toContain(
      "where retired_at is null and kind in ('imei1', 'imei2', 'serial')",
    );
    expect(migration).toContain("':inventory-product-identifier:'");
    expect(migration).toContain("':inventory-identifier:imei1:'");
    expect(migration).toContain("':inventory-identifier:imei2:'");
    expect(migration).toContain("':inventory-identifier:serial:'");
    expect(migration).toContain("identifier.kind in ('imei1', 'imei2', 'serial')");
  });
});
