import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const expand = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260810173524_inventory_product_inspection_atomic_20260810150000.sql",
  ),
  "utf8",
);
const enable = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260810173610_inventory_product_inspection_atomic_enable_20260810150100.sql",
  ),
  "utf8",
);

describe("inventory product inspection persistence migrations", () => {
  it("keeps the expand migration additive, atomic and dormant", () => {
    expect(expand).toContain("select 'inventory product base tables' as requirement");
    expect(expand).toContain("create table if not exists public.inventory_device_inspections");
    expect(expand).toContain(
      "create or replace function public.repairdesk_inventory_lifecycle_checks_valid",
    );
    expect(expand).toContain("inventory_device_inspections_unit_item_same_store_fkey");
    expect(expand).toContain("inventory_stock_units_id_legacy_item_store_unique_idx");
    expect(expand).toContain("inventory_device_inspections_append_only");
    expect(expand).toContain("inventory_product_inspection_ledger_append_only");
    expect(expand).toContain(
      "create table if not exists public.inventory_product_inspection_command_ledger",
    );
    expect(expand).toContain(
      "alter table public.inventory_product_inspection_command_ledger enable row level security",
    );
    expect(expand).toContain("inventory_device_inspections_latest_unit_idx");
    expect(expand).toContain("inventory product V2 create/update RPCs");
    expect(expand).toContain("inventory product base tables");
    expect(expand).not.toContain("inventory_product_acquisitions");
    expect(expand).not.toContain("repairdesk_inventory_lifecycle_command");
    expect(expand).toContain("security definer");
    expect(expand).toContain("set search_path = ''");
    expect(expand).toContain("pg_advisory_xact_lock");
    expect(expand).toContain("idempotency_actor_conflict");
    expect(expand).toContain("idempotency_conflict");
    expect(expand).toContain("v_payload ? 'inspection'");
    expect(expand).toContain("jsonb_typeof(v_inspection) is distinct from 'object'");
    expect(expand).toContain("jsonb_object_keys(v_inspection)");
    expect(expand).not.toContain("jsonb_object_length(v_inspection)");
    expect(enable).toContain("attribute_row.attnum is null");
    expect(enable).toContain("attribute_row.attrelid is null");
    expect(enable).not.toContain("attribute_row.oid is null");
    expect(expand).toContain("inventory_product_inspection_create_postcondition_failed");
    expect(expand).toContain("inventory_product_inspection_update_postcondition_failed");
    expect(expand).toContain("inventory_product_inspection_version_postcondition_failed");
    expect(expand).toContain("v_expected_version is distinct from v_version_after - 1");
    expect(expand).toContain(
      "jsonb_typeof(v_inspection -> 'battery_health') is distinct from 'number'",
    );
    expect(expand).toContain("v_inspection -> 'face_id_status' = 'null'::jsonb");
    expect(expand).toContain("insert into public.inventory_device_inspections");
    expect(expand).toContain("insert into public.inventory_product_inspection_command_ledger");
    expect(expand).toContain("v_actor_role not in ('owner', 'manager', 'technician')");
    expect(expand).not.toContain("'sales') then");
    expect(expand).toMatch(
      /revoke all on function public\.repairdesk_inventory_product_save_with_inspection_v1\([\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(expand).not.toMatch(
      /grant execute on function public\.repairdesk_inventory_product_save_with_inspection_v1/i,
    );
    expect(expand).not.toMatch(
      /\b(?:update|delete from|truncate)\s+public\.inventory_device_inspections/i,
    );
  });

  it("enables only after security preflight and grants service_role only", () => {
    const preflight = enable.indexOf("inventory product inspection enable preflight failed");
    const grant = enable.indexOf("grant execute on function");
    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(preflight);
    expect(enable).toMatch(
      /grant execute on function public\.repairdesk_inventory_product_save_with_inspection_v1\([\s\S]*to service_role/i,
    );
    expect(enable).not.toMatch(/grant execute on function[\s\S]*to (?:anon|authenticated)/i);
    expect(enable).toMatch(
      /grant select on table public\.inventory_device_inspections\s+to service_role/i,
    );
    expect(enable).toContain("has_function_privilege(");
    expect(enable).toContain("proc.prosecdef");
    expect(enable).toContain("relrowsecurity");
    expect(enable).toContain("inspection append-only trigger");
    expect(enable).toContain("ledger append-only trigger");
    expect(enable).toContain("inspection columns/types");
    expect(enable).toContain("inspection constraints");
    expect(enable).toContain("ledger constraints");
    expect(enable).toContain("latest inspection index");
    expect(enable).toContain("service-role write ACL");
    expect(enable).not.toContain("20260807120000");
  });
});
