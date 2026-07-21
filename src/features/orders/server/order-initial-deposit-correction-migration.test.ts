import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260721133000_order_initial_deposit_correction.sql"),
  "utf8",
);

describe("initial deposit correction migration", () => {
  it("keeps correction append-only and atomic", () => {
    expect(sql).toContain("create table if not exists public.order_initial_deposit_corrections");
    expect(sql).toContain("unique (store_id, idempotency_key)");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("insert into public.order_initial_deposit_corrections");
    expect(sql).toContain("update public.repair_orders");
    expect(sql).toContain("insert into public.order_events");
    expect(sql).toContain("insert into public.audit_logs");
  });

  it("enforces role, assignment, history, approval, version, and service-role boundaries", () => {
    expect(sql).toContain("('owner', 'manager', 'sales', 'technician')");
    expect(sql).toContain("v_order.assignee_membership_id is distinct from v_actor_membership_id");
    expect(sql).toContain("payment_history_exists");
    expect(sql).toContain("approval_already_touched");
    expect(sql).toContain("v_order.approval_status::text in ('approved', 'rejected')");
    expect(sql).toContain("v_order.approval_flow_status::text = 'waiting_customer'");
    expect(sql).toContain("no_change");
    expect(sql).toContain("stale_version");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("to service_role");
    expect(sql).not.toContain("security definer");
    expect(sql).not.toMatch(/\bdelete\s+from\b|\btruncate\b/);
  });
});
