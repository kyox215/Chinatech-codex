import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260716183000_order_device_custody_status.sql",
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
    expect(sql).toContain("p_order_id uuid");
    expect(sql).not.toContain("p_order_id text");
    expect(sql).toContain("p_order_id::text");
    expect(sql).toContain("gen_random_uuid(),");
    expect(sql).not.toContain("gen_random_uuid()::text");
    expect(sql).toContain("p_event_type,\n    v_event_payload");
    expect(sql).not.toContain("p_event_type::public.order_event_type");
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

  it("requires completed orders to reopen before a device can return to the shop", () => {
    expect(sql).toContain("v_order.status = 'completed'");
    expect(sql).toContain("'code', 'completed_reopen_required'");
  });

  it("treats exception cancellation as terminal and blocks handover during physical work", () => {
    expect(sql).toContain("or v_order.exception_status = 'cancelled'");
    expect(sql).toContain("v_order.exception_status is distinct from 'cancelled'");
    expect(sql).toContain("'code', 'custody_handover_requires_flow_change'");
    expect(sql).toContain("from public.order_workflow_statuses as current_status");
    expect(sql).toContain("current_status.code = v_order.status");
    expect(sql).toContain("current_status.bucket in ('diagnosing', 'repair', 'pickup')");
  });

  it("rejects explicit-null custody before change, return, or completion handling", () => {
    const nullGuard = sql.indexOf("coalesce(p_update ->> 'device_custody_status', '') not in");
    const custodyChange = sql.indexOf("v_event_payload ->> 'action' = 'device_custody_changed'");
    const cancelledReturn = sql.indexOf(
      "v_event_payload ->> 'action' = 'custody_return_confirmed'",
    );
    const completion = sql.indexOf("p_update ->> 'status' = 'completed'");

    expect(nullGuard).toBeGreaterThan(0);
    expect(nullGuard).toBeLessThan(custodyChange);
    expect(nullGuard).toBeLessThan(cancelledReturn);
    expect(nullGuard).toBeLessThan(completion);
    expect(sql).toContain("'code', 'invalid_custody_status'");
  });

  it("keeps imports from fabricating delivery time and never restores cleared credentials", () => {
    expect(sql).not.toContain(
      "when v_from = 'with_shop' and v_target = 'with_customer' then v_now",
    );
    expect(sql).not.toContain("when v_target = 'with_shop' then null");
    expect(sql).toContain("'delivered_at', v_from_delivery");
    expect(sql).toContain("delivered_at = v_target_delivery");
    expect(sql).toContain("'credentials_restored', false");
    expect(sql).toContain("'device_custody_credentials_restored', false");
  });
});
