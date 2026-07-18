import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260718133000_order_cost_phase2_history_backfill.sql",
  ),
  "utf8",
).toLowerCase();

describe("historical cost backfill migration contract", () => {
  it("installs a preview-first tool without automatically creating or applying a run", () => {
    expect(sql).toContain("create table public.repair_cost_backfill_runs");
    expect(sql).toContain("create or replace function public.repairdesk_preview_cost_backfill_rpc");
    expect(sql).not.toMatch(/select\s+public\.repairdesk_(preview|apply)_cost_backfill_rpc\s*\(/);
    expect(sql).not.toMatch(/insert\s+into\s+public\.repair_cost_backfill_runs[\s\s]*;\s*$/);
  });

  it("uses historical effective versions and bounded deterministic fixtures", () => {
    expect(sql).toContain("version.effective_from <= order_row.created_at");
    expect(sql).toContain("order_row.created_at < version.effective_to");
    expect(sql).toContain("limit p_max_candidates + 1");
    expect(sql).toContain("pg_catalog.sha256");
    expect(sql).toContain("expected_order_updated_at");
    expect(sql).toContain("expected_order_cost_revision");
    expect(sql).toContain("expected_fault_prices_hash");
  });

  it("inserts an unknown sentinel before assigning a missing stable line ID", () => {
    const applyStart = sql.indexOf(
      "create or replace function public.repairdesk_apply_cost_backfill_rpc",
    );
    const revertStart = sql.indexOf(
      "create or replace function public.repairdesk_revert_cost_backfill_rpc",
    );
    const applySql = sql.slice(applyStart, revertStart);
    const sentinel = applySql.indexOf("insert into public.repair_order_line_costs");
    const jsonUpdate = applySql.indexOf("set fault_prices = v_next_faults");
    expect(sentinel).toBeGreaterThan(-1);
    expect(jsonUpdate).toBeGreaterThan(sentinel);
    expect(applySql).toContain("'historical_unknown', 'unknown'");
    expect(sql).toContain("source_reference_type = 'cost_backfill_candidate'");
  });

  it("reverts by compensation and refuses to overwrite later cost edits", () => {
    expect(sql).toContain("'later_cost_edit_detected'");
    expect(sql).toContain("source_reference_type = 'cost_backfill_revert'");
    expect(sql).toContain("'backfill_reverted'");
    expect(sql).not.toContain("delete from public.repair_order_line_costs");
  });

  it("keeps metadata private and mutation RPCs service-role-only", () => {
    for (const table of ["repair_cost_backfill_runs", "repair_cost_backfill_candidates"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table}`);
      expect(sql).toContain(`grant select on table public.${table} to service_role`);
    }
    expect(sql).toContain("to service_role");
    expect(sql).not.toContain("to authenticated");
  });
});
