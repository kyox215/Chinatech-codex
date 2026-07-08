import { describe, expect, it } from "vitest";

import {
  assessBuybackCosmeticGrade,
  buildBuybackQuoteCreateInput,
  buildBuybackQuoteDraftInput,
  buildBuybackQuoteDraftFromInventoryItem,
  buildBuybackQuoteUpdateInput,
  buildBuybackQualityCheckInput,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  getBuybackBatteryBand,
  getBuybackQuoteOffer,
  validateBuybackIntake,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import type { InventoryListItem } from "@/lib/repairdesk/types";

const pricedQuoteDraft: BuybackQuoteDraft = {
  ...defaultBuybackQuoteDraft,
  model: "iPhone 13 Pro",
  storage_capacity: "256GB",
  color: "远峰蓝色",
  market_price: "520",
  cosmetic_grade: "a",
  screen_condition: "light_scratches",
  body_condition: "light_wear",
  battery_health: "85",
};

describe("buyback quote calculation", () => {
  it("starts without a preselected device to avoid accidental fake quotes", () => {
    expect(defaultBuybackQuoteDraft.model).toBe("");
    expect(defaultBuybackQuoteDraft.storage_capacity).toBe("");
    expect(defaultBuybackQuoteDraft.market_price).toBe("");
  });

  it("calculates a final offer from market price, profit target and deductions", () => {
    const result = calculateBuybackQuote(pricedQuoteDraft);

    expect(result.finalOffer).toBe(270);
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
      ...pricedQuoteDraft,
      manual_offer: "520",
      manual_reason: "客户换购",
    });

    expect(result.finalOffer).toBe(520);
    expect(result.approvalReasons).toContain("人工报价超过系统建议上限 10%");
    expect(result.approvalReasons).toContain("单台报价超过 €500");
  });

  it("derives cosmetic grade from observable condition instead of manual grade input", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      cosmetic_grade: "s",
      screen_condition: "cracked",
      body_condition: "normal",
      battery_health: "95",
    };

    const assessment = assessBuybackCosmeticGrade(draft);
    const result = calculateBuybackQuote(draft);

    expect(assessment.grade).toBe("c");
    expect(result.cosmeticAssessment.grade).toBe("c");
    expect(result.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "cosmetic",
          label: "系统成色 C 重度使用痕迹",
        }),
      ]),
    );
  });

  it("maps battery health to explicit appraisal bands", () => {
    expect(getBuybackBatteryBand(100)?.label).toBe("100%");
    expect(getBuybackBatteryBand(98)?.label).toBe("97-99%");
    expect(getBuybackBatteryBand(95)?.label).toBe("94-96%");
    expect(getBuybackBatteryBand(92)?.deduction).toBe(15);
    expect(getBuybackBatteryBand(89)?.deduction).toBe(22);
    expect(getBuybackBatteryBand(86)?.deduction).toBe(30);
    expect(getBuybackBatteryBand(83)?.deduction).toBe(40);
    expect(getBuybackBatteryBand(80)?.deduction).toBe(55);
    expect(getBuybackBatteryBand(77)?.deduction).toBe(70);
    expect(getBuybackBatteryBand(74)?.deduction).toBe(85);
    expect(getBuybackBatteryBand(71)?.deduction).toBe(105);
    expect(getBuybackBatteryBand(69)?.deduction).toBe(130);
  });

  it("deducts battery value every three percent below full health", () => {
    const result = calculateBuybackQuote({
      ...pricedQuoteDraft,
      battery_health: "95",
    });

    expect(result.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "battery",
          amount: 10,
        }),
      ]),
    );
  });

  it("keeps a non-zero quote interval for iPhone 12 128GB with 79-81% battery health", () => {
    const result = calculateBuybackQuote({
      ...defaultBuybackQuoteDraft,
      model: "iPhone 12",
      storage_capacity: "128GB",
      battery_health: "80",
    });

    expect(result.finalOffer).toBeGreaterThan(0);
    expect(result.pricingFloor).toBeGreaterThanOrEqual(20);
    expect(result.pricingCeiling).toBeGreaterThanOrEqual(result.pricingFloor);
    expect(result.suggestedLow).toBeGreaterThanOrEqual(result.pricingFloor);
    expect(result.suggestedHigh).toBeGreaterThanOrEqual(result.suggestedLow);
  });

  it("marks account lock issues as a hard block", () => {
    const result = calculateBuybackQuote({
      ...pricedQuoteDraft,
      customer_intent_confirmed: true,
      activation_lock_off: false,
    });

    expect(result.riskLevel).toBe("high");
    expect(result.hardBlock).toBe(true);
    expect(result.approvalReasons).toContain("高风险设备需要负责人复核");
  });

  it("stores quote data as the final buyback cost after agreement", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
      customer_document_type: "passport",
      customer_document_no: "YA1234567",
      customer_signature_status: "signed",
      customer_intent_confirmed: true,
      account_unlocked: true,
      activation_lock_off: true,
      device_photo_captured: true,
      signature_captured: true,
      id_front_captured: true,
      id_back_captured: true,
      invoice_photo_captured: true,
      box_photo_captured: true,
      customer_signature_note: "店内平板签名",
      serial_or_imei: "356789012345678",
      imei_check_status: "pass",
      screen_display_status: "pass",
      touch_status: "pass",
      front_camera_status: "pass",
      back_camera_status: "pass",
      microphone_status: "pass",
      receiver_status: "pass",
      speaker_status: "pass",
      buttons_status: "pass",
      charging_status: "pass",
      wifi_status: "pass",
      bluetooth_status: "pass",
      cellular_status: "pass",
      water_damage_status: "pass",
      data_wipe_status: "pass",
    };
    const result = calculateBuybackQuote(draft);
    const input = buildBuybackQuoteCreateInput(draft, result);

    expect(input.buyback_price).toBe(result.finalOffer);
    expect(input.quoted_offer).toBe(result.finalOffer);
    expect(input.quote_payload?.buyback_quote).toMatchObject({
      final_offer: result.finalOffer,
      risk_level: result.riskLevel,
    });
    expect(input.quote_payload?.buyback_device).toMatchObject({
      cosmetic_grade: result.cosmeticAssessment.label,
      cosmetic_grade_score: result.cosmeticAssessment.score,
    });
    expect(input.quote_payload?.buyback_customer).toMatchObject({
      name: "Mario Rossi",
      phone: "3331234567",
      document_type: "passport",
      document_no_masked: "YA*****67",
      signature_status: "signed",
    });
    expect(input.notes).toContain("成交资料");
    expect(input.notes).not.toContain("YA1234567");
    expect(validateBuybackIntake(draft, result).canSave).toBe(true);
  });

  it("builds an update input with repair plan data for an existing buyback record", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      screen_condition: "cracked",
      estimated_repair_cost: "85",
      serial_or_imei: "356789012345678",
    };
    const result = calculateBuybackQuote(draft);
    const input = buildBuybackQuoteUpdateInput(draft, result);

    expect(input.buyback_price).toBe(result.finalOffer);
    expect(input.repair_cost_amount).toBe(85);
    expect(input.quote_payload?.buyback_repair_plan).toMatchObject({
      issue_summary: expect.stringContaining("屏幕破裂"),
      estimated_repair_cost: 85,
    });
    expect(input.notes).toContain("维修计划");
  });

  it("stores deferred quotes without counting them as purchased inventory cost", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
    };
    const result = calculateBuybackQuote(draft);
    const input = buildBuybackQuoteDraftInput(draft, result);

    expect(input.quoted_offer).toBe(result.finalOffer);
    expect(input.buyback_price).toBe(0);
    expect(input.notes).toContain("客户意向：客户考虑中");
    expect(input.quote_payload?.buyback_quote).toMatchObject({
      intent_outcome: "deferred",
      final_offer: result.finalOffer,
    });
  });

  it("requires signature and ID photos when invoice or box are missing", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      customer_intent_confirmed: true,
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
      customer_document_no: "YA1234567",
      account_unlocked: true,
      activation_lock_off: true,
      serial_or_imei: "356789012345678",
      imei_check_status: "pass",
      screen_display_status: "pass",
      touch_status: "pass",
      front_camera_status: "pass",
      back_camera_status: "pass",
      microphone_status: "pass",
      receiver_status: "pass",
      speaker_status: "pass",
      buttons_status: "pass",
      charging_status: "pass",
      wifi_status: "pass",
      bluetooth_status: "pass",
      cellular_status: "pass",
      water_damage_status: "pass",
      data_wipe_status: "pass",
    };

    const validation = validateBuybackIntake(draft, calculateBuybackQuote(draft));
    expect(validation.canSave).toBe(false);
    expect(validation.missing).toContain("客户签名");
    expect(validation.missing).toContain("证件正面照片");
    expect(validation.missing).toContain("无发票时的来源确认/证件补充");
    expect(validation.missing).toContain("无原装盒时的确认记录");
  });

  it("requires an IMEI or serial number before saving a buyback purchase", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      customer_intent_confirmed: true,
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
      customer_document_no: "YA1234567",
      customer_signature_status: "signed",
      account_unlocked: true,
      activation_lock_off: true,
      device_photo_captured: true,
      signature_captured: true,
      id_front_captured: true,
      id_back_captured: true,
      invoice_photo_captured: true,
      box_photo_captured: true,
      serial_or_imei: "",
      imei_check_status: "pass",
      screen_display_status: "pass",
      touch_status: "pass",
      front_camera_status: "pass",
      back_camera_status: "pass",
      microphone_status: "pass",
      receiver_status: "pass",
      speaker_status: "pass",
      buttons_status: "pass",
      charging_status: "pass",
      wifi_status: "pass",
      bluetooth_status: "pass",
      cellular_status: "pass",
      water_damage_status: "pass",
      data_wipe_status: "pass",
    };

    const validation = validateBuybackIntake(draft, calculateBuybackQuote(draft));
    expect(validation.canSave).toBe(false);
    expect(validation.missing).toContain("IMEI / 序列号");
  });

  it("maps the guided inspection checklist into inventory quality check input", () => {
    const input = buildBuybackQualityCheckInput({
      ...pricedQuoteDraft,
      account_unlocked: true,
      activation_lock_off: true,
      imei_check_status: "pass",
      screen_display_status: "pass",
      touch_status: "pass",
      front_camera_status: "pass",
      back_camera_status: "pass",
      microphone_status: "pass",
      receiver_status: "pass",
      speaker_status: "pass",
      buttons_status: "pass",
      charging_status: "pass",
      wifi_status: "pass",
      bluetooth_status: "pass",
      cellular_status: "pass",
      water_damage_status: "pass",
      data_wipe_status: "pass",
    });

    expect(input.imei_check_status).toBe("pass");
    expect(input.camera_status).toBe("pass");
    expect(input.functional_grade).toBe("passed");
    expect(input.notes).toContain("IMEI / 序列号:正常");
  });

  it("rejects not applicable on required inspection items", () => {
    const draft: BuybackQuoteDraft = {
      ...pricedQuoteDraft,
      customer_intent_confirmed: true,
      account_unlocked: true,
      activation_lock_off: true,
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
      customer_document_no: "YA1234567",
      customer_signature_status: "signed",
      device_photo_captured: true,
      signature_captured: true,
      id_front_captured: true,
      id_back_captured: true,
      invoice_photo_captured: true,
      box_photo_captured: true,
      serial_or_imei: "356789012345678",
      imei_check_status: "not_applicable",
      screen_display_status: "pass",
      touch_status: "pass",
      front_camera_status: "pass",
      back_camera_status: "pass",
      microphone_status: "pass",
      receiver_status: "pass",
      speaker_status: "pass",
      buttons_status: "pass",
      charging_status: "pass",
      wifi_status: "pass",
      bluetooth_status: "pass",
      cellular_status: "pass",
      water_damage_status: "pass",
      data_wipe_status: "pass",
    };

    const validation = validateBuybackIntake(draft, calculateBuybackQuote(draft));
    expect(validation.canSave).toBe(false);
    expect(validation.missing).toContain("IMEI / 序列号不能选择不适用");
  });

  it("reads a saved quote offer from inventory legacy payload", () => {
    expect(
      getBuybackQuoteOffer({
        buyback_price: 0,
        legacy_payload: { buyback_quote: { final_offer: 485 } },
      } as unknown as InventoryListItem),
    ).toBe(485);
  });

  it("prefills a follow-up quote draft from an existing buyback record", () => {
    const draft = buildBuybackQuoteDraftFromInventoryItem({
      brand: "Apple",
      model: "iPhone 13",
      storage_capacity: "128GB",
      color: "Blue",
      serial_or_imei: "356789012345678",
      customer_name: "Mario Rossi",
      customer_phone: "+393331234567",
      battery_health: 86,
      activation_lock_status: "pass",
      data_wipe_status: "unchecked",
      repair_cost_amount: 20,
      list_price: 320,
      buyback_price: 0,
      legacy_payload: {
        buyback_quote: {
          final_offer: 210,
          intent_outcome: "accepted",
          market_source: {
            resale_reference: 320,
            target_profit: 75,
          },
        },
        buyback_device: {
          purchase_region: "欧盟",
          warranty_status: "已过保",
          screen_condition: "屏幕破裂",
          body_condition: "外观轻微磨损",
          purchase_proof: true,
          box_included: false,
        },
        buyback_function_checks: {
          imei_check_status: "pass",
          touch_status: "fail",
          data_wipe_status: "unchecked",
        },
        buyback_customer: {
          name: "Mario Rossi",
          phone: "+393331234567",
          signature_status: "signed",
          signature_captured: true,
          id_front_captured: true,
        },
      },
    } as unknown as InventoryListItem);

    expect(draft.customer_name).toBe("Mario Rossi");
    expect(draft.model).toBe("iPhone 13");
    expect(draft.storage_capacity).toBe("128GB");
    expect(draft.market_price).toBe("320");
    expect(draft.target_profit).toBe("75");
    expect(draft.estimated_repair_cost).toBe("20");
    expect(draft.battery_health).toBe("86");
    expect(draft.screen_condition).toBe("cracked");
    expect(draft.body_condition).toBe("light_wear");
    expect(draft.imei_check_status).toBe("pass");
    expect(draft.touch_status).toBe("fail");
    expect(draft.customer_intent_confirmed).toBe(true);
    expect(draft.activation_lock_off).toBe(true);
    expect(draft.signature_captured).toBe(true);
  });
});
