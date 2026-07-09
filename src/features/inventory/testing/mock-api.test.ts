import { describe, expect, it } from "vitest";

import {
  buildBuybackQuoteDraftInput,
  buildBuybackQualityCheckInput,
  buildBuybackQuoteCreateInput,
  buildBuybackQuoteUpdateInput,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";

import {
  createInventoryIntake,
  getInventoryItem,
  recordInventoryCheck,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
  uploadInventoryAttachment,
} from "./mock-api";

const mockImageBase64 = "iVBORw0KGgo=";

describe("inventory mock buyback workflow", () => {
  it("blocks buyback purchase without accepted quote payload", async () => {
    const { id } = await createInventoryIntake({
      customer_name: "Mock Buyback Customer",
      customer_phone: "3339001001",
      brand: "Apple",
      model: "iPhone X",
      buyback_price: 120,
      list_price: 220,
    });

    await transitionInventoryItem(id, "offer_made", { reason: "测试报价" });
    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/报价资料/);
  });

  it("requires checks and evidence before purchasing a buyback intake", async () => {
    const draft = completedBuybackDraft("3339001002");
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));

    await transitionInventoryItem(id, "offer_made", { reason: "客户接受报价" });
    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/尚未检测通过/);

    await recordInventoryCheck(id, buildBuybackQualityCheckInput(draft));
    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/缺少成交凭证/);

    await uploadRequiredEvidence(id);
    await transitionInventoryItem(id, "purchased", { reason: "资料齐全，成交" });

    const detail = await getInventoryItem(id);
    expect(detail.item.status).toBe("purchased");
    expect(detail.item.purchased_at).toBeTruthy();
    expect(detail.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transaction_type: "buyback_payment",
          amount: result.finalOffer,
        }),
      ]),
    );
  });

  it("blocks buyback purchase when IMEI or serial number is missing", async () => {
    const draft = {
      ...completedBuybackDraft("3339001003"),
      serial_or_imei: "",
    };
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));

    await recordInventoryCheck(id, buildBuybackQualityCheckInput(draft));
    await uploadRequiredEvidence(id);
    await transitionInventoryItem(id, "offer_made", { reason: "客户接受报价" });
    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/IMEI|序列/);
  });

  it("blocks buyback purchase when required functional checks are incomplete", async () => {
    const draft = completedBuybackDraft("3339001004");
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));

    await recordInventoryCheck(
      id,
      buildBuybackQualityCheckInput({
        ...draft,
        screen_display_status: "unchecked",
      }),
    );
    await uploadRequiredEvidence(id);
    await transitionInventoryItem(id, "offer_made", { reason: "客户接受报价" });
    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/屏幕显示/);
  });

  it("blocks buyback purchase when stored buyback price drifts from accepted quote", async () => {
    const draft = completedBuybackDraft("3339001005");
    const result = calculateBuybackQuote(draft);
    const input = buildBuybackQuoteCreateInput(draft, result);
    input.buyback_price = result.finalOffer + 10;
    const { id } = await createInventoryIntake(input);

    await recordInventoryCheck(id, buildBuybackQualityCheckInput(draft));
    await uploadRequiredEvidence(id);
    await transitionInventoryItem(id, "offer_made", { reason: "客户接受报价" });
    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/成交金额|接受报价/);
  });

  it("updates an existing deferred buyback record before transferring it into inventory", async () => {
    const draft: BuybackQuoteDraft = {
      ...completedBuybackDraft("3339001006"),
      estimated_repair_cost: "65",
      screen_condition: "cracked",
    };
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteDraftInput(draft, result));

    await transitionInventoryItem(id, "offer_made", { reason: "客户考虑中" });
    await updateInventoryItem(id, buildBuybackQuoteUpdateInput(draft, result));
    await recordInventoryCheck(id, buildBuybackQualityCheckInput(draft));
    await uploadRequiredEvidence(id);
    await transitionInventoryItem(id, "purchased", { reason: "客户确认成交" });

    const detail = await getInventoryItem(id);
    expect(detail.item.id).toBe(id);
    expect(detail.item.status).toBe("purchased");
    expect(detail.item.buyback_price).toBe(result.finalOffer);
    expect(detail.item.repair_cost_amount).toBe(65);
    expect(detail.item.legacy_payload.buyback_quote).toMatchObject({
      intent_outcome: "accepted",
      final_offer: result.finalOffer,
    });
    expect(detail.item.legacy_payload.buyback_repair_plan).toMatchObject({
      issue_summary: expect.stringContaining("屏幕破裂"),
      estimated_repair_cost: 65,
    });
  });

  it("creates direct stock, sells it, and keeps a warranty receipt snapshot", async () => {
    const { id } = await createInventoryIntake({
      source_type: "manual_stock",
      initial_status: "listed",
      category: "tablet",
      brand: "Apple",
      model: "iPad Air 5",
      color: "Blue",
      storage_capacity: "64GB",
      serial_or_imei: "DMPTEST000001",
      buyback_price: 260,
      repair_cost_amount: 15,
      list_price: 399,
      warranty_months: 6,
      notes: "供应商入库，带原装盒",
    });

    let detail = await getInventoryItem(id);
    expect(detail.item.status).toBe("listed");
    expect(detail.item.source_type).toBe("manual_stock");
    expect(detail.item.buyback_price).toBe(260);
    expect(detail.item.repair_cost_amount).toBe(15);

    await sellInventoryItem(id, {
      buyer_name: "Luca Rossi",
      buyer_phone: "3339001999",
      sale_price: 389,
      payment_method: "contanti",
      sale_channel: "store",
      warranty_months: 6,
      sold_at: "2026-07-09T10:00:00.000Z",
      warranty_terms_snapshot: ["custom warranty term"],
    });

    detail = await getInventoryItem(id);
    expect(detail.item.status).toBe("sold");
    expect(detail.item.buyer_name).toBe("Luca Rossi");
    expect(detail.item.warranty_until?.slice(0, 10)).toBe("2027-01-09");
    expect(detail.item.legacy_payload.sale_receipt).toMatchObject({
      receipt_no: expect.stringMatching(/^I\d+-20260709$/),
      warranty_months: 6,
      warranty_until: detail.item.warranty_until,
      terms: ["custom warranty term"],
    });
    expect(detail.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transaction_type: "sale_payment",
          amount: 389,
        }),
      ]),
    );
  });
});

