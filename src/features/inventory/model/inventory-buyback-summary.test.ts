import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/repairdesk/types";

import { buildInventoryBuybackSummary } from "./inventory-buyback-summary";

describe("inventory buyback summary", () => {
  it("returns null for ordinary inventory without buyback payload", () => {
    expect(buildInventoryBuybackSummary(inventoryItem({ source_type: "manual" }))).toBeNull();
  });

  it("summarizes full buyback quote payload with risk and deductions", () => {
    const summary = buildInventoryBuybackSummary(
      inventoryItem({
        source_type: "buyback",
        status: "purchased",
        buyback_price: 420,
        repair_cost_amount: 85,
        fees_amount: 12,
        legacy_payload: {
          buyback_quote: {
            final_offer: 420,
            risk_level: "high",
            hard_block: true,
            quote_expires_at: "2026-06-25T10:00:00Z",
            risk_notes: ["账号锁未关闭"],
            deductions: [
              { label: "屏幕划痕", amount: 25 },
              { label: "无盒", amount: 5 },
            ],
          },
          buyback_customer: {
            signature_captured: true,
            id_front_captured: true,
            id_back_captured: true,
            device_photo_captured: true,
            invoice_photo_captured: true,
            box_photo_captured: false,
          },
          buyback_device: {
            purchase_proof: false,
            box_included: false,
          },
          buyback_repair_plan: {
            issue_summary: "屏幕破裂 / 电池健康偏低",
            estimated_repair_cost: 85,
            items: [
              {
                key: "screen_cracked",
                label: "屏幕破裂",
                detail: "订购屏幕总成并记录实际换屏成本",
                priority: "high",
              },
            ],
          },
        },
      }),
    );

    expect(summary).toMatchObject({
      hasBuybackQuote: true,
      offer: 420,
      riskLevel: "high",
      hardBlock: true,
      statusLabel: "回收风险复核",
      statusTone: "danger",
      proofDone: 5,
      proofTotal: 6,
      purchaseCost: 420,
      repairCost: 85,
      fees: 12,
      costBasis: 517,
      repairIssueSummary: "屏幕破裂 / 电池健康偏低",
    });
    expect(summary?.riskNotes).toContain("账号锁未关闭");
    expect(summary?.deductions).toEqual([
      { label: "屏幕划痕", amount: 25 },
      { label: "无盒", amount: 5 },
    ]);
    expect(summary?.repairRows).toEqual([
      {
        key: "screen_cracked",
        label: "屏幕破裂",
        detail: "订购屏幕总成并记录实际换屏成本",
        priority: "high",
      },
    ]);
  });

  it("uses sanitized payload to show missing proof before resale", () => {
    const summary = buildInventoryBuybackSummary(
      inventoryItem({
        source_type: "buyback",
        status: "ready_for_sale",
        data_wipe_status: "pass",
        legacy_payload: {
          has_buyback_quote: true,
          buyback_quote: {
            final_offer: 280,
            risk_level: "low",
            hard_block: false,
          },
          buyback_customer: {
            signature_captured: true,
            id_front_captured: true,
            id_back_captured: false,
            device_photo_captured: true,
            invoice_photo_captured: false,
            box_photo_captured: true,
          },
          buyback_device: {
            purchase_proof: false,
            box_included: false,
          },
        },
      }),
    );

    expect(summary).toMatchObject({
      offer: 280,
      statusLabel: "凭证待补齐",
      statusTone: "warning",
      proofDone: 4,
      proofTotal: 6,
    });
    expect(summary?.proofRows.filter((row) => !row.done).map((row) => row.label)).toEqual([
      "证件反面",
      "无票确认",
    ]);
  });
});

function inventoryItem(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: "item",
    public_no: "INV-001",
    status: "intake",
    source_type: "buyback",
    category: "phone",
    brand: "Apple",
    model: "iPhone",
    imei_check_status: "unchecked",
    activation_lock_status: "unchecked",
    data_wipe_status: "unchecked",
    cosmetic_grade: "unknown",
    functional_grade: "untested",
    buyback_price: 0,
    list_price: 0,
    sale_price: 0,
    deposit_amount: 0,
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: "EUR",
    warranty_months: 0,
    legacy_payload: {},
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}
