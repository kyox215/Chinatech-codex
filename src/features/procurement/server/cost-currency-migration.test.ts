import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260718140000_order_cost_phase2_multi_currency.sql"),
  "utf8",
).toLowerCase();

describe("cost currency migration", () => {
  it("keeps configuration and revisions browser-private", () => {
    for (const table of [
      "store_cost_currency_configs",
      "store_cost_currency_rates",
      "store_cost_currency_rate_revisions",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table}`);
    }
    expect(sql).not.toContain(
      "grant execute on function public.repairdesk_read_cost_currency_settings_rpc(uuid, uuid) to authenticated",
    );
  });

  it("uses owner-managed, append-only rates and a fixed supported currency set", () => {
    expect(sql).toContain("'finance:currency_manage'");
    expect(sql).toContain("cost_currency_mutation_requires_rpc");
    expect(sql).toContain("before update or delete on public.store_cost_currency_rate_revisions");
    expect(sql).toContain("currency_code in ('eur', 'usd', 'gbp', 'cny', 'chf')");
    expect(sql).toContain("currency_code = 'eur'");
    expect(sql).toContain("rate_to_eur = 1");
  });

  it("resolves non-EUR rates on the server and rejects stale or injected snapshots", () => {
    expect(sql).toContain("repairdesk_receive_part_lot_v2_rpc");
    expect(sql).toContain("currency_rate_stale");
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("fx_rate_revision");
    expect(sql).toContain("p_original_currency_code is distinct from 'eur'");
    expect(sql).toContain("return public.repairdesk_receive_part_lot_v2_rpc");
    expect(sql).toContain("repairdesk_read_profit_currency_drilldown_rpc");
    expect(sql).toContain("limit 5001");
  });
});
