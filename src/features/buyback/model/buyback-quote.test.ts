import { describe, expect, it } from "vitest";

import {
  buildBuybackQuoteCreateInput,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  getBuybackQuoteOffer,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import type { InventoryListItem } from "@/lib/repairdesk/types";

describe("buyback quote calculation", () => {
  it("calculates a final offer from market price, profit target and deductions", () => {
    const result = calculateBuybackQuote(defaultBuybackQuoteDraft);

    expect(result.finalOffer).toBe(315);
    expect(result.marketMin).toBe(485);
    expect(result.marketMax).toBe(565);
    expect(result.deductions.map((item) => item.key)).toEqual([
      "cosmetic",
      "screen",
      "body",
      "battery",
      "proof",
      "box",
    ]);
  });

  it("keeps a manual offer and flags manager approval when it exceeds the range", () => {
    const result = calculateBuybackQuote({
      ...defaultBuybackQuoteDraft,
      manual_offer: "520",
      manual_reason: "客户换购",
    });

    expect(result.finalOffer).toBe(520);
    expect(result.approvalReasons).toContain("人工报价超过系统建议上限 10%");
    expect(result.approvalReasons).toContain("单台报价超过 €500");
  });

  it("marks account lock issues as a hard block", () => {
    const result = calculateBuybackQuote({
      ...defaultBuybackQuoteDraft,
      activation_lock_off: false,
    });

    expect(result.riskLevel).toBe("high");
    expect(result.hardBlock).toBe(true);
    expect(result.approvalReasons).toContain("高风险设备需要负责人复核");
  });

  it("stores quote data without turning it into a payout", () => {
    const draft: BuybackQuoteDraft = {
      ...defaultBuybackQuoteDraft,
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
      serial_or_imei: "356789012345678",
    };
    const result = calculateBuybackQuote(draft);
    const input = buildBuybackQuoteCreateInput(draft, result);

    expect(input.buyback_price).toBe(0);
    expect(input.quoted_offer).toBe(result.finalOffer);
    expect(input.quote_payload?.buyback_quote).toMatchObject({
      final_offer: result.finalOffer,
      risk_level: result.riskLevel,
    });
  });

  it("reads a saved quote offer from inventory legacy payload", () => {
    expect(
      getBuybackQuoteOffer({
        buyback_price: 0,
        legacy_payload: { buyback_quote: { final_offer: 485 } },
      } as unknown as InventoryListItem),
    ).toBe(485);
  });
});
