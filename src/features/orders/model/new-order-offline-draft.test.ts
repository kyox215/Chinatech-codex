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
          key: "display:lcd",
          categoryKey: "display",
          categoryLabel: "屏幕",
          name: "内屏漏液",
          price: 89,
        },
      ],
    });
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

  it("round trips an explicit unknown issue without creating repair items", () => {
    const payload = buildNewOrderOfflineDraftPayload(
      makeForm({ issueCaptureMode: "unknown", issue: "", faults: [] }),
    );
    expect(payload).toMatchObject({
      issueMode: "unknown",
      issueDescription: "客户暂时无法确认具体故障，需检测。",
      repairItems: [],
      quotedPriceCents: 0,
    });

    const restored = restoreNewOrderFormFromOfflineDraft({
      localDraftId: "draft_unknown",
      localOrderId: "local_order_unknown",
      storeId: "store_1",
      userId: "user_1",
      mode: "create",
      draftPayload: payload,
      customerLinkMode: "walk_in_snapshot_only",
      deviceLinkMode: "order_snapshot_only",
      hasSensitiveVaultEntry: false,
      attachmentStagingIds: [],
      createdAt: "2026-07-17T18:00:00.000Z",
      updatedAt: "2026-07-17T18:00:00.000Z",
      expiresAt: "2026-08-17T18:00:00.000Z",
      status: "draft_local",
    });
    expect(restored.form.issueCaptureMode).toBe("unknown");
    expect(restored.form.issue).toBe("");
    expect(restored.form.faults).toEqual([]);
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
});

function makeForm(patch: Partial<NewOrderFormState>): NewOrderFormState {
  return {
    ...initialNewOrderForm,
    ...patch,
  };
}
