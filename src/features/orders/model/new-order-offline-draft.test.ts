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

  it("marks unlinked customer snapshots for review instead of pretending they are linked", () => {
    const form = makeForm({
      customerName: "Cliente banco",
      customerPhone: "3331112222",
      brand: "Samsung",
      model: "A52",
      imei: "SN123",
    });

    expect(buildNewOrderOfflineRelationshipPlan(form)).toEqual({
      customerLinkMode: "unknown_needs_review",
      customerLinkDraft: {
        snapshot: {
          name: "Cliente banco",
          phone: "3331112222",
        },
      },
      deviceLinkMode: "order_snapshot_only",
      deviceLinkDraft: {
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
    expect(input.hasSensitiveVaultEntry).toBe(false);
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
    expect(saved.ok && saved.value.hasSensitiveVaultEntry).toBe(false);
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

    expect(restored.sensitiveUnlockNeedsReentry).toBe(false);
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
});

function makeForm(patch: Partial<NewOrderFormState>): NewOrderFormState {
  return {
    ...initialNewOrderForm,
    ...patch,
  };
}
