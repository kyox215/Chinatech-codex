import { describe, expect, it } from "vitest";

import {
  canTransitionInventoryItem,
  getInventoryProfit,
  validateInventoryTransition,
} from "./inventory-workflow";

describe("inventory workflow", () => {
  it("allows the main buyback and resale flow", () => {
    expect(canTransitionInventoryItem("intake", "evaluating")).toBe(true);
    expect(canTransitionInventoryItem("evaluating", "offer_made")).toBe(true);
    expect(canTransitionInventoryItem("offer_made", "purchased")).toBe(true);
    expect(canTransitionInventoryItem("purchased", "data_wipe")).toBe(true);
    expect(canTransitionInventoryItem("data_wipe", "refurbishing")).toBe(true);
    expect(canTransitionInventoryItem("refurbishing", "ready_for_sale")).toBe(true);
    expect(canTransitionInventoryItem("ready_for_sale", "listed")).toBe(true);
    expect(canTransitionInventoryItem("listed", "reserved")).toBe(true);
    expect(canTransitionInventoryItem("reserved", "sold")).toBe(true);
  });

  it("rejects illegal jumps out of intake", () => {
    expect(() => validateInventoryTransition("intake", "sold")).toThrow(/不能从/);
  });

  it("calculates profit with costs, fees, refunds, and extra transactions", () => {
    expect(
      getInventoryProfit(
        {
          sale_price: 420,
          buyback_price: 250,
          repair_cost_amount: 20,
          fees_amount: 5,
        },
        [
          { transaction_type: "refund", amount: 30 },
          { transaction_type: "repair_cost", amount: 10 },
          { transaction_type: "fee", amount: 5 },
        ],
      ),
    ).toBe(100);
  });
});
