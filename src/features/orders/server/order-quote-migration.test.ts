import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260717213518_order_diagnosis_quote_atomic.sql",
);
const sql = readFileSync(migrationPath, "utf8");
const publishStart = sql.indexOf(
  "create or replace function public.repairdesk_publish_order_quote",
);
const confirmStart = sql.indexOf(
  "create or replace function public.repairdesk_confirm_order_quote_sent",
);
const aclStart = sql.indexOf("revoke all on function public.repairdesk_publish_order_quote");
const publishSql = sql.slice(publishStart, confirmStart);
const confirmSql = sql.slice(confirmStart, aclStart);

describe("atomic order diagnosis quote migration", () => {
  it("is forward-only, bounded and exposes only invoker RPCs to service_role", () => {
    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '60s'");
    expect(sql).toContain("add column if not exists channel text not null default 'whatsapp'");
    expect(sql).toContain("create unique index if not exists order_events_quote_idempotency_idx");
    expect(sql.match(/security invoker/g)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(2);
    expect(sql).not.toContain("security definer");
    expect(sql).toContain(
      "from public, anon, authenticated, service_role;\ngrant execute on function public.repairdesk_publish_order_quote",
    );
    expect(sql).toContain(
      "from public, anon, authenticated, service_role;\ngrant execute on function public.repairdesk_confirm_order_quote_sent",
    );
    expect(sql).not.toMatch(/\bdrop\s+(table|column|function|type)\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });

  it("validates actors, strict quote content, configured transitions and received money", () => {
    expect(publishSql).toContain("v_actor_role not in ('owner', 'manager', 'sales')");
    expect(publishSql).toContain("jsonb_array_length(p_fault_prices) > 50");
    expect(publishSql).toContain("key_name not in ('name', 'price', 'currency_code', 'note')");
    expect(publishSql).toContain("v_price <> round(v_price, 2)");
    expect(publishSql).toContain("'free', 'warranty', 'diagnostic_only'");
    expect(publishSql).toContain("from public.order_payment_ledger");
    expect(publishSql).toContain("'code', 'quote_below_received_amount'");
    expect(publishSql).toContain("transition_row.to_status_code = 'quoted'");
  });

  it("serializes, compares versions and writes order, event and audit atomically", () => {
    for (const functionSql of [publishSql, confirmSql]) {
      expect(functionSql).toContain("pg_catalog.pg_advisory_xact_lock");
      expect(functionSql).toContain("for update");
      expect(functionSql).toContain("v_order.updated_at <> p_expected_updated_at");
      expect(functionSql).toContain("insert into public.order_events");
      expect(functionSql).toContain("insert into public.audit_logs");
      expect(functionSql).toContain("update public.repair_orders");
    }
    expect(publishSql).toContain("'code', 'idempotent_replay'");
    expect(confirmSql).toContain("'code', 'idempotent_replay'");
    expect(confirmSql).toContain("insert into public.message_logs");
    expect(confirmSql).toContain("p_order_id::uuid");
    expect(confirmSql).toContain("'approval_request'");
  });

  it("binds confirmation to the latest unchanged quote without copying private content into audit", () => {
    expect(confirmSql).toContain("v_quote.id::text <> p_quote_event_id");
    expect(confirmSql).toContain("'code', 'quote_outdated'");
    expect(confirmSql).toContain("'code', 'quote_changed'");
    expect(confirmSql).toContain("pg_catalog.md5(v_order.fault_prices::text)");
    expect(confirmSql).toContain("transition_row.to_status_code = 'waiting_approval'");

    const publishAudit = publishSql.slice(publishSql.indexOf("insert into public.audit_logs"));
    const confirmAudit = confirmSql.slice(confirmSql.indexOf("insert into public.audit_logs"));
    expect(publishAudit).not.toContain("v_diagnosis");
    expect(publishAudit).not.toContain("'fault_prices'");
    expect(confirmAudit).not.toContain("'message_body'");
    expect(confirmAudit).not.toContain("p_message_body");
  });
});
