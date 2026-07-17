import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718120000_order_cost_defaults.sql",
);
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

const defaultsRpcStart = sql.indexOf(
  "create or replace function public.repairdesk_replace_store_fault_cost_defaults_rpc",
);
const readDefaultsRpcStart = sql.indexOf(
  "create or replace function public.repairdesk_read_store_fault_cost_defaults_rpc",
);
const readOrderRpcStart = sql.indexOf(
  "create or replace function public.repairdesk_read_order_line_costs_rpc",
);
const normalizeTriggerStart = sql.indexOf(
  "create or replace function public.repairdesk_normalize_order_fault_prices",
);
const syncTriggerStart = sql.indexOf(
  "create or replace function public.repairdesk_sync_order_line_costs",
);
const orderRpcStart = sql.indexOf(
  "create or replace function public.repairdesk_replace_order_line_costs_rpc",
);
const applyRpcStart = sql.indexOf(
  "create or replace function public.repairdesk_apply_order_cost_inputs_rpc",
);
const quoteHashTriggerStart = sql.indexOf(
  "create or replace function public.repairdesk_sync_quote_event_fault_prices_hash",
);
const quoteV2Start = sql.indexOf(
  "create or replace function public.repairdesk_publish_order_quote_v2",
);
const grantsRpcStart = sql.indexOf(
  "create or replace function public.repairdesk_replace_member_permission_grants_rpc",
);
const aclStart = sql.indexOf(
  "revoke all on function public.repairdesk_normalize_order_fault_prices",
);

const defaultsRpcSql = sql.slice(defaultsRpcStart, normalizeTriggerStart);
const readDefaultsRpcSql = sql.slice(readDefaultsRpcStart, readOrderRpcStart);
const readOrderRpcSql = sql.slice(readOrderRpcStart, defaultsRpcStart);
const normalizeTriggerSql = sql.slice(normalizeTriggerStart, syncTriggerStart);
const syncTriggerSql = sql.slice(syncTriggerStart, orderRpcStart);
const orderRpcSql = sql.slice(orderRpcStart, applyRpcStart);
const applyRpcSql = sql.slice(applyRpcStart, quoteHashTriggerStart);
const quoteHashTriggerSql = sql.slice(quoteHashTriggerStart, quoteV2Start);
const quoteV2Sql = sql.slice(quoteV2Start, grantsRpcStart);
const grantsRpcSql = sql.slice(grantsRpcStart, aclStart);

