import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260716175044_fix_cancelled_order_customer_finance.sql",
  "utf8",
).toLowerCase();

describe("cancelled customer finance migration", () => {
  it("keeps history separate from valid and finance facts", () => {
    expect(migration).toContain(
      "create or replace function public.repairdesk_customer_list_page_v3",
    );
    expect(migration).toContain("historical_order_count");
    expect(migration).toContain("valid_order_count");
    expect(migration).toContain("lifetime_quoted_amount");
    expect(migration).toContain("outstanding_amount");
    expect(migration).toContain("ro.status::text, '')) = 'cancelled'");
    expect(migration).toContain("ro.exception_status::text, '')) = 'cancelled'");
    expect(migration).toContain("canonical_workflow_status <> 'closed'");
    expect(migration).not.toContain("order_workflow_statuses");
    expect(migration).toContain("filter (where order_fact.is_valid)");
  });

  it("routes v2 callers through v3 and fails closed at the privilege boundary", () => {
    expect(
      migration.match(/create or replace function public\.repairdesk_customer_list_page_v2/g),
    ).toHaveLength(2);
    expect(migration).toContain("its compatible meaning is the v3 `all` work filter");
    expect(migration).toContain("p_work_filter text default 'all'");
    expect(migration).toContain("select public.repairdesk_customer_list_page_v3");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to service_role");
  });

  it("does not rewrite or delete historical order data", () => {
    expect(migration).not.toMatch(/\bupdate\s+public\.repair_orders\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toMatch(/\bdrop\s+(table|column|function|type)\b/);
  });
});
