import { describe, expect, it } from "vitest";

import { createRepairDeskOfflineOrderService } from "@/features/offline/model/offline-order-service";
import { createRepairDeskOfflineMemoryStore } from "@/features/offline/model/offline-store";

import {
  buildNewOrderOfflineDraftInput,
  buildNewOrderOfflineDraftPayload,
  buildNewOrderOfflineRelationshipPlan,
  getNewOrderOfflineDraftFingerprint,
  hasNewOrderSensitiveUnlockDraft,
  isNewOrderFormWorthOfflineAutosave,
  restoreNewOrderFormFromOfflineDraft,
} from "./new-order-offline-draft";
import { initialNewOrderForm, type NewOrderFormState } from "./new-order-form";

describe("new order offline draft mapping", () => {
  it("maps a linked customer and device into relationship metadata", async () => {
    const form = makeForm({
      customerId: "customer_1",
      customerName: "Mario Rossi",
      customerPhone: "+393331112222",
      deviceId: "device_1",
      brand: "Apple",
      model: "iPhone 13",
      imei: "356789012345678",
      issue: "Schermo rotto",
      deposit: 20,
    });

    const relationship = buildNewOrderOfflineRelationshipPlan(form);

    expect(relationship).toMatchObject({
      customerLinkMode: "existing_customer",
      customerLinkDraft: {
        customerId: "customer_1",
        snapshot: {
          customerId: "customer_1",
          name: "Mario Rossi",
          phone: "+393331112222",
        },
      },
      deviceLinkMode: "existing_customer_device",
      deviceLinkDraft: {
        deviceId: "device_1",
        snapshot: {
          deviceId: "device_1",
          brand: "Apple",
          model: "iPhone 13",
          imei: "356789012345678",
        },
      },
    });
  });

  it("creates stable local relationship ids for a new offline customer and device", () => {
    const form = makeForm({
      customerName: "Cliente banco",
      customerPhone: "3331112222",
      brand: "Samsung",
      model: "A52",
      imei: "SN123",
    });

    expect(buildNewOrderOfflineRelationshipPlan(form)).toMatchObject({
      customerLinkMode: "new_customer_local",
      customerLinkDraft: {
        localCustomerId: expect.stringMatching(/^local_customer_[a-f0-9]{8}$/),
        snapshot: {
          name: "Cliente banco",
          phone: "3331112222",
        },
      },
      deviceLinkMode: "new_customer_device_local",
      deviceLinkDraft: {
        localDeviceId: expect.stringMatching(/^local_device_[a-f0-9]{8}$/),
        snapshot: {
          brand: "Samsung",
          model: "A52",
          imei: "SN123",
        },
      },
    });
  });

  it("never includes raw unlock values in the ordinary order draft payload", async () => {
    const form = makeForm({
      customerPhone: "+393331112222",
      brand: "Apple",
      model: "iPhone 13",
      deviceUnlock: { method: "pin", value: "001258" },
    });
    const input = buildNewOrderOfflineDraftInput({ form });

    expect(hasNewOrderSensitiveUnlockDraft(form)).toBe(true);
    expect(input.hasSensitiveVaultEntry).toBe(true);
    expect(JSON.stringify(input.draftPayload)).not.toContain("001258");
    expect(JSON.stringify(input.draftPayload).toLowerCase()).not.toContain("unlock");

    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_1",
    });
    const saved = await service.saveDraft(input);

    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.value.hasSensitiveVaultEntry).toBe(true);
  });

  it("restores normal fields but requires sensitive unlock re-entry", async () => {
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_1",
    });
    const saved = await service.saveDraft(
      buildNewOrderOfflineDraftInput({
        form: makeForm({
          customerId: "customer_1",
          customerName: "Mario Rossi",
          customerPhone: "+393331112222",
          deviceId: "device_1",
          brand: "Apple",
          model: "iPhone 13",
          deviceUnlock: { method: "pattern", pattern: [1, 2, 5, 8] },
          faults: [
            {
              line_id: "00000000-0000-4000-8000-000000000101",
              catalog_key: "display:lcd",
              key: "display:lcd",
              categoryKey: "display",
              categoryLabel: "屏幕",
              name: "内屏漏液",
              price: 89,
              note: "LCD danneggiato",
            },
          ],
          deposit: 30,
        }),
      }),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const restored = restoreNewOrderFormFromOfflineDraft(saved.value);

    expect(restored.sensitiveUnlockNeedsReentry).toBe(true);
    expect(restored.form).toMatchObject({
      customerId: "customer_1",
      customerName: "Mario Rossi",
      customerPhone: "+393331112222",
      deviceId: "device_1",
      brand: "Apple",
      model: "iPhone 13",
      deviceUnlock: { method: "none" },
      deposit: 30,
      faults: [
        {
          line_id: "00000000-0000-4000-8000-000000000101",
          catalog_key: "display:lcd",
          key: "display:lcd",
          categoryKey: "display",
          categoryLabel: "屏幕",
          name: "内屏漏液",
          price: 89,
        },
      ],
    });
    expect(JSON.stringify(saved.value.draftPayload).toLowerCase()).not.toContain("cost");
  });

  it("detects whether a form is worth autosaving and fingerprints meaningful changes", () => {
    expect(isNewOrderFormWorthOfflineAutosave(initialNewOrderForm)).toBe(false);
    expect(
      isNewOrderFormWorthOfflineAutosave(
        makeForm({ deviceUnlock: { method: "pin", value: "001258" } }),
      ),
    ).toBe(false);

    const base = makeForm({ customerPhone: "3331112222" });
    const changed = makeForm({ customerPhone: "3331112222", model: "iPhone 13" });

    expect(isNewOrderFormWorthOfflineAutosave(base)).toBe(true);
    expect(getNewOrderOfflineDraftFingerprint(base)).not.toBe(
      getNewOrderOfflineDraftFingerprint(changed),
    );
  });

  it("stores only allowed top-level payload keys accepted by the offline service", async () => {
    const payload = buildNewOrderOfflineDraftPayload(
      makeForm({
        customerName: "Mario Rossi",
        customerPhone: "+393331112222",
        brand: "Apple",
        model: "iPhone 13",
        issue: "Battery",
        accessoryNotes: "Cover",
        warrantyText: "12个月",
        warrantyMonths: 12,
        warrantyChangeReason: "Premium repair",
        deposit: 10.5,
      }),
    );

    expect(payload).toMatchObject({
      orderType: "quick_repair",
      orderStatus: "new",
      deviceCustody: null,
      customerName: "Mario Rossi",
      customerPhone: "+393331112222",
      deviceBrand: "Apple",
      deviceModel: "iPhone 13",
      issueDescription: "Battery",
      accessoryNotes: "Cover",
      warrantyDraft: {
        text: "12个月",
        months: 12,
        changeReason: "Premium repair",
      },
      depositAmountCents: 1050,
    });
  });

  it("round trips paused customer and quote drafts without syncing them in unknown mode", async () => {
    const form = makeForm({
      issueCaptureMode: "unknown",
      issue: "掉电很快",
      faults: [
        {
          key: "battery:main",
          categoryKey: "battery",
          categoryLabel: "电池",
          name: "更换电池",
          price: 59,
          note: "Sostituzione batteria",
        },
      ],
      deposit: 20,
    });
    const payload = buildNewOrderOfflineDraftPayload(form);
    expect(payload).toMatchObject({
      issueMode: "unknown",
      issueDescription: "客户暂时无法确认具体故障，需检测。",
      reportedIssueDraft: "掉电很快",
      pausedRepairItems: [{ name: "更换电池", price: 59 }],
      pausedDepositAmountCents: 2000,
      repairItems: [],
      quotedPriceCents: 0,
      depositAmountCents: 0,
    });

    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-17T18:00:00.000Z",
      idFactory: () => "id_unknown",
    });
    const saved = await service.saveDraft(buildNewOrderOfflineDraftInput({ form }));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const restored = restoreNewOrderFormFromOfflineDraft(saved.value);
    expect(restored.form.issueCaptureMode).toBe("unknown");
    expect(restored.form.issue).toBe("掉电很快");
    expect(restored.form.deposit).toBe(20);
    expect(restored.form.faults).toEqual([
      expect.objectContaining({ name: "更换电池", price: 59 }),
    ]);
  });

  it("round trips diagnostic-only as a separate paused intake intent", () => {
    const form = makeForm({
      issueCaptureMode: "diagnostic_only",
      issue: "保留但不提交的客户原话",
      deposit: 20,
    });
    const payload = buildNewOrderOfflineDraftPayload(form);
    expect(payload).toMatchObject({
      issueMode: "diagnostic_only",
      issueDescription: "客户本次仅要求检测，暂不授权维修。",
      reportedIssueDraft: "保留但不提交的客户原话",
      depositAmountCents: 0,
    });
  });

  it("restores a legacy unknown draft without the new paused fields", async () => {
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-17T18:00:00.000Z",
      idFactory: () => "id_legacy_unknown",
    });
    const saved = await service.saveDraft(
      buildNewOrderOfflineDraftInput({
        form: makeForm({
          issueCaptureMode: "unknown",
          issue: "旧版不会保存的客户原话",
          deposit: 20,
        }),
      }),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const legacyPayload = { ...saved.value.draftPayload };
    delete legacyPayload.reportedIssueDraft;
    delete legacyPayload.pausedRepairItems;
    delete legacyPayload.pausedDepositAmountCents;

    const restored = restoreNewOrderFormFromOfflineDraft({
      ...saved.value,
      draftPayload: legacyPayload,
    });
    expect(restored.form.issueCaptureMode).toBe("unknown");
    expect(restored.form.issue).toBe("");
    expect(restored.form.faults).toEqual([]);
    expect(restored.form.deposit).toBe(0);
  });

  it("keeps a customer-held PIN re-entry marker without persisting the PIN", () => {
    const form = makeForm({
      customerPhone: "+393331112222",
      deviceCustodyStatus: "with_customer",
      deviceUnlock: { method: "pin", value: "001258" },
    });
    const input = buildNewOrderOfflineDraftInput({ form });
    const payload = input.draftPayload;

    expect(payload.deviceCustody).toBe("with_customer");
    expect(hasNewOrderSensitiveUnlockDraft(form)).toBe(true);
    expect(input.hasSensitiveVaultEntry).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("001258");
    expect(isNewOrderFormWorthOfflineAutosave(form)).toBe(true);
  });

  it("requires confirmation when restoring a legacy draft without custody", async () => {
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_legacy",
    });
    const saved = await service.saveDraft(
      buildNewOrderOfflineDraftInput({ form: makeForm({ customerPhone: "+393331112222" }) }),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const legacyPayload = { ...saved.value.draftPayload };
    delete legacyPayload.deviceCustody;

    const restored = restoreNewOrderFormFromOfflineDraft({
      ...saved.value,
      draftPayload: legacyPayload,
    });

    expect(restored.form.deviceCustodyStatus).toBeNull();
    expect(restored.custodyNeedsConfirmation).toBe(true);
  });

  it("round-trips fact catalog revision and preserves retired codes for review", async () => {
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-21T12:00:00.000Z",
      idFactory: () => "id_fact_draft",
    });
    const input = buildNewOrderOfflineDraftInput({
      form: makeForm({
        issue: "无法正常使用",
        reportedSymptomCodes: ["will_not_charge"],
        reportedSymptomCatalogRevision: "retired-revision",
      }),
    });
    expect(input.draftPayload.draftSchemaVersion).toBe(2);
    const saved = await service.saveDraft(input);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const restored = restoreNewOrderFormFromOfflineDraft(saved.value);
    expect(restored.form.reportedSymptomCodes).toEqual(["will_not_charge"]);
    expect(restored.form.reportedSymptomCatalogRevision).toBe("retired-revision");
  });
});

function makeForm(patch: Partial<NewOrderFormState>): NewOrderFormState {
  return {
    ...initialNewOrderForm,
    ...patch,
  };
}
