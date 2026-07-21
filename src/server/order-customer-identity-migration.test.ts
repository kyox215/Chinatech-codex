import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260721114549_order_customer_identity_atomic_create.sql",
  ),
  "utf8",
);
const blankNameMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721150000_allow_blank_order_customer_name.sql"),
  "utf8",
);

describe("order customer identity atomic migration", () => {
  it("keeps order creation transactional and service-role-only", () => {
    expect(migration).toContain("create or replace function public.repairdesk_create_order_v2");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("repairdesk_apply_order_cost_inputs_rpc");
    expect(migration).toContain("order_cost_input_failed");
  });

  it("blocks identity conflicts before customer, device, order, and event writes", () => {
    const conflictReturn = migration.indexOf("return v_result;");
    expect(conflictReturn).toBeGreaterThan(migration.indexOf("customer_identity_conflict"));
    expect(conflictReturn).toBeLessThan(migration.indexOf("insert into public.devices"));
    expect(conflictReturn).toBeLessThan(migration.indexOf("insert into public.repair_orders"));
    expect(conflictReturn).toBeLessThan(migration.indexOf("insert into public.order_events"));
  });

  it("stores immutable customer display snapshots on the order", () => {
    expect(migration).toContain("customer_name_snapshot");
    expect(migration).toContain("customer_phone_snapshot");
    expect(migration).toContain("customer_identity_snapshot_source");
    expect(migration).toContain("backfilled_current_profile");
  });

  it("removes only the new-customer blank-name rejection in a forward migration", () => {
    expect(blankNameMigration).toContain("pg_get_functiondef");
    expect(blankNameMigration).toContain("v_required_name_guard");
    expect(blankNameMigration).toContain("replace(v_definition, v_required_name_guard, '')");
    expect(blankNameMigration).toContain("expected customer_name_required guard was not found");
  });
});
