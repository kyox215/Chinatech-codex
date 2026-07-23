import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/types";

import {
  deriveOrderFinancialState,
  getOrderLiveOutstandingAmount,
  isOrderCancelledState,
  isOrderPaymentCollectible,
  isOrderTerminalState,
} from "./order-payment-state";

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
    expect(
      isOrderPaymentCollectible(
        order({
          status: "completed",
          quotation_amount: 100,
          deposit_amount: 30,
          balance_amount: 70,
          fault_prices: [{ name: "屏幕", price: 100 }],
          approval_flow_status: "not_required",
        }),
      ),
    ).toBe(true);
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
    expect(
      isOrderPaymentCollectible(
        order({
          status: "repairing",
          workflow_bucket: "done",
          quotation_amount: 100,
          deposit_amount: 30,
          balance_amount: 70,
          fault_prices: [{ name: "屏幕", price: 100 }],
          approval_flow_status: "not_required",
        }),
      ),
    ).toBe(true);
  });

  it("does not present voided history as a cancelled workflow state", () => {
    expect(isOrderCancelledState(order({ record_state: "voided" }))).toBe(false);
    expect(isOrderCancelledState(order({ workflow_bucket: "cancelled" }))).toBe(true);
  });

  it("uses the canonical workflow bucket before the legacy closed flag", () => {
    expect(
      isOrderTerminalState(order({ workflow_bucket: "repair", workflow_status: "closed" })),
    ).toBe(false);
    expect(
      isOrderTerminalState(order({ workflow_bucket: "done", workflow_status: "repair" })),
    ).toBe(true);
    expect(isOrderTerminalState(order({ workflow_status: "closed" }))).toBe(true);
  });

  it.each([
    [
      { quotation_amount: 0, balance_amount: 0, fault_prices: [], is_paid: true },
      "not_due",
      "待报价",
    ],
    [
      {
        quotation_amount: 0,
        balance_amount: 0,
        fault_prices: [{ name: "保修处理", price: 0, currency_code: "EUR" }],
        is_paid: true,
        approval_flow_status: "approved",
      },
      "zero_charge",
      "免收费",
    ],
    [
      {
        quotation_amount: 100,
        balance_amount: 100,
        deposit_amount: 0,
        approval_flow_status: "not_required",
      },
      "unpaid",
      "待收款",
    ],
    [
      {
        quotation_amount: 100,
        balance_amount: 60,
        deposit_amount: 40,
        approval_flow_status: "not_required",
      },
      "partial",
      "已付押金",
    ],
    [
      {
        quotation_amount: 100,
        balance_amount: 0,
        deposit_amount: 100,
        approval_flow_status: "not_required",
        payment_status: "paid",
        is_paid: true,
      },
      "settled",
      "已结清",
    ],
  ] as const)("derives the financial truth table", (overrides, settlement, label) => {
    expect(deriveOrderFinancialState(order(overrides as Partial<OrderListItem>))).toMatchObject({
      settlement,
      label,
    });
  });

  it("does not call a zero-value quote free before customer approval", () => {
    expect(
      deriveOrderFinancialState(
        order({
          quotation_amount: 0,
          balance_amount: 0,
          fault_prices: [{ name: "保修处理", price: 0 }],
          approval_flow_status: "waiting_customer",
        }),
      ),
    ).toMatchObject({ quote: "awaiting_approval", settlement: "not_due", label: "待审批" });
  });

  it("allows a zero-value quote to be free when approval is not required", () => {
    expect(
      deriveOrderFinancialState(
        order({
          quotation_amount: 0,
          balance_amount: 0,
          fault_prices: [{ name: "保修处理", price: 0 }],
          approval_flow_status: "not_required",
        }),
      ),
    ).toMatchObject({ settlement: "zero_charge", label: "免收费" });
  });

  it("treats refunded orders as non-collectible", () => {
    const refunded = order({
      quotation_amount: 100,
      balance_amount: 100,
      payment_status: "refunded",
    });
    expect(deriveOrderFinancialState(refunded)).toMatchObject({
      settlement: "refunded",
      label: "已退款",
      collectible: false,
    });
    expect(isOrderPaymentCollectible(refunded)).toBe(false);
  });

  it.each([
    ["waiting_customer", 0, 100, "not_due", "待审批"],
    ["rejected", 40, 60, "review", "报价已拒绝 · 款项待核对"],
  ] as const)(
    "does not collect a %s quote before approval",
    (approvalFlowStatus, depositAmount, balanceAmount, settlement, label) => {
      const state = deriveOrderFinancialState(
        order({
          quotation_amount: 100,
          fault_prices: [{ name: "屏幕", price: 100 }],
          approval_flow_status: approvalFlowStatus,
          deposit_amount: depositAmount,
          balance_amount: balanceAmount,
        }),
      );
      expect(state).toMatchObject({ settlement, label, collectible: false });
    },
  );

  it("flags zero balance without payment evidence for review", () => {
    expect(
      deriveOrderFinancialState(
        order({
          quotation_amount: 100,
          fault_prices: [{ name: "屏幕", price: 100 }],
          approval_flow_status: "approved",
          deposit_amount: 0,
          balance_amount: 0,
          payment_status: "unpaid",
          is_paid: false,
        }),
      ),
    ).toMatchObject({ settlement: "review", label: "金额待核对", collectible: false });
  });

  it("does not collect a legacy positive balance without a quote", () => {
    expect(deriveOrderFinancialState(order())).toMatchObject({
      quote: "not_quoted",
      settlement: "review",
      collectible: false,
    });
  });

  it.each([
    { quotation_amount: -1 },
    { deposit_amount: -1 },
    { balance_amount: -1 },
    { quotation_amount: Number.NaN },
  ])("sends invalid raw amounts to review", (overrides) => {
    expect(
      deriveOrderFinancialState(
        order({
          quotation_amount: 100,
          deposit_amount: 0,
          balance_amount: 100,
          fault_prices: [{ name: "屏幕", price: 100 }],
          approval_flow_status: "approved",
          ...overrides,
        }),
      ),
    ).toMatchObject({ settlement: "review", label: "金额待核对", collectible: false });
  });

  it.each([
    [80, 40, false, "partial"],
    [0, 100, true, "paid"],
    [40, 60, false, "unpaid"],
  ] as const)(
    "sends inconsistent approved amounts to review",
    (depositAmount, balanceAmount, isPaid, paymentStatus) => {
      expect(
        deriveOrderFinancialState(
          order({
            quotation_amount: 100,
            fault_prices: [{ name: "屏幕", price: 100 }],
            approval_flow_status: "approved",
            deposit_amount: depositAmount,
            balance_amount: balanceAmount,
            is_paid: isPaid,
            payment_status: paymentStatus,
          }),
        ),
      ).toMatchObject({ settlement: "review", label: "金额待核对", collectible: false });
    },
  );
});
