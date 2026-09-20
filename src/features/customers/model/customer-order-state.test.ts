import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/types";

import {
  buildCustomerOrderFinanceSummary,
  isCustomerOrderBillable,
  isCustomerOrderCancelled,
  isCustomerOrderClosed,
} from "./customer-order-state";

function order(overrides: Partial<OrderListItem> = {}) {
  return {
    status: "repairing",
    quotation_amount: 70,
    deposit_amount: 0,
    balance_amount: 70,
    is_paid: false,
    payment_status: "unpaid",
    approval_flow_status: "not_required",
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
      pendingQuoteCount: 0,
      financeReviewCount: 0,
      lastOrderAt: "2026-07-16T11:00:00.000Z",
    });
  });

  it("separates pending quotes and finance review from collectible balances", () => {
    const summary = buildCustomerOrderFinanceSummary([
      order({
        quotation_amount: 100,
        balance_amount: 100,
        approval_flow_status: "waiting_customer",
      }),
      order({ quotation_amount: 100, balance_amount: 0, is_paid: false, payment_status: "unpaid" }),
      order({ quotation_amount: 50, balance_amount: 50, approval_flow_status: "approved" }),
    ]);

    expect(summary).toMatchObject({
      outstandingAmount: 50,
      pendingQuoteCount: 1,
      financeReviewCount: 1,
    });
  });

  it("keeps a rejected-only quote out of the settled customer state", () => {
    const summary = buildCustomerOrderFinanceSummary([
      order({
        quotation_amount: 100,
        deposit_amount: 0,
        balance_amount: 100,
        approval_flow_status: "rejected",
      }),
    ]);

    expect(summary).toMatchObject({
      outstandingAmount: 0,
      pendingQuoteCount: 1,
      financeReviewCount: 0,
    });
  });

  it("aggregates customer amounts in cents and excludes over-precision values", () => {
    const summary = buildCustomerOrderFinanceSummary([
      order({ quotation_amount: 0.1, balance_amount: 0.1, approval_flow_status: "approved" }),
      order({ quotation_amount: 0.2, balance_amount: 0.2, approval_flow_status: "approved" }),
      order({ quotation_amount: 1.001, balance_amount: 1.001, approval_flow_status: "approved" }),
    ]);

    expect(summary.lifetimeQuotedAmount).toBe(0.3);
    expect(summary.outstandingAmount).toBe(0.3);
    expect(summary.financeReviewCount).toBe(1);
  });

  it("also excludes exception-cancelled orders whose legacy status was not updated", () => {
    const summary = buildCustomerOrderFinanceSummary([
      order({ status: "repairing", exception_status: "cancelled" }),
    ]);

    expect(summary.validOrderCount).toBe(0);
    expect(summary.lifetimeQuotedAmount).toBe(0);
    expect(summary.outstandingAmount).toBe(0);
  });

  it.each([
    { is_paid: true, payment_status: "paid" as const },
    { is_paid: false, payment_status: "paid" as const },
    { is_paid: false, payment_status: "refunded" as const },
  ])("excludes paid, refunded, and conflicting positive balances from collection", (state) => {
    const summary = buildCustomerOrderFinanceSummary([order(state)]);

    expect(summary.validOrderCount).toBe(1);
    expect(summary.lifetimeQuotedAmount).toBe(70);
    expect(summary.outstandingAmount).toBe(0);
  });
});

describe("customer order state parity", () => {
  it("keeps legacy completed terminal even when canonical workflow is stale", () => {
    const order = { status: "completed" as const, workflow_status: "repair" as const };

    expect(isCustomerOrderClosed(order)).toBe(true);
    expect(isCustomerOrderBillable(order)).toBe(true);
  });

  it("recognizes custom done and cancelled workflow buckets", () => {
    const done = {
      status: "repairing" as const,
      workflow_status: "repair" as const,
      workflow_bucket: "done",
    } as const;
    const cancelled = {
      status: "repairing" as const,
      workflow_status: "repair" as const,
      workflow_bucket: "cancelled",
    } as const;

    expect(isCustomerOrderClosed(done)).toBe(true);
    expect(isCustomerOrderBillable(done)).toBe(true);
    expect(isCustomerOrderCancelled(cancelled)).toBe(true);
    expect(isCustomerOrderClosed(cancelled)).toBe(true);
    expect(isCustomerOrderBillable(cancelled)).toBe(false);
  });

  it("treats voided and soft-deleted rows as cancelled and non-billable", () => {
    expect(isCustomerOrderBillable({ status: "repairing", record_state: "voided" })).toBe(false);
    expect(
      isCustomerOrderBillable({
        status: "repairing",
        deleted_at: "2026-07-16T20:00:00.000Z",
      }),
    ).toBe(false);
  });
});
