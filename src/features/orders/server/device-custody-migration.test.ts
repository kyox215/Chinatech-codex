import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260716235650_order_device_custody_finance_reconcile.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("device custody migration", () => {
  it("expands nullable legacy data before setting only a future-row default", () => {
    const functionStart = sql.indexOf(
      "create or replace function public.repairdesk_apply_order_atomic_mutation",
    );
    const expandSql = sql.slice(0, functionStart);

    expect(expandSql).toContain("add column if not exists device_custody_status text");
    expect(expandSql).toContain("device_custody_status is null");
    expect(expandSql).toContain("device_custody_status in ('with_shop', 'with_customer')");
    expect(expandSql.indexOf("add column if not exists")).toBeLessThan(
      expandSql.indexOf("alter column device_custody_status set default 'with_shop'"),
    );
    expect(expandSql).not.toMatch(/device_custody_status\s+set\s+not\s+null/i);
    expect(expandSql).not.toMatch(/update\s+public\.repair_orders[\s\S]*device_custody_status/i);
    expect(expandSql).not.toMatch(/create\s+(unique\s+)?index[\s\S]*device_custody_status/i);
  });

  it("keeps idempotent replay ahead of version rejection and preserves text workflow statuses", () => {
    const replayLookup = sql.indexOf("v_existing_event public.order_events%rowtype");
    const replayReturn = sql.indexOf("'code', 'idempotent_replay'");
    const staleVersion = sql.indexOf("v_order.updated_at <> p_expected_updated_at");

    expect(replayLookup).toBeGreaterThan(0);
    expect(replayReturn).toBeGreaterThan(replayLookup);
    expect(replayReturn).toBeLessThan(staleVersion);
    expect(sql).toContain(
      "v_existing_event.payload ->> 'mutation_fingerprint' is distinct from v_fingerprint",
    );
    expect(sql).not.toContain("::public.repair_order_status");
    expect(sql).toContain("from public.order_workflow_statuses as target_status");
    expect(sql).toContain("target_status.code = p_update ->> 'status'");
    expect(sql).toContain("target_status.enabled");
    expect(sql).toContain(
      "set status = case when p_update ? 'status' then p_update ->> 'status' else v_order.status end",
    );
    expect(sql).toContain("end::public.approval_status");
    expect(sql).toContain("'sensitive_event_payload'");
  });

  it("matches the production uuid order and event identifier contract", () => {
    const atomicStart = sql.indexOf(
      "create or replace function public.repairdesk_apply_order_atomic_mutation",
    );
    const terminalCustodyStart = sql.indexOf(
      "create or replace function public.repairdesk_correct_terminal_order_custody",
    );
    const atomicSql = sql.slice(atomicStart, terminalCustodyStart);

    expect(atomicSql).toContain("p_order_id uuid");
    expect(atomicSql).not.toContain("p_order_id text");
    expect(atomicSql).toContain("p_order_id::text");
    expect(atomicSql).toContain("gen_random_uuid(),");
    expect(atomicSql).not.toContain("gen_random_uuid()::text");
    expect(atomicSql).toContain("p_event_type,\n    v_event_payload");
    expect(atomicSql).not.toContain("p_event_type::public.order_event_type");
    expect(sql).toContain("gen_random_uuid()::text, p_actor_id, v_actor_email");
  });

  it("limits mutation RPCs to service role and leaves legacy implementations inaccessible", () => {
    expect(sql).toContain(
      "create or replace function public.repairdesk_offline_sync_order_create_rpc",
    );
    expect(sql).toContain(
      "revoke all on function public.repairdesk_offline_sync_order_create_rpc(",
    );
    expect(sql).toContain(
      "grant execute on function public.repairdesk_offline_sync_order_create_rpc(",
    );
    expect(sql).toContain(
      "from public, anon, authenticated, service_role;\n\ncreate function public.repairdesk_apply_order_data_batch",
    );
    expect(sql).toContain(
      "from public, anon, authenticated, service_role;\n\ncreate function public.repairdesk_rollback_order_data_batch",
    );
    expect(
      sql.match(/grant execute on function public\.repairdesk_[\s\S]*?to service_role;/g)?.length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("keeps offline create fail-closed until its missing production RPC is rebuilt", () => {
    expect(sql).not.toContain("rename to repairdesk_offline_sync_order_create_rpc_v1");
    expect(sql).not.toContain("repairdesk_offline_sync_order_create_rpc_v1(");
    expect(sql).toContain("select jsonb_build_object('resultCode', 'blocked_operation')");
    expect(sql).toContain("Fail-closed placeholder");
  });

  it("routes terminal custody corrections through an audited owner-manager RPC", () => {
    expect(sql).toContain(
      "create or replace function public.repairdesk_correct_terminal_order_custody",
    );
    expect(sql).toContain(
      "if v_actor_role is null or v_actor_role not in ('owner', 'manager') then",
    );
    expect(sql).toContain(
      "p_device_custody_status is null\n     or p_device_custody_status not in",
    );
    expect(sql).toContain("'code', 'terminal_reopen_required'");
    expect(sql).toContain("'code', 'use_cancelled_return'");
    expect(sql).toContain("'custody_correction'");
    expect(sql).toContain("'action', 'terminal_custody_correction'");
    expect(sql).toContain(
      "grant execute on function public.repairdesk_correct_terminal_order_custody(",
    );
  });

  it("treats legacy and custom cancellation as terminal and blocks physical handover", () => {
    expect(sql).toContain("coalesce(v_order.exception_status::text, '') = 'cancelled'");
    expect(sql).toContain("coalesce(v_current_bucket, '') in ('done', 'cancelled')");
    expect(sql).toContain("coalesce(v_target_bucket, '') = 'cancelled'");
    expect(sql).toContain("p_update ->> 'exception_status' = 'cancelled'");
    expect(sql).toContain("'code', 'custody_handover_requires_flow_change'");
    expect(sql).toContain("from public.order_workflow_statuses as status_row");
    expect(sql).toContain("status_row.code::text = v_order.status::text");
    expect(sql).toContain("coalesce(v_current_bucket, '') in ('diagnosing', 'repair', 'pickup')");
  });

  it("rejects explicit-null custody in both generic and cancelled-return paths", () => {
    const nullGuard = sql.indexOf("coalesce(p_update ->> 'device_custody_status', '') not in");
    const custodyChange = sql.indexOf("v_event_payload ->> 'action' = 'device_custody_changed'");
    const completion = sql.indexOf("p_update ->> 'status' = 'completed'");
    const returnStart = sql.indexOf(
      "create or replace function public.repairdesk_confirm_cancelled_order_return",
    );
    const returnSql = sql.slice(returnStart);
    const returnNullGuard = returnSql.indexOf("v_order.device_custody_status is null");
    const alreadyWithCustomer = returnSql.indexOf(
      "v_order.device_custody_status = 'with_customer'",
    );

    expect(nullGuard).toBeGreaterThan(0);
    expect(nullGuard).toBeLessThan(custodyChange);
    expect(nullGuard).toBeLessThan(completion);
    expect(returnStart).toBeGreaterThan(0);
    expect(returnNullGuard).toBeGreaterThan(0);
    expect(returnNullGuard).toBeLessThan(alreadyWithCustomer);
    expect(sql).toContain("'code', 'invalid_custody_status'");
    expect(returnSql).toContain("'code', 'custody_unknown'");
  });

  it("keeps imports from fabricating delivery time and never restores cleared credentials", () => {
    expect(sql).toContain(
      "and (v_target is null or v_target not in ('with_shop', 'with_customer'))",
    );
    expect(sql).not.toContain(
      "when v_from = 'with_shop' and v_target = 'with_customer' then v_now",
    );
    expect(sql).not.toContain("when v_target = 'with_shop' then null");
    expect(sql).toContain("'delivered_at', v_from_delivery");
    expect(sql).toContain("delivered_at = v_target_delivery");
    expect(sql).toContain("'credentials_restored', false");
    expect(sql).toContain("'device_custody_credentials_restored', false");
  });

  it("extends cancelled return and terminal protection as one atomic custody boundary", () => {
    expect(sql).toContain(
      "create or replace function public.repairdesk_confirm_cancelled_order_return",
    );
    expect(sql).toContain("set completed_at = coalesce(completed_at, v_now)");
    expect(sql).toContain("device_custody_status = 'with_customer'");
    expect(sql).toContain("device_unlock_method = null");
    expect(sql).toContain("'action', 'custody_return_confirmed'");
    expect(sql).toContain("'custody_return',\n    v_request_hash");
    expect(sql).toContain("new.device_custody_status is distinct from old.device_custody_status");
    expect(sql).toContain("new.device_unlock_value is distinct from old.device_unlock_value");
    expect(sql).toContain("physical-work reopen requires shop custody");
    expect(sql).toContain("shop-held device must be returned before void");
  });
});
