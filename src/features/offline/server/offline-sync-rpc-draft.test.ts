import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rpcDraftPath =
  "supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft.sql";

function readRpcDraft() {
  return readFileSync(join(process.cwd(), rpcDraftPath), "utf8");
}

describe("offline sync RPC transaction draft", () => {
  it("is explicitly local-only and exposes only service-role functions", () => {
    const sql = readRpcDraft();

    expect(sql).toContain("Local approval draft only");
    expect(sql).toContain(
      "create or replace function public.repairdesk_offline_sync_order_create_rpc",
    );
    expect(sql).toContain(
      "create or replace function public.repairdesk_offline_sync_order_update_rpc",
    );
    expect(sql).toMatch(/language plpgsql\s+security definer\s+set search_path = public, pg_temp/i);
    expect(sql).toMatch(
      /revoke all on function public\.repairdesk_offline_sync_order_create_rpc\(uuid, uuid, text, text, jsonb\)\s+from authenticated/i,
    );
    expect(sql).toMatch(
      /revoke all on function public\.repairdesk_offline_sync_order_update_rpc\(uuid, uuid, text, text, jsonb\)\s+from authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.repairdesk_offline_sync_order_create_rpc\(uuid, uuid, text, text, jsonb\)\s+to service_role/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.repairdesk_offline_sync_order_update_rpc\(uuid, uuid, text, text, jsonb\)\s+to service_role/i,
    );
    expect(sql).not.toMatch(/grant execute .* to authenticated/i);
    expect(sql).not.toMatch(/grant execute .* to anon/i);
  });

  it("claims operation rows with a scoped unique key and row lock before business writes", () => {
    const sql = readRpcDraft();

    expect(sql).toContain("operation_type,\n    operation_id,\n    request_hash");
    expect(sql).toContain(
      "on conflict (store_id, actor_id, operation_type, operation_id) do nothing",
    );
    expect(sql.match(/returning true into v_claimed/g)).toHaveLength(2);
    expect(sql.match(/v_claimed := coalesce\(v_claimed, false\);/g)).toHaveLength(2);
    expect(sql.match(/for update/g)).toHaveLength(5);
    expect(sql).toContain("if v_operation.request_hash <> p_request_hash then");
    expect(sql).toContain("idempotency_conflict");
    expect(sql).toContain("if v_operation.status = 'succeeded' then");
    expect(sql).toContain("idempotent_replay");
    expect(sql.match(/if v_operation\.status in \('conflict', 'blocked'\) then/g)).toHaveLength(2);
    expect(sql.match(/if v_operation\.status = 'failed' then/g)).toHaveLength(2);
    expect(sql).toContain("if not v_claimed");
    expect(sql).toContain("v_operation.updated_at > v_now - interval '5 minutes'");
  });

  it("requires active stores, active non-viewer memberships, and handled update timestamps", () => {
    const sql = readRpcDraft();

    expect(sql.match(/join public\.stores st on st\.id = sm\.store_id/g)).toHaveLength(2);
    expect(sql.match(/and st\.status = 'active'/g)).toHaveLength(2);
    expect(sql.match(/and sm\.role <> 'viewer'/g)).toHaveLength(2);
    expect(sql).toContain("v_base_updated_at_text text");
    expect(sql).toContain("v_base_updated_at := v_base_updated_at_text::timestamptz;");
    expect(sql).toContain("error_code = 'invalid_payload'");
  });

  it("keeps create customer, device, order, event, and operation finalization in the same RPC body", () => {
    const sql = readRpcDraft();

    expect(sql).toContain("insert into public.customers");
    expect(sql).toContain("insert into public.devices");
    expect(sql).toContain("insert into public.repair_orders");
    expect(sql).toContain("insert into public.order_events");
    expect(sql).toContain("set status = 'succeeded'");
    expect(sql).toContain("target_entity_type = 'repair_order'");
    expect(sql).toContain("response_summary = v_response");
    expect(sql).toContain("exception when others then");
    expect(sql).toContain("result_code = 'retryable_error'");
    expect(sql).toContain("error_code = 'transaction_failed'");
  });

  it("keeps operation ids out of order event payloads", () => {
    const sql = readRpcDraft();

    expect(sql).toContain("jsonb_build_object('source', 'offline_sync')");
    expect(sql).not.toContain("'operation_id', p_operation_id");
  });

  it("requires same-store customer and device resolution and duplicate customer review", () => {
    const sql = readRpcDraft();

    expect(sql).toContain("c.store_id = p_store_id");
    expect(sql).toContain("d.store_id = p_store_id");
    expect(sql).toContain("and d.customer_id = v_customer_id");
    expect(sql).toContain("error_code = 'duplicate_customer'");
    expect(sql).toContain("result_code = 'needs_review'");
    expect(sql).toContain("device_not_found_for_customer");
  });

  it("does not accept offline payment or deposit collection in the first RPC subset", () => {
    const sql = readRpcDraft();

    expect(sql).not.toContain("v_order->>'deposit_amount'");
    expect(sql).toContain("'unpaid'");
    expect(sql).toContain("false");
  });

  it("keeps update scoped to order fields with optimistic stale-version conflict", () => {
    const sql = readRpcDraft();

    expect(sql).toContain("v_base_updated_at");
    expect(sql).toContain("v_existing_updated_at is distinct from v_base_updated_at");
    expect(sql).toContain("result_code = 'stale_version'");
    expect(sql).toContain("device_master_update_deferred");
    expect(sql).toContain("set issue_description = case");
    expect(sql).toContain("diagnosis_result = case");
    expect(sql).toContain("accessory_notes = case");
    expect(sql).toContain("warranty_months = case");
  });

  it("does not wire realtime, broad API concepts, raw audit, attachments, messages, or unlock columns", () => {
    const sql = readRpcDraft();

    expect(sql).not.toContain("audit_logs");
    expect(sql).not.toContain("message_logs");
    expect(sql).not.toContain("order_attachments");
    expect(sql).not.toContain("inventory_");
    expect(sql).not.toContain("realtime");
    expect(sql).not.toContain("device_unlock_method");
    expect(sql).not.toContain("device_unlock_value");
    expect(sql).not.toContain("device_unlock_pattern");
    expect(sql).not.toContain("signed_url");
    expect(sql).not.toContain("storage_path");
    expect(sql).not.toContain("whatsapp");
  });
});