describe("order cost defaults migration contract", () => {
  it("adds separate nullable default and order cost records without backfilling history", () => {
    expect(sql).toContain("create table public.store_fault_cost_defaults");
    expect(sql).toContain("create table public.repair_order_line_costs");
    expect(sql).toContain("default_cost_amount numeric(12, 2),");
    expect(sql).toContain("cost_amount numeric(12, 2),");
    expect(sql).toContain("is_active boolean not null default true");
    expect(sql).toContain("unique (store_id, order_id, line_id)");
    expect(sql).toContain(
      "foreign key (order_id, store_id) references public.repair_orders(id, store_id)",
    );
    expect(sql).toContain("default_cost_amount between 0 and 999999.99");
    expect(sql).toContain("cost_amount between 0 and 999999.99");

    const preFunctionDdl = sql.slice(0, sql.indexOf("create or replace function"));
    expect(preFunctionDdl).not.toMatch(/update\s+public\.repair_orders/);
    expect(preFunctionDdl).not.toMatch(/insert\s+into\s+public\.repair_order_line_costs/);
  });

  it("keeps cost tables server-only with RLS and select-only service access", () => {
    for (const table of ["store_fault_cost_defaults", "repair_order_line_costs"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table}`);
      expect(sql).toContain(`grant select on table public.${table} to service_role`);
      expect(sql).not.toContain(`grant all on table public.${table}`);
    }
    expect(sql).not.toContain("to anon;");
    expect(sql).not.toContain("to authenticated;");
  });

  it("makes cost_manage owner-inherent and manager-grantable only", () => {
    expect(sql).toContain("'finance:cost_manage'");
    expect(sql).toContain("membership.role::text = 'owner'");
    expect(sql).toContain("membership.role::text = 'manager'");
    expect(sql).toContain("grant_row.action = 'finance:cost_manage'");
    expect(grantsRpcSql).toContain("if v_role <> 'manager'");
    expect(grantsRpcSql).toContain("'finance:cost_manage'");
    expect(grantsRpcSql).toContain("raise exception 'role_cannot_receive_manager_grants'");
  });

  it("replaces defaults under a store lock and CAS while preserving null versus zero", () => {
    expect(defaultsRpcSql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(defaultsRpcSql).toContain("p_store_id::text || ':order-costs'");
    expect(defaultsRpcSql).toContain("v_current_version <> p_expected_version");
    expect(defaultsRpcSql).toContain("'code', 'stale_version'");
    expect(defaultsRpcSql).toContain("delete from public.store_fault_cost_defaults");
    expect(defaultsRpcSql).toContain("on conflict (store_id, catalog_key) do update");
    expect(defaultsRpcSql).toContain("jsonb_typeof(v_item -> 'default_cost_amount')");
    expect(defaultsRpcSql).not.toContain("coalesce(v_amount, 0)");
  });

  it("normalizes stable line identities from an allowlist and synchronizes active snapshots", () => {
    expect(normalizeTriggerSql).toContain("v_same_position_name");
    expect(normalizeTriggerSql).toContain("v_old_item ->> 'line_id'");
    expect(normalizeTriggerSql).toContain("gen_random_uuid()");
    expect(normalizeTriggerSql).toContain("v_matched_old_ordinal = v_ordinal");
    expect(normalizeTriggerSql).toContain("from public.repair_order_line_costs as historical_cost");
    expect(normalizeTriggerSql).toContain("v_requested_server_generated");
    expect(normalizeTriggerSql).toContain("jsonb_build_object('line_id'");
    expect(normalizeTriggerSql).toContain("jsonb_build_object('catalog_key'");
    expect(normalizeTriggerSql).toContain("if v_item ? 'name'");
    expect(normalizeTriggerSql).toContain("if v_item ? 'price'");
    expect(normalizeTriggerSql).not.toContain("cost_amount");
    expect(normalizeTriggerSql).not.toContain("default_cost_amount");

    expect(syncTriggerSql).toContain("is_active = false");
    expect(syncTriggerSql).toContain("source,");
    expect(syncTriggerSql).toContain("'store_default'");
    expect(syncTriggerSql).toContain("default_row.default_cost_amount");
    expect(syncTriggerSql).toContain("on conflict (store_id, order_id, line_id) do update");
    expect(syncTriggerSql).not.toContain("delete from public.repair_order_line_costs");
  });

  it("updates current order costs with CAS and supports bounded create-time manual or blank inputs", () => {
    for (const rpcSql of [orderRpcSql, applyRpcSql]) {
      expect(rpcSql).toContain("public.repairdesk_actor_can_manage_order_costs");
      expect(rpcSql).toContain("pg_catalog.pg_advisory_xact_lock");
      expect(rpcSql).toContain("for update");
      expect(rpcSql).toContain("v_current_version <> p_expected_version");
      expect(rpcSql).toContain("'code', 'line_set_mismatch'");
      expect(rpcSql).toContain("jsonb_array_length(p_items) > 50");
      expect(rpcSql.indexOf("for update")).toBeLessThan(
        rpcSql.indexOf("pg_catalog.pg_advisory_xact_lock"),
      );
    }
    expect(orderRpcSql).toContain("source = case");
    expect(orderRpcSql).toContain("jsonb_array_length(v_normalized) = 0");
    expect(orderRpcSql).not.toContain("v_active_count <> jsonb_array_length(v_normalized)");
    expect(orderRpcSql).toContain("'manual_blank'");
    expect(applyRpcSql).toContain("v_mode not in ('manual', 'blank')");
    expect(applyRpcSql).toContain("'code', 'unchanged'");

    const orderAudit = orderRpcSql.slice(orderRpcSql.indexOf("insert into public.audit_logs"));
    const applyAudit = applyRpcSql.slice(applyRpcSql.indexOf("insert into public.audit_logs"));
    expect(orderAudit).not.toContain("'cost_amount'");
    expect(orderAudit).not.toContain("default_cost_amount");
    expect(applyAudit).not.toContain("'amount'");
    expect(applyAudit).not.toContain("cost_amount");
  });

  it("keeps quote confirmation compatible through the renamed atomic legacy implementation", () => {
    expect(quoteHashTriggerSql).toContain("new.payload ->> 'action' = 'quote_published'");
    expect(quoteHashTriggerSql).toContain("'{fault_prices_hash}'");
    expect(quoteHashTriggerSql).toContain("pg_catalog.md5(v_fault_prices::text)");
    expect(sql).toContain(") rename to repairdesk_publish_order_quote_legacy;");
    expect(quoteV2Sql).toContain("public.repairdesk_publish_order_quote_legacy(");
    expect(quoteV2Sql).toContain("v_legacy_fault_prices");
    expect(quoteV2Sql).toContain("v_extended_fault_prices");
    expect(quoteV2Sql).toContain("v_current_has_stable_line_ids");
    expect(quoteV2Sql).toContain("jsonb_array_length(v_order.fault_prices) = jsonb_array_length");
    expect(quoteV2Sql).toContain("'_server_generated_line_id'");
    expect(quoteV2Sql).toContain("pg_catalog.set_config");
    expect(quoteV2Sql).toContain("in ('published', 'already_published')");
    expect(quoteV2Sql).toContain("'{fault_prices_hash}'");
    expect(quoteV2Sql).not.toContain("cost_amount");
    expect(quoteV2Sql).not.toContain("default_cost_amount");
  });

  it("rechecks live actor rights inside database read RPCs", () => {
    expect(readDefaultsRpcSql).toContain("repairdesk_actor_can_manage_order_costs");
    expect(readOrderRpcSql).toContain("repairdesk_actor_can_read_order_costs");
    for (const rpcSql of [readDefaultsRpcSql, readOrderRpcSql]) {
      expect(rpcSql).toContain("security definer");
      expect(rpcSql).toContain("set search_path = ''");
      expect(rpcSql).toContain("'code', 'actor_forbidden'");
    }
  });

  it("uses fixed-path security definer RPCs and exposes writes only to service_role", () => {
    for (const name of [
      "repairdesk_replace_store_fault_cost_defaults_rpc",
      "repairdesk_read_store_fault_cost_defaults_rpc",
      "repairdesk_read_order_line_costs_rpc",
      "repairdesk_replace_order_line_costs_rpc",
      "repairdesk_apply_order_cost_inputs_rpc",
      "repairdesk_publish_order_quote_v2",
      "repairdesk_publish_order_quote",
      "repairdesk_replace_member_permission_grants_rpc",
    ]) {
      const functionStart = sql.indexOf(`create or replace function public.${name}`);
      const functionBodyEnd = sql.indexOf("$$;", functionStart);
      const functionSql = sql.slice(functionStart, functionBodyEnd);
      expect(functionStart).toBeGreaterThan(-1);
      expect(functionSql).toContain("security definer");
      expect(functionSql).toContain("set search_path = ''");
      expect(sql).toContain(`revoke all on function public.${name}`);
      expect(sql).toContain(`grant execute on function public.${name}`);
    }
    expect(sql).toContain("from public, anon, authenticated, service_role");
    expect(sql.match(/\) to service_role;/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});
