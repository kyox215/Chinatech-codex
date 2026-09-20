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
const precisionMigration = readFileSync(
  "supabase/migrations/20260920202421_customer_finance_precision_consistency.sql",
  "utf8",
).toLowerCase();
const reviewCountsMigration = readFileSync(
  "supabase/migrations/20260920202422_customer_finance_review_counts.sql",
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

describe("customer finance review-count expansion", () => {
  it("removes over-precision amounts from v3 receivables before v4 paging and stats", () => {
    expect(precisionMigration).toContain(
      "raw_order_facts.quotation_amount = round(raw_order_facts.quotation_amount, 2)",
    );
    expect(precisionMigration).toContain(
      "raw_order_facts.deposit_amount = round(raw_order_facts.deposit_amount, 2)",
    );
    expect(precisionMigration).toContain(
      "raw_order_facts.balance_amount = round(raw_order_facts.balance_amount, 2)",
    );
    expect(precisionMigration).toContain("raw_order_facts.deposit_amount >= 0");
    expect(precisionMigration).toContain("raw_order_facts.payment_status = ''");
    expect(precisionMigration).toContain(
      "or raw_order_facts.balance_amount < raw_order_facts.quotation_amount then 'partial'",
    );
    expect(precisionMigration).toContain("order_fact.quotation_amount >= 0");
    expect(precisionMigration).toContain(
      "order_fact.quotation_amount = round(order_fact.quotation_amount, 2)",
    );
    expect(precisionMigration.match(/unpaid_order\.is_collectible/g)).toHaveLength(2);
    expect(precisionMigration).not.toMatch(/\b(update|delete|truncate)\s+public\.repair_orders\b/);
  });

  it("adds a v4 read contract without replacing or dropping v3", () => {
    expect(reviewCountsMigration).toContain(
      "create or replace function public.repairdesk_customer_list_page_v4",
    );
    expect(reviewCountsMigration).toContain("public.repairdesk_customer_list_page_v3(");
    expect(reviewCountsMigration).toContain("'pending_quote_count'");
    expect(reviewCountsMigration).toContain("'finance_review_count'");
    expect(reviewCountsMigration).toContain("classified.quote_rejected::integer");
    expect(reviewCountsMigration).toContain("+ classified.quote_pending::integer");
    expect(reviewCountsMigration).toContain("+ classified.quote_explicitly_approved::integer");
    expect(reviewCountsMigration).toContain("approval_flow_status in ('approved', 'not_required')");
    expect(reviewCountsMigration).toContain("and not classified.quote_pending");
    expect(reviewCountsMigration).toContain("and not classified.quote_rejected");
    expect(reviewCountsMigration).toContain("and classified.quotation_amount > 0");
    expect(reviewCountsMigration).toContain(
      "or classified.balance_amount < classified.quotation_amount",
    );
    expect(reviewCountsMigration).toContain("or classified.payment_status in ('partial', 'paid')");
    expect(reviewCountsMigration).toContain("or financial_state.quote_rejected");
    expect(reviewCountsMigration).toContain(
      "or classified.balance_amount < classified.quotation_amount then 'partial'",
    );
    expect(reviewCountsMigration).not.toContain("and not financial_state.quote_rejected");
    expect(reviewCountsMigration).not.toContain(
      "create or replace function public.repairdesk_customer_list_page_v3",
    );
    expect(reviewCountsMigration).not.toMatch(/\bdrop\s+function\b/);
  });

  it("uses cent precision, tenant scoping, invoker rights and no data rewrite", () => {
    expect(reviewCountsMigration).toContain("round(coalesce(repair_order.quotation_amount, 0), 2)");
    expect(reviewCountsMigration).toContain("repair_order.store_id = p_store_id");
    expect(reviewCountsMigration).toContain("workflow_status.store_id = repair_order.store_id");
    expect(reviewCountsMigration).toContain("security invoker");
    expect(reviewCountsMigration).toContain("set search_path = ''");
    expect(reviewCountsMigration).toContain("from public, anon, authenticated");
    expect(reviewCountsMigration).toContain("to service_role");
    expect(reviewCountsMigration).not.toMatch(
      /\b(update|delete|truncate)\s+public\.repair_orders\b/,
    );
  });
});

function extractV3JsonProjection(sql: string) {
  const start = sql.lastIndexOf("select jsonb_build_object(");
  const end = sql.indexOf("$$;", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end).replace(/\s+/g, " ").trim();
}
