import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/types";

import { buildCustomerOrderFinanceSummary } from "./customer-order-state";

function order(overrides: Partial<OrderListItem> = {}) {
  return {
    status: "repairing",
    quotation_amount: 70,
    balance_amount: 70,
    created_at: "2026-07-16T10:00:00.000Z",
    ...overrides,
  } as OrderListItem;
}

describe("customer order finance contract", () => {
  it("keeps cancelled order history while excluding it from every live aggregate", () => {
    const summary = buildCustomerOrderFinanceSummary([
      order(),
      order({
        status: "cancelled",
        exception_status: "cancelled",
        created_at: "2026-07-16T11:00:00.000Z",
      }),
    ]);

    expect(summary).toEqual({
      historicalOrderCount: 2,
      validOrderCount: 1,
      activeOrderCount: 1,
      lifetimeQuotedAmount: 70,
      outstandingAmount: 70,
      lastOrderAt: "2026-07-16T11:00:00.000Z",
    });
  });

  it("also excludes exception-cancelled orders whose legacy status was not updated", () => {
    const summary = buildCustomerOrderFinanceSummary([
      order({ status: "repairing", exception_status: "cancelled" }),
    ]);

    expect(summary.validOrderCount).toBe(0);
    expect(summary.lifetimeQuotedAmount).toBe(0);
    expect(summary.outstandingAmount).toBe(0);
  });
});
