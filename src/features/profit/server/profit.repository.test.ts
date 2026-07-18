import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => ({ rpc: mocks.rpc }) }));

import { getProfitCenter } from "./profit.repository";

const actor: AuditActor = {
  id: "00000000-0000-4000-8000-000000000010",
  displayName: "Manager",
  storeId: "00000000-0000-4000-8000-000000000001",
  storeRole: "manager",
  permissionGrants: ["finance:profit_read"],
};

beforeEach(() => {
  mocks.rpc.mockReset();
  vi.stubEnv("REPAIRDESK_ORDER_COSTS_ENABLED", "1");
  vi.stubEnv("REPAIRDESK_PROFIT_REPORTS_ENABLED", "1");
});

afterEach(() => vi.unstubAllEnvs());

describe("profit original-currency drilldown", () => {
  it("merges bounded original snapshots while keeping report totals in EUR", async () => {
    vi.stubEnv("REPAIRDESK_COST_MULTI_CURRENCY_ENABLED", "1");
    mocks.rpc.mockResolvedValueOnce({ data: profitResult(), error: null }).mockResolvedValueOnce({
      data: {
        ok: true,
        code: "read",
        overflow: false,
        items: [
          {
            order_id: "00000000-0000-4000-8000-000000000100",
            line_id: "00000000-0000-4000-8000-000000000200",
            line_name: "屏幕",
            cost_amount_eur: 9,
            original_amount: 10,
            original_currency_code: "USD",
            fx_rate_to_eur: 0.9,
            fx_rate_at: "2026-07-18T10:00:00.000Z",
            fx_rate_source: "owner_manual",
            cost_source: "purchase_lot",
            evidence_status: "confirmed",
          },
        ],
      },
      error: null,
    });

    const result = await getProfitCenter(
      { start_date: "2026-07-01", end_date: "2026-07-18" },
      actor,
    );
    expect(result.summary.expected.known_cost_amount).toBe(9);
    expect(result.orders[0]?.currency_costs?.[0]).toMatchObject({
      original_amount: 10,
      original_currency_code: "USD",
      fx_rate_to_eur: 0.9,
      cost_amount_eur: 9,
    });
    expect(mocks.rpc.mock.calls[1]?.[0]).toBe("repairdesk_read_profit_currency_drilldown_rpc");
  });

  it("does not request original currency details while the child feature is disabled", async () => {
    mocks.rpc.mockResolvedValue({ data: profitResult(), error: null });
    await getProfitCenter({ start_date: "2026-07-01", end_date: "2026-07-18" }, actor);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});

function profitResult() {
  return {
    ok: true,
    code: "read",
    timezone: "Europe/Rome",
    start_date: "2026-07-01",
    end_date: "2026-07-18",
    summary: {
      expected: {
        order_count: 1,
        eligible_order_count: 1,
        quote_amount: 60,
        known_cost_amount: 9,
        exact_margin_amount: 51,
        exact_order_count: 1,
        incomplete_order_count: 0,
        estimated_order_count: 0,
        negative_margin_order_count: 0,
      },
      completed: {},
      data_quality: {},
      collection_reference: {},
    },
    trend: [],
    orders: [
      {
        order_id: "00000000-0000-4000-8000-000000000100",
        public_no: "R-USD",
        status: "diagnosing",
        payment_status: "unpaid",
        created_at: "2026-07-18T10:00:00.000Z",
        quote_amount: 60,
        known_cost_amount: 9,
        quote_gross_margin: 51,
        quote_gross_margin_percent: 85,
        quote_line_count: 1,
        unknown_cost_line_count: 0,
        estimated_cost_line_count: 0,
        confirmed_cost_line_count: 1,
        cost_completeness: "confirmed",
        is_refunded: false,
        is_rework: false,
      },
    ],
  };
}
