import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260716175044_fix_cancelled_order_customer_finance.sql",
  "utf8",
).toLowerCase();
const collectibleMigration = readFileSync(
  "supabase/migrations/20260920192000_customer_finance_collectible_consistency.sql",
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

describe("customer collectible finance migration", () => {
  it("preserves the complete v3 JSON response contract", () => {
    expect(extractV3JsonProjection(collectibleMigration)).toBe(extractV3JsonProjection(migration));
  });

  it("uses one conservative receivable predicate for amounts, filters, and stats", () => {
    expect(collectibleMigration).toContain(
      "create or replace function public.repairdesk_customer_list_page_v3",
    );
    expect(collectibleMigration).toContain("ro.record_state::text");
    expect(collectibleMigration).toContain("ro.deleted_at is not null");
    expect(collectibleMigration).toContain("workflow_status.bucket");
    expect(collectibleMigration).toContain(
      "left join public.order_workflow_statuses as workflow_status",
    );
    expect(collectibleMigration).toContain("coalesce(ro.is_paid, false) as is_paid");
    expect(collectibleMigration).toContain(
      "raw_order_facts.approval_flow_status in ('approved', 'not_required')",
    );
    expect(collectibleMigration).toContain(
      "raw_order_facts.approval_flow_status <> 'waiting_customer'",
    );
    expect(collectibleMigration).toContain("raw_order_facts.approval_flow_status <> 'rejected'");
    expect(collectibleMigration).toContain("raw_order_facts.approval_status <> 'pending'");
    expect(collectibleMigration).toContain(
      "raw_order_facts.deposit_amount + raw_order_facts.balance_amount",
    );
    expect(collectibleMigration).toContain(
      "when raw_order_facts.deposit_amount > 0 then 'partial'",
    );
    expect(collectibleMigration).toContain(
      "sum(order_fact.balance_amount) filter (where order_fact.is_collectible)",
    );
    expect(collectibleMigration.match(/unpaid_order\.is_collectible/g)).toHaveLength(2);
  });

  it("preserves the existing tenant and privilege boundary without rewriting data", () => {
    expect(collectibleMigration).toContain("security invoker");
    expect(collectibleMigration).toContain("set search_path = ''");
    expect(collectibleMigration).toContain("join params on params.store_id = ro.store_id");
    expect(collectibleMigration).toContain("workflow_status.store_id = ro.store_id");
    expect(collectibleMigration).toContain("from public, anon, authenticated, service_role");
    expect(collectibleMigration).toContain("to service_role");
    expect(collectibleMigration).not.toMatch(/\bupdate\s+public\.repair_orders\b/);
    expect(collectibleMigration).not.toMatch(/\bdelete\s+from\b/);
    expect(collectibleMigration).not.toMatch(/\btruncate\b/);
    expect(collectibleMigration).not.toMatch(/\bdrop\s+(table|column|function|type)\b/);
  });
});

function extractV3JsonProjection(sql: string) {
  const start = sql.lastIndexOf("select jsonb_build_object(");
  const end = sql.indexOf("$$;", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end).replace(/\s+/g, " ").trim();
}
