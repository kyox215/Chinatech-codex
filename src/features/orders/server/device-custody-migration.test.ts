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

  it("keeps idempotent replay ahead of version rejection and casts persisted enums", () => {
    const replayLookup = sql.indexOf("v_existing_event public.order_events%rowtype");
    const replayReturn = sql.indexOf("'code', 'idempotent_replay'");
    const staleVersion = sql.indexOf("v_order.updated_at <> p_expected_updated_at");

    expect(replayLookup).toBeGreaterThan(0);
    expect(replayReturn).toBeGreaterThan(replayLookup);
    expect(replayReturn).toBeLessThan(staleVersion);
    expect(sql).toContain(")::public.repair_order_status");
    expect(sql).toContain("end::public.approval_status");
    expect(sql).toContain("'sensitive_event_payload'");
  });

  it("limits mutation RPCs to service role and leaves legacy implementations inaccessible", () => {
    expect(sql).toContain(
      "from public, anon, authenticated, service_role;\n\ncreate function public.repairdesk_offline_sync_order_create_rpc",
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

  it("makes offline create custody replay-safe inside the existing transaction", () => {
    expect(sql).toContain(
      "v_custody text := p_payload #>> '{payload,order,device_custody_status}'",
    );
    expect(sql).toContain("'{responseSummary,deviceCustodyStatus}' = v_custody");
    expect(sql).toContain("'deviceCustodyStatus', v_custody");
    expect(sql).toContain("'device_custody_status', v_custody");
    expect(sql).toContain("deposit_amount = v_deposit");
    expect(sql).toContain("balance_amount = greatest(0, order_row.quotation_amount - v_deposit)");
    expect(sql).toContain("when v_deposit > 0 then 'partial'");
  });

  it("requires completed orders to reopen before a device can return to the shop", () => {
    expect(sql).toContain("v_order.status = 'completed'");
    expect(sql).toContain("'code', 'completed_reopen_required'");
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
