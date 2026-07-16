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
