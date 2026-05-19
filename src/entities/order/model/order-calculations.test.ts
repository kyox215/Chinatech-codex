import { describe, expect, it } from "vitest";

import { calculateBalance, inferPaidAmount, sumFaultPrices } from "./order-calculations";

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
});
