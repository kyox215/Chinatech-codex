import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718103018_order_cost_phase2_ledger_permissions.sql",
);
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("order cost phase-two ledger migration contract", () => {
  it("keeps the phase-one eur projection and adds append-only source evidence", () => {
    expect(sql).toContain("alter table public.repair_order_line_costs");
    expect(sql).toContain("add column evidence_status text not null default 'estimated'");
    expect(sql).toContain("add column original_currency_code text");
    expect(sql).toContain("add column fx_rate_to_eur numeric(20, 10)");
    expect(sql).toContain("create table public.repair_order_line_cost_revisions");
    expect(sql).toContain("create trigger repairdesk_append_cost_revision_v2_trigger");
    expect(sql).toContain("new.cost_amount is distinct from old.cost_amount");
    expect(sql).toContain("'migration_snapshot'");
    expect(sql).not.toContain("drop table public.repair_order_line_costs");
    expect(sql).not.toContain("alter column currency_code drop");
  });

  it("starts default-cost history now without fabricating older effective dates", () => {
    expect(sql).toContain("create table public.store_fault_cost_default_versions");
    expect(sql).toContain("create unique index store_fault_cost_default_versions_open_idx");
    expect(sql).toContain("effective_from, actor_id, created_at");
    expect(sql).toContain("revision, 'migration_snapshot', clock_timestamp()");
    expect(sql).toContain("create trigger repairdesk_version_cost_default_v2_trigger");
    expect(sql).not.toMatch(/effective_from[^;]+created_at\s*-\s*interval/);
  });

  it("keeps new finance tables private and RPC access service-role only", () => {
    for (const table of ["repair_order_line_cost_revisions", "store_fault_cost_default_versions"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table}`);
      expect(sql).toContain(`grant select on table public.${table} to service_role`);
    }
    expect(sql).toContain(
      "revoke all on function public.repairdesk_read_order_cost_history_rpc(uuid, uuid, uuid)",
    );
    expect(sql).toContain(
      "grant execute on function public.repairdesk_read_order_cost_history_rpc(uuid, uuid, uuid)",
    );
    expect(sql).not.toContain(
      "grant select on table public.repair_order_line_cost_revisions to authenticated",
    );
  });

  it("adds manager-grantable capabilities but keeps bulk apply and currency owner-only", () => {
    for (const action of [
      "finance:cost_export",
      "finance:cost_backfill_preview",
      "inventory:cost_allocate",
    ]) {
      expect(sql).toContain(`'${action}'`);
    }
    const grantConstraint = sql.slice(
      sql.indexOf("add constraint store_member_permission_grants_action_check"),
      sql.indexOf("alter table public.repair_order_line_costs"),
    );
    expect(grantConstraint).not.toContain("finance:cost_backfill_apply");
    expect(grantConstraint).not.toContain("finance:currency_manage");
    expect(sql).toContain(
      "p_action not in ('finance:cost_backfill_apply', 'finance:currency_manage')",
    );
    expect(sql).toContain("raise exception 'permission_dependency_missing'");
  });

  it("returns source status and immutable currency snapshots only through the cost RPC", () => {
    const readStart = sql.indexOf(
      "create or replace function public.repairdesk_read_order_line_costs_rpc",
    );
    const historyStart = sql.indexOf(
      "create or replace function public.repairdesk_read_order_cost_history_rpc",
    );
    const readSql = sql.slice(readStart, historyStart);
    expect(readSql).toContain("public.repairdesk_actor_can_read_order_costs");
    expect(readSql).toContain("'evidence_status', cost_row.evidence_status");
    expect(readSql).toContain("'original_currency_code', cost_row.original_currency_code");
    expect(readSql).toContain("'fx_rate_to_eur', cost_row.fx_rate_to_eur");
    expect(readSql).not.toContain("customer_name");
    expect(readSql).not.toContain("serial_or_imei");
  });

  it("keeps mutation audit payloads minimized", () => {
    const grantsStart = sql.indexOf(
      "create or replace function public.repairdesk_replace_member_permission_grants_rpc",
    );
    const defaultsStart = sql.indexOf(
      "create or replace function public.repairdesk_replace_store_fault_cost_defaults_rpc",
    );
    const defaultsSql = sql.slice(defaultsStart);
    expect(sql.slice(grantsStart, defaultsStart)).not.toContain("cost_amount");
    expect(defaultsSql).toContain("'configured_count'");
    const auditStart = defaultsSql.indexOf("insert into public.audit_logs");
    expect(defaultsSql.slice(auditStart)).not.toContain("'default_cost_amount',");
  });
});
