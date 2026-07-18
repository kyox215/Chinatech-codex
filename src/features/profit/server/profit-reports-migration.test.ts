import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718123000_order_cost_phase2_profit_reports.sql"),
  "utf8",
).toLowerCase();

describe("repair profit report migration contract", () => {
  it("keeps facts private and exposes only a service-role RPC", () => {
    expect(sql).toContain("with (security_invoker = true)");
    expect(sql).toContain("revoke all on table public.repairdesk_order_profit_facts_v1");
    expect(sql).toContain(
      "revoke all on function public.repairdesk_read_profit_center_rpc(uuid, uuid, date, date)",
    );
    expect(sql).toContain(
      "grant execute on function public.repairdesk_read_profit_center_rpc(uuid, uuid, date, date)",
    );
    expect(sql).not.toContain(
      "grant execute on function public.repairdesk_read_profit_center_rpc(uuid, uuid, date, date)\n  to authenticated",
    );
  });

  it("requires the dedicated profit permission and bounds the local-date range", () => {
    expect(sql).toContain("'finance:profit_read'");
    expect(sql).toContain("p_end_date - p_start_date > 366");
    expect(sql).toContain("at time zone v_timezone");
    expect(sql).toContain("'invalid_store_timezone'");
  });

  it("never converts unknown costs into exact margin", () => {
    expect(sql).toContain("when facts.unknown_cost_line_count = 0");
    expect(sql).toContain("then (facts.quote_amount - facts.known_cost_amount)");
    expect(sql).toContain("else null");
    expect(sql).not.toContain("coalesce(facts.quote_gross_margin");
  });

  it("excludes cancelled and refunded orders from quote-margin summaries while labeling rework", () => {
    expect(sql).toContain("fact.status <> 'cancelled'");
    expect(sql).toContain("where not is_refunded and quote_gross_margin is not null");
    expect(sql).toContain("facts.payment_status = 'refunded' as is_refunded");
    expect(sql).toContain("facts.exception_status = 'rework'");
  });

  it("keeps order drilldown PII-free and collection ledger separate", () => {
    const drilldown = sql.slice(sql.indexOf("'orders', coalesce"));
    expect(drilldown).toContain("public_no");
    expect(drilldown).not.toContain("customer_name");
    expect(drilldown).not.toContain("customer_phone");
    expect(drilldown).not.toContain("serial_or_imei");
    expect(sql).toContain("'collection_reference'");
    expect(sql).toContain("ledger.entry_type = 'collection'");
  });
});
