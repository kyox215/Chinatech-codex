import { describe, expect, it } from "vitest";

import {
  calculateBalance,
  getOrderAmountAnomalyReasons,
  hasOrderAmountAnomaly,
  inferPaidAmount,
  sumFaultPrices,
} from "./order-calculations";

describe("order calculations", () => {
  it("sums repair line prices", () => {
    expect(sumFaultPrices([{ price: 120 }, { price: 45.5 }, { price: Number.NaN }])).toBe(165.5);
  });

  it("does not allow negative balances", () => {
    expect(calculateBalance(100, 30, 80)).toBe(0);
    expect(calculateBalance(365, 110, 0)).toBe(255);
  });

  it("infers paid amount from quotation, deposit, and balance", () => {
    expect(inferPaidAmount(365, 110, 255)).toBe(0);
    expect(inferPaidAmount(365, 110, 100)).toBe(155);
  });

  it.each([
    {
      quotationAmount: 100,
      depositAmount: 0,
      balanceAmount: 100,
      isPaid: false,
      paymentStatus: "unpaid" as const,
    },
    {
      quotationAmount: 100,
      depositAmount: 20,
      balanceAmount: 60,
      isPaid: false,
      paymentStatus: "partial" as const,
    },
    {
      quotationAmount: 100,
      depositAmount: 20,
      balanceAmount: 0,
      isPaid: true,
      paymentStatus: "paid" as const,
    },
    {
      quotationAmount: 100,
      depositAmount: 0,
      balanceAmount: 100,
      isPaid: false,
      paymentStatus: "refunded" as const,
    },
  ])("accepts a reconcilable amount state", (input) => {
    expect(getOrderAmountAnomalyReasons(input)).toEqual([]);
    expect(hasOrderAmountAnomaly(input)).toBe(false);
  });

  it("detects invalid precision, over-allocation, paid flags and payment status mismatches", () => {
    expect(
      getOrderAmountAnomalyReasons({
        quotationAmount: 100.001,
        depositAmount: 0,
        balanceAmount: 100,
        isPaid: false,
        paymentStatus: "unpaid",
      }),
    ).toEqual(["invalid_amount"]);
    expect(
      getOrderAmountAnomalyReasons({
        quotationAmount: 100,
        depositAmount: 30,
        balanceAmount: 90,
        isPaid: true,
        paymentStatus: "paid",
      }),
    ).toEqual(["received_exceeds_quote", "paid_balance_mismatch"]);
    expect(
      getOrderAmountAnomalyReasons({
        quotationAmount: 100,
        depositAmount: 20,
        balanceAmount: 80,
        isPaid: false,
        paymentStatus: "unpaid",
      }),
    ).toEqual(["payment_status_mismatch"]);
  });
});