function completedBuybackDraft(phone: string): BuybackQuoteDraft {
  return {
    ...defaultBuybackQuoteDraft,
    customer_name: "Mario Rossi",
    customer_phone: phone,
    customer_document_type: "id_card",
    customer_document_no: "CA1234567",
    customer_signature_status: "signed",
    customer_intent_confirmed: true,
    customer_intent_outcome: "accepted",
    brand: "Apple",
    model: "iPhone 13 Pro",
    storage_capacity: "256GB",
    color: "远峰蓝色",
    market_price: "520",
    screen_condition: "light_scratches",
    body_condition: "light_wear",
    battery_health: "85",
    account_unlocked: true,
    activation_lock_off: true,
    device_photo_captured: true,
    signature_captured: true,
    id_front_captured: true,
    id_back_captured: true,
    invoice_photo_captured: true,
    box_photo_captured: true,
    serial_or_imei: "356789012345678",
    imei_check_status: "pass",
    face_id_status: "pass",
    screen_display_status: "pass",
    touch_status: "pass",
    front_camera_status: "pass",
    back_camera_status: "pass",
    flash_status: "pass",
    microphone_status: "pass",
    receiver_status: "pass",
    speaker_status: "pass",
    buttons_status: "pass",
    vibration_status: "pass",
    charging_status: "pass",
    wireless_charging_status: "pass",
    wifi_status: "pass",
    bluetooth_status: "pass",
    cellular_status: "pass",
    gps_status: "pass",
    nfc_status: "pass",
    true_tone_status: "pass",
    water_damage_status: "pass",
    repair_history_status: "pass",
    data_wipe_status: "pass",
  };
}

async function uploadRequiredEvidence(id: string) {
  const kinds = [
    "device_photo",
    "signature",
    "id_front",
    "id_back",
    "invoice_photo",
    "box_photo",
  ] as const;

  await Promise.all(
    kinds.map((kind) =>
      uploadInventoryAttachment(id, {
        kind,
        file_name: `${kind}.png`,
        mime_type: "image/png",
        file_size: 8,
        data_base64: mockImageBase64,
      }),
    ),
  );
}
