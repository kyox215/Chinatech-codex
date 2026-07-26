import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718175622_inventory_product_v2_foundation.sql"),
  "utf8",
);
const identitySql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718181148_inventory_product_v2_identity.sql"),
  "utf8",
);
const grantsSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260718195257_inventory_product_v2_service_role_grants.sql",
  ),
  "utf8",
);
const workflowExpandSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260726181436_inventory_v2_workflow_expand.sql"),
  "utf8",
);
const workflowEnableSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260726181537_inventory_v2_workflow_enable.sql"),
  "utf8",
);
const workflowTypeCompatSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260726182246_inventory_v2_workflow_production_type_compat.sql",
  ),
  "utf8",
);
const workflowIndexesSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260726182556_inventory_v2_workflow_fk_indexes.sql"),
  "utf8",
);

describe("inventory product V2 foundation migration", () => {
  it("adds a dormant atomic workflow and a separate guarded enable migration", () => {
    expect(workflowExpandSql).toContain("create table public.inventory_workflow_command_ledger");
    expect(workflowExpandSql).toContain(
      "create or replace function public.repairdesk_apply_inventory_unit_workflow_v2",
    );
    expect(workflowExpandSql).toContain("security invoker");
    expect(workflowExpandSql).toContain("set search_path = ''");
    expect(workflowExpandSql).toContain("pg_advisory_xact_lock");
    expect(workflowExpandSql).toContain("projection_mismatch");
    expect(workflowExpandSql).toContain("stale_item_version");
    expect(workflowExpandSql).toContain("stale_unit_version");
    expect(workflowExpandSql).toContain("insert into public.inventory_quality_checks");
    expect(workflowExpandSql).toContain("update public.inventory_items");
    expect(workflowExpandSql).toContain("update public.inventory_stock_units");
    expect(workflowExpandSql).toContain("insert into public.inventory_workflow_command_ledger");
    expect(workflowExpandSql).toContain("create trigger inventory_v2_unit_sale_guard");
    expect(workflowExpandSql).toContain("Inventory V2 sale projection or inspection gate failed");
    expect(workflowExpandSql).toMatch(
      /revoke all on function public\.repairdesk_apply_inventory_unit_workflow_v2\([\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(workflowExpandSql).not.toMatch(
      /grant execute on function public\.repairdesk_apply_inventory_unit_workflow_v2/i,
    );
    expect(workflowEnableSql).toContain("legacy/V2 projection mismatch");
    expect(workflowEnableSql).toMatch(
      /grant execute on function public\.repairdesk_apply_inventory_unit_workflow_v2\([\s\S]*to service_role/i,
    );
    expect(workflowEnableSql).not.toMatch(/to (?:anon|authenticated)/i);
  });
  it("keeps the expand slice dormant and service-role-only", () => {
    expect(sql).toContain(
      "alter table public.inventory_sale_command_ledger enable row level security",
    );
    expect(sql).toMatch(
      /revoke all on table public\.inventory_sale_command_ledger\s+from public, anon, authenticated, service_role/i,
    );
    expect(sql).toMatch(
      /revoke all on function public\.repairdesk_complete_inventory_sale_v2\([\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.repairdesk_complete_inventory_sale_v2/i,
    );
  });

  it("adds service-role-only compatibility aliases for production text columns", () => {
    for (const typeName of [
      "inventory_check_status",
      "inventory_cosmetic_grade",
      "inventory_functional_grade",
      "inventory_item_status",
    ]) {
      expect(workflowTypeCompatSql).toContain(`create domain public.${typeName} as text`);
      expect(workflowTypeCompatSql).toContain(
        `revoke all on domain public.${typeName}\n  from public, anon, authenticated, service_role`,
      );
      expect(workflowTypeCompatSql).toContain(
        `grant usage on domain public.${typeName} to service_role`,
      );
    }
    expect(workflowTypeCompatSql).not.toMatch(/alter table public\.inventory_/i);
    expect(workflowTypeCompatSql).not.toMatch(/\b(?:update|delete from|truncate)\b/i);
  });

  it("covers every workflow-ledger foreign key in FK column order", () => {
    expect(workflowIndexesSql).toContain("(inventory_item_id, store_id)");
    expect(workflowIndexesSql).toContain("(stock_unit_id, store_id)");
    expect(workflowIndexesSql).toContain("(actor_id)");
    expect(workflowIndexesSql.match(/create index if not exists/g)).toHaveLength(3);
  });

  it("uses tenant-safe references and a locked idempotent command", () => {
    expect(sql).toContain("foreign key (inventory_item_id, store_id)");
    expect(sql).toContain("foreign key (buyer_customer_id, store_id)");
    expect(sql).toContain("foreign key (payment_transaction_id, store_id)");
    expect(sql).toContain("unique (store_id, idempotency_key)");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("idempotent_replay");
    expect(sql).toContain("idempotency_conflict");
    expect(sql).toContain("stale_version");
    expect(sql).toContain("p_sale_price::numeric(12, 2)");
    expect(sql).toContain("p_payment_amount::numeric(12, 2)");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
  });

  it("writes sale, payment, event and audit in the same RPC transaction", () => {
    const functionStart = sql.indexOf(
      "create or replace function public.repairdesk_complete_inventory_sale_v2",
    );
    const functionEnd = sql.indexOf("revoke all on function", functionStart);
    const body = sql.slice(functionStart, functionEnd);

    expect(body).toContain("update public.inventory_items");
    expect(body).toContain("insert into public.inventory_transactions");
    expect(body).toContain("insert into public.inventory_sale_command_ledger");
    expect(body).toContain("insert into public.inventory_events");
    expect(body).toContain("insert into public.audit_logs");
    expect(body).toContain("inspection_blocked");
    expect(body).not.toMatch(/exception\s+when/i);
  });

  it("projects V2 stock units and movements in the same sale transaction", () => {
    const functionStart = sql.indexOf(
      "create or replace function public.repairdesk_complete_inventory_sale_v2",
    );
    const functionEnd = sql.indexOf("revoke all on function", functionStart);
    const body = sql.slice(functionStart, functionEnd);

    expect(body).toContain("from public.inventory_stock_units");
    expect(body).toContain("update public.inventory_stock_units");
    expect(body).toContain("status = 'sold'");
    expect(body).toContain("version = version + 1");
    expect(body).toContain("insert into public.inventory_stock_movements");
    expect(body).toContain("'sell'");
    expect(body).toContain("-1");
    expect(body).toContain("p_idempotency_key");
    expect(body).toContain("v2_state_conflict");
  });

  it("adds catalog, variant, serial unit, identifiers and append-only movements", () => {
    for (const table of [
      "inventory_product_catalog_items",
      "inventory_product_variants",
      "inventory_stock_units",
      "inventory_stock_unit_identifiers",
      "inventory_stock_movements",
      "inventory_intake_command_ledger",
    ]) {
      expect(identitySql).toContain(`create table if not exists public.${table}`);
      expect(identitySql).toContain(`alter table public.${table} enable row level security`);
      expect(identitySql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role`,
      );
    }
    expect(identitySql).toContain("foreign key (catalog_item_id, store_id)");
    expect(identitySql).toContain("foreign key (variant_id, store_id)");
    expect(identitySql).toContain("foreign key (stock_unit_id, store_id)");
    expect(identitySql).toContain("inventory_stock_unit_identifiers_active_unique_idx");
    expect(identitySql).toContain("movement_type in ('receive', 'reserve', 'release', 'sell'");
  });

  it("creates intake atomically but leaves runtime execution dormant", () => {
    const functionStart = identitySql.indexOf(
      "create or replace function public.repairdesk_create_inventory_unit_v2",
    );
    const functionEnd = identitySql.indexOf("revoke all on function", functionStart);
    const body = identitySql.slice(functionStart, functionEnd);

    expect(body).toContain("pg_advisory_xact_lock");
    expect(body).toContain("duplicate_identifier");
    expect(body).toContain("invalid_source_party");
    expect(body).toContain("manual_reason_required");
    expect(body).toContain("primary_identifier_required");
    expect(body).toContain("idempotent_replay");
    expect(body).toContain("insert into public.inventory_items");
    expect(body).toContain("insert into public.inventory_stock_units");
    expect(body).toContain("insert into public.inventory_stock_unit_identifiers");
    expect(body).toContain("insert into public.inventory_stock_movements");
    expect(body).toContain("insert into public.inventory_events");
    expect(body).toContain("insert into public.audit_logs");
    expect(identitySql).toMatch(
      /revoke all on function public\.repairdesk_create_inventory_unit_v2\([\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(identitySql).not.toMatch(
      /grant execute on function public\.repairdesk_create_inventory_unit_v2/i,
    );
  });

  it("adds a dormant store-scoped shadow reconciliation RPC", () => {
    const functionStart = identitySql.indexOf(
      "create or replace function public.repairdesk_inventory_v2_reconcile",
    );
    const functionEnd = identitySql.indexOf("revoke all on function", functionStart);
    const body = identitySql.slice(functionStart, functionEnd);

    expect(body).toContain("security invoker");
    expect(body).toContain("set search_path = ''");
    expect(body).toContain("membership.role in ('owner', 'manager')");
    expect(body).toContain("missing_v2_units");
    expect(body).toContain("status_mismatches");
    expect(body).toContain("movement_mismatches");
    expect(body).toContain("identifier_mismatches");
    expect(identitySql).toMatch(
      /revoke all on function public\.repairdesk_inventory_v2_reconcile\(uuid, uuid\)[\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(identitySql).not.toMatch(
      /grant execute on function public\.repairdesk_inventory_v2_reconcile/i,
    );
    expect(grantsSql).toMatch(
      /grant execute on function public\.repairdesk_inventory_v2_reconcile\(uuid, uuid\)[\s\S]*to service_role/i,
    );
    expect(grantsSql).not.toMatch(
      /grant execute on function public\.repairdesk_inventory_v2_reconcile[\s\S]*to (?:anon|authenticated)/i,
    );
  });
});
