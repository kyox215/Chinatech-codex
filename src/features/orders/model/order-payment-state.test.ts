import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/types";

import { getOrderLiveOutstandingAmount, isOrderPaymentCollectible } from "./order-payment-state";

function order(overrides: Partial<OrderListItem> = {}) {
  return {
    status: "repairing",
    balance_amount: 70,
    is_paid: false,
    ...overrides,
  } as OrderListItem;
}

describe("order payment state", () => {
  it("keeps completed unpaid orders collectible", () => {
    expect(isOrderPaymentCollectible(order({ status: "completed" }))).toBe(true);
  });

  it.each([
    { status: "cancelled" as const },
    { status: "repairing" as const, exception_status: "cancelled" as const },
    { status: "repairing" as const, workflow_bucket: "cancelled" as const },
    { status: "repairing" as const, record_state: "voided" as const },
    { status: "repairing" as const, deleted_at: "2026-07-16T20:00:00.000Z" },
  ])("blocks cancelled orders and projects zero live outstanding", (state) => {
    const cancelled = order(state);
    expect(isOrderPaymentCollectible(cancelled)).toBe(false);
    expect(getOrderLiveOutstandingAmount(cancelled)).toBe(0);
  });

  it("keeps custom done orders with a positive balance collectible", () => {
    expect(isOrderPaymentCollectible(order({ status: "repairing", workflow_bucket: "done" }))).toBe(
      true,
    );
  });
});
