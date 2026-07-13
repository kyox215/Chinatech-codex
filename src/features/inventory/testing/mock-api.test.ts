import { describe, expect, it } from "vitest";

import {
  buildBuybackAgreementSnapshot,
  buildBuybackQualityCheckInput,
  buildBuybackQuoteCreateInput,
  buildBuybackQuoteDraftInput,
  buildBuybackQuoteReviewUpdateInput,
  buildBuybackQuoteUpdateInput,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import {
  BUYBACK_AGREEMENT_LANGUAGE,
  BUYBACK_AGREEMENT_VERSION,
  BUYBACK_PRIVACY_NOTICE_VERSION,
  documentNumberLast4,
  hashBuybackAgreementSnapshot,
} from "@/features/buyback/model/buyback-agreement";
import { BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE } from "@/features/buyback/model/buyback-evidence-policy";
import {
  getStoreSettings as getMockStoreSettings,
  updateStoreSettings as updateMockStoreSettings,
} from "@/features/messages/testing/mock-api";
import type { AuditActor, BuybackFinalizeInput } from "@/lib/repairdesk/types";

import {
  accessInventoryAttachment,
  createInventoryIntake,
  finalizeBuybackPurchase,
  getInventoryItem,
  recordInventoryCheck,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
  uploadInventoryAttachment,
} from "./mock-api";

const mockImageBase64 = "iVBORw0KGgo=";

describe("inventory mock buyback workflow", () => {
  it("blocks actor-bound buyback uploads in mock-backed server requests", async () => {
    const draft = completedBuybackDraft("3339001000");
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));
    const owner: AuditActor = {
      id: "owner_mock",
      displayName: "Owner",
      storeId: "mock-store",
      storeRole: "owner",
    };

    await expect(
      uploadInventoryAttachment(
        id,
        {
          kind: "device_photo",
          file_name: "device.png",
          mime_type: "image/png",
          file_size: 8,
          data_base64: mockImageBase64,
        },
        owner,
      ),
    ).rejects.toThrow(BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE);
  });

  it("blocks the legacy direct purchased transition", async () => {
    const draft = completedBuybackDraft("3339001001");
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));

    await expect(transitionInventoryItem(id, "purchased")).rejects.toThrow(/原子成交操作/);
  });

  it("keeps an accepted staging item at zero cost until the atomic finalize succeeds", async () => {
    const draft = completedBuybackDraft("3339001016");
    const result = calculateBuybackQuote(draft);
    const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));
    const staged = await getInventoryItem(id);

    expect(staged.item.status).toBe("intake");
    expect(staged.item.buyback_price).toBe(0);
    expect(staged.transactions).toHaveLength(0);
  });

  it("finalizes quality, evidence, status and one payment idempotently", async () => {
    const draft = completedBuybackDraft("3339001002");
    const { id, input } = await prepareFinalize(draft);

    const first = await finalizeBuybackPurchase(id, input);
    const replay = await finalizeBuybackPurchase(id, input);
    const detail = await getInventoryItem(id);

    expect(first.code).toBe("finalized");
    expect(replay).toMatchObject({
      code: "idempotent_replay",
      agreement_id: first.agreement_id,
      payment_id: first.payment_id,
    });
    expect(detail.item.status).toBe("purchased");
    expect(detail.item.buyback_price).toBe(calculateBuybackQuote(draft).finalOffer);
    expect(detail.checks).toHaveLength(1);
    expect(
      detail.transactions.filter((entry) => entry.transaction_type === "buyback_payment"),
    ).toHaveLength(1);
    expect(detail.attachments.every((entry) => entry.evidence_status === "bound")).toBe(true);

    await expect(updateInventoryItem(id, { buyback_price: 0 })).rejects.toThrow(
      /回收成本不能通过通用库存更新修改/,
    );
    await expect(updateInventoryItem(id, { payment_method: "other" })).rejects.toThrow(
      /已成交回收的签署资料不能通过通用库存更新修改/,
    );
    await expect(updateInventoryItem(id, { brand: "Other" })).rejects.toThrow(
      /已成交回收的签署资料不能通过通用库存更新修改/,
    );
    await expect(updateInventoryItem(id, { color: "Blue" })).resolves.toEqual({ ok: true });
    await expect(transitionInventoryItem(id, "cancelled")).rejects.toThrow(/专用冲正流程/);
  });

  it("rejects a stale item version before any final writes", async () => {
    const draft = completedBuybackDraft("3339001003");
    const { id, input } = await prepareFinalize(draft);
    await updateInventoryItem(id, { color: "Green" });

    await expect(finalizeBuybackPurchase(id, input)).rejects.toThrow(/已被其他人更新/);
    const detail = await getInventoryItem(id);
    expect(detail.item.status).not.toBe("purchased");
    expect(
      detail.transactions.filter((entry) => entry.transaction_type === "buyback_payment"),
    ).toHaveLength(0);
  });

  it("treats the same idempotency key with a changed signature payload as a conflict", async () => {
    const draft = completedBuybackDraft("3339001004");
    const { id, input } = await prepareFinalize(draft);
    await finalizeBuybackPurchase(id, input);
    const changedSnapshot = {
      ...input.agreement_snapshot,
      quote: { amount: calculateBuybackQuote(draft).finalOffer + 10, currency_code: "EUR" },
    };
    const changedHash = await hashBuybackAgreementSnapshot(changedSnapshot);

    await expect(
      finalizeBuybackPurchase(id, {
        ...input,
        agreement_snapshot: changedSnapshot,
        agreement_hash: changedHash,
      }),
    ).rejects.toThrow(/操作标识已用于不同请求/);
  });

  it("rejects a signed seller who does not match the inventory customer", async () => {
    const draft = completedBuybackDraft("3339001014");
    const { id, input } = await prepareFinalize(draft);
    const changedSnapshot = {
      ...input.agreement_snapshot,
      seller: {
        ...(input.agreement_snapshot.seller as Record<string, unknown>),
        name: "Different Seller",
      },
    };
    const changedHash = await hashBuybackAgreementSnapshot(changedSnapshot);

    await expect(
      finalizeBuybackPurchase(id, {
        ...input,
        agreement_snapshot: changedSnapshot,
        agreement_hash: changedHash,
        idempotency_key: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/关联客户不一致/);
  });

  it("does not reuse a phone number for a different seller name", async () => {
    const first = completedBuybackDraft("3339001015");
    await createInventoryIntake(buildBuybackQuoteCreateInput(first, calculateBuybackQuote(first)));
    const differentSeller = { ...first, customer_name: "Different Seller" };

    await expect(
      createInventoryIntake(
        buildBuybackQuoteCreateInput(differentSeller, calculateBuybackQuote(differentSeller)),
      ),
    ).rejects.toThrow(/电话已绑定其他客户/);
  });

  it("binds the seller when a deferred quote is reopened and then finalizes", async () => {
    const sellerDraft = completedBuybackDraft("3339001017");
    const deferredDraft: BuybackQuoteDraft = {
      ...sellerDraft,
      customer_name: "",
      customer_phone: "",
      customer_intent_confirmed: false,
      customer_intent_outcome: "deferred",
    };
    const result = calculateBuybackQuote(sellerDraft);
    const { id } = await createInventoryIntake(buildBuybackQuoteDraftInput(deferredDraft, result));

    expect((await getInventoryItem(id)).customer).toBeUndefined();
    await updateInventoryItem(id, buildBuybackQuoteReviewUpdateInput(sellerDraft, result));
    expect((await getInventoryItem(id)).customer).toMatchObject({
      name: sellerDraft.customer_name,
    });

    const input = await buildFinalizeInputForItem(id, sellerDraft, result);
    await expect(finalizeBuybackPurchase(id, input)).resolves.toMatchObject({ code: "finalized" });
  });

  it("accepts a passport data page without a fake back image", async () => {
    const draft: BuybackQuoteDraft = {
      ...completedBuybackDraft("3339001005"),
      customer_document_type: "passport",
      id_back_captured: false,
    };
    const { id, input } = await prepareFinalize(draft);

    await expect(finalizeBuybackPurchase(id, input)).resolves.toMatchObject({ code: "finalized" });
    const detail = await getInventoryItem(id);
    expect(detail.attachments.map((entry) => entry.kind)).not.toContain("id_back");
  });

  it("blocks resale until customer data wipe is verified", async () => {
    const draft: BuybackQuoteDraft = {
      ...completedBuybackDraft("3339001018"),
      data_wipe_status: "unchecked",
    };
    const { id, input } = await prepareFinalize(draft);
    await finalizeBuybackPurchase(id, input);

    await expect(transitionInventoryItem(id, "ready_for_sale")).rejects.toThrow(/资料尚未确认清除/);
    await recordInventoryCheck(id, { data_wipe_status: "pass" });
    await expect(transitionInventoryItem(id, "ready_for_sale")).resolves.toMatchObject({
      to: "ready_for_sale",
    });
  });

  it("rejects a stale quality check before creating another check record", async () => {
    const draft = completedBuybackDraft("3339001020");
    const { id, input } = await prepareFinalize(draft);
    await finalizeBuybackPurchase(id, input);
    const stale = await getInventoryItem(id);
    await updateInventoryItem(id, { color: "Graphite" });

    await expect(
      recordInventoryCheck(id, {
        expected_updated_at: stale.item.updated_at,
        data_wipe_status: "fail",
      }),
    ).rejects.toThrow(/已被其他人更新/);

    const current = await getInventoryItem(id);
    expect(current.checks).toHaveLength(stale.checks.length);
    expect(current.item.data_wipe_status).toBe("pass");
  });

  it("requires fresh IMEI, lock and data-wipe checks after a buyback return", async () => {
    const draft = completedBuybackDraft("3339001021");
    const { id, input } = await prepareFinalize(draft);
    await finalizeBuybackPurchase(id, input);
    await transitionInventoryItem(id, "ready_for_sale");
    await transitionInventoryItem(id, "listed");
    await sellInventoryItem(id, {
      buyer_name: "Luca Verdi",
      buyer_phone: "3339002021",
      sale_price: 520,
      payment_method: "cash",
      warranty_terms_snapshot: ["Test warranty"],
    });
    await transitionInventoryItem(id, "returned");

    let detail = await getInventoryItem(id);
    expect(detail.item).toMatchObject({
      status: "returned",
      imei_check_status: "unchecked",
      activation_lock_status: "unchecked",
      data_wipe_status: "unchecked",
    });
    await expect(transitionInventoryItem(id, "listed")).rejects.toThrow(/资料尚未确认清除/);

    await recordInventoryCheck(id, {
      expected_updated_at: detail.item.updated_at,
      imei_check_status: "pass",
      activation_lock_status: "pass",
      data_wipe_status: "pass",
    });
    await expect(transitionInventoryItem(id, "listed")).resolves.toMatchObject({
      from: "returned",
      to: "listed",
    });
    detail = await getInventoryItem(id);
    expect(detail.item.status).toBe("listed");
  });

  it("returns a short-lived attachment URL only on demand", async () => {
    const draft = completedBuybackDraft("3339001006");
    const { id, input } = await prepareFinalize(draft);
    const result = await accessInventoryAttachment(id, input.signature_attachment_id);

    expect(result.signed_url).toContain("mock://inventory-attachments/");
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
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
    expect(detail.item.warranty_until?.slice(0, 10)).toBe("2027-01-09");
    expect(detail.item.legacy_payload.sale_receipt).toMatchObject({
      warranty_months: 6,
      terms: ["custom warranty term"],
    });
  });

  it("snapshots the current store default and preserves explicit zero through sale", async () => {
    const actor: AuditActor = {
      displayName: "Warranty Test Owner",
      storeId: "00000000-0000-4000-8000-000000009901",
    };
    const initialSettings = await getMockStoreSettings(actor);
    const eighteenMonthSettings = await updateMockStoreSettings(
      {
        section: "rules",
        expectedStoreId: actor.storeId!,
        expectedUpdatedAt: initialSettings.updated_at,
        input: {
          default_order_warranty_months: 6,
          default_inventory_warranty_months: 18,
        },
      },
      actor,
    );

    const { id: defaultedId } = await createInventoryIntake(
      {
        source_type: "manual_stock",
        initial_status: "listed",
        brand: "Apple",
        model: "iPhone Default Snapshot",
      },
      actor,
    );
    expect((await getInventoryItem(defaultedId, actor)).item.warranty_months).toBe(18);

    await updateMockStoreSettings(
      {
        section: "rules",
        expectedStoreId: actor.storeId!,
        expectedUpdatedAt: eighteenMonthSettings.updated_at,
        input: {
          default_order_warranty_months: 6,
          default_inventory_warranty_months: 24,
        },
      },
      actor,
    );
    await sellInventoryItem(defaultedId, { sale_price: 500 }, actor);
    const soldDefaulted = await getInventoryItem(defaultedId, actor);
    expect(soldDefaulted.item.warranty_months).toBe(18);

    const { id: zeroId } = await createInventoryIntake(
      {
        source_type: "manual_stock",
        initial_status: "listed",
        brand: "Samsung",
        model: "Galaxy No Warranty",
        warranty_months: 0,
      },
      actor,
    );
    await sellInventoryItem(zeroId, { sale_price: 300 }, actor);
    const soldZero = await getInventoryItem(zeroId, actor);
    expect(soldZero.item.warranty_months).toBe(0);
    expect(soldZero.item.warranty_until).toBeUndefined();
    expect(soldZero.item.legacy_payload.sale_receipt).toMatchObject({
      warranty_months: 0,
      warranty_until: undefined,
    });
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
    ownership_confirmed: true,
    data_wipe_authorized: true,
    privacy_notice_accepted: true,
    agreement_accepted: true,
    no_invoice_confirmed: true,
    no_box_confirmed: true,
    payment_method: "cash",
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
    serial_or_imei: `3567890${phone.slice(-8)}`,
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

async function prepareFinalize(draft: BuybackQuoteDraft) {
  const result = calculateBuybackQuote(draft);
  const { id } = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));
  return { id, input: await buildFinalizeInputForItem(id, draft, result) };
}

async function buildFinalizeInputForItem(
  id: string,
  draft: BuybackQuoteDraft,
  result = calculateBuybackQuote(draft),
) {
  const snapshot = buildBuybackAgreementSnapshot(draft, result);
  const agreementHash = await hashBuybackAgreementSnapshot(snapshot);
  const evidence = await uploadRequiredEvidence(id, agreementHash, draft.customer_document_type);
  const detail = await getInventoryItem(id);
  const input: BuybackFinalizeInput = {
    expected_updated_at: detail.item.updated_at,
    idempotency_key: crypto.randomUUID(),
    item_patch: buildBuybackQuoteUpdateInput(draft, result),
    quality_check: buildBuybackQualityCheckInput(draft),
    agreement_snapshot: snapshot,
    agreement_hash: agreementHash,
    agreement_version: BUYBACK_AGREEMENT_VERSION,
    privacy_notice_version: BUYBACK_PRIVACY_NOTICE_VERSION,
    language: BUYBACK_AGREEMENT_LANGUAGE,
    document_type: draft.customer_document_type,
    document_no_last4: documentNumberLast4(draft.customer_document_no),
    signature_attachment_id: evidence.signature,
    evidence_attachment_ids: Object.values(evidence),
    payment_method: draft.payment_method,
  };
  return input;
}

async function uploadRequiredEvidence(
  id: string,
  agreementHash: string,
  documentType: BuybackQuoteDraft["customer_document_type"],
) {
  const kinds = ["device_photo", "id_front", "signature"] as const;
  const requiredKinds = documentType === "passport" ? kinds : ([...kinds, "id_back"] as const);
  const entries = await Promise.all(
    requiredKinds.map(async (kind) => {
      const result = await uploadInventoryAttachment(id, {
        kind,
        file_name: `${kind}.png`,
        mime_type: "image/png",
        file_size: 8,
        data_base64: mockImageBase64,
        agreement_hash: kind === "signature" ? agreementHash : undefined,
      });
      return [kind, result.attachment.id] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<(typeof requiredKinds)[number], string> & {
    signature: string;
  };
}
