import { describe, expect, it } from "vitest";

import {
  buildBuybackQualityCheckInput,
  buildBuybackQuoteCreateInput,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";

import {
  createInventoryIntake,
  getInventoryItem,
  recordInventoryCheck,
  transitionInventoryItem,
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
