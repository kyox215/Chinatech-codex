import { describe, expect, it } from "vitest";

import { createRepairDeskOfflineOrderService } from "@/features/offline/model/offline-order-service";
import { createRepairDeskOfflineMemoryStore } from "@/features/offline/model/offline-store";
import type { OrderDetail } from "@/lib/repairdesk/types";

import { buildEditForm } from "./edit-order-form";
import { buildOrderEditSavePlan } from "./order-edit-save";
import {
  buildEditOrderOfflineDraftInput,
  buildEditOrderOfflineDraftPayload,
  buildEditOrderOfflineRelationshipPlan,
  hasEditOrderSensitiveUnlockDraft,
  isEditOrderFormWorthOfflineAutosave,
  restoreEditOrderFormFromOfflineDraft,
} from "./edit-order-offline-draft";

describe("edit order offline draft mapping", () => {
  it("maps an order edit into scoped edit draft metadata", async () => {
    const data = makeOrderDetail();
    const draft = {
      ...buildEditForm(data),
      customer_name: "Mario Rossi Updated",
      customer_phone: "+393331112222 / +393334445555",
      device_notes: "Back glass cracked",
      diagnosis_result: "Display assembly required",
      deposit_amount: 35,
      device_unlock: { method: "pin", value: "001258" } as const,
    };
    const input = buildEditOrderOfflineDraftInput({ data, draft });

    expect(input).toMatchObject({
      mode: "edit",
      localOrderId: "order_1",
      serverOrderId: "order_1",
      baseUpdatedAt: "2026-07-06T10:00:00.000Z",
      hasSensitiveVaultEntry: false,
    });
    expect(input.relationshipPlan).toMatchObject({
      customerLinkMode: "existing_customer",
      customerLinkDraft: {
        customerId: "customer_1",
      },
      deviceLinkMode: "existing_customer_device",
      deviceLinkDraft: {
        deviceId: "device_1",
      },
    });
    expect(input.draftPayload).toMatchObject({
      depositAmountCents: 3500,
    });
    expect(JSON.stringify(input)).not.toContain("001258");
    expect(JSON.stringify(input).toLowerCase()).not.toContain("unlock");
    expect(JSON.stringify(input)).not.toContain("Mario");
    expect(JSON.stringify(input)).not.toContain("3331112222");
    expect(input.relationshipPlan?.customerLinkDraft).not.toHaveProperty("snapshot");

    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_1",
    });
    const saved = await service.saveDraft(input);

    expect(saved.ok).toBe(true);
  });

  it("restores only quote fields while preserving current repair and unlock values", async () => {
    const data = makeOrderDetail();
    const draft = {
      ...buildEditForm(data),
      issue_description: "Updated issue from local draft",
      device_unlock: { method: "pin", value: "009999" } as const,
      fault_prices: [
        {
          line_id: "00000000-0000-4000-8000-000000000102",
          catalog_key: "display:main",
          name: "屏幕",
          price: 89,
          note: "OLED",
        },
      ],
      deposit_amount: 30,
    };
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_1",
    });
    const saved = await service.saveDraft(buildEditOrderOfflineDraftInput({ data, draft }));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    expect(JSON.stringify(saved.value)).not.toContain("009999");
    const restored = restoreEditOrderFormFromOfflineDraft({
      draft: saved.value,
      data,
      defaultWarrantyMonths: 6,
    });

    expect(restored.status).toBe("restored");
    if (restored.status !== "restored") return;
    expect(restored.draft).toMatchObject({
      expected_updated_at: "2026-07-06T10:00:00.000Z",
      issue_description: data.order.issue_description,
      deposit_amount: 30,
      device_unlock: { method: "pin", value: "001258" },
      fault_prices: [
        {
          line_id: "00000000-0000-4000-8000-000000000102",
          catalog_key: "display:main",
          name: "屏幕",
          price: 89,
          note: "OLED",
        },
      ],
    });
    expect(JSON.stringify(saved.value.draftPayload).toLowerCase()).not.toContain("cost");
  });

  it("blocks restoring an edit draft when the server order version changed", async () => {
    const originalData = makeOrderDetail({ updatedAt: "2026-07-06T10:00:00.000Z" });
    const currentData = makeOrderDetail({ updatedAt: "2026-07-06T11:00:00.000Z" });
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_1",
    });
    const saved = await service.saveDraft(
      buildEditOrderOfflineDraftInput({
        data: originalData,
        draft: {
          ...buildEditForm(originalData),
          issue_description: "Local stale change",
        },
      }),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const restored = restoreEditOrderFormFromOfflineDraft({
      draft: saved.value,
      data: currentData,
      defaultWarrantyMonths: 6,
    });

    expect(restored).toMatchObject({
      status: "conflict",
      baseUpdatedAt: "2026-07-06T10:00:00.000Z",
      currentUpdatedAt: "2026-07-06T11:00:00.000Z",
    });
  });

  it("detects meaningful local edit changes without treating unlock-only edits as autosave data", () => {
    const data = makeOrderDetail();
    const base = buildEditForm(data);

    expect(isEditOrderFormWorthOfflineAutosave({ data, draft: base })).toBe(false);
    expect(
      isEditOrderFormWorthOfflineAutosave({
        data,
        draft: { ...base, device_unlock: { method: "pin", value: "009999" } },
      }),
    ).toBe(false);
    expect(
      hasEditOrderSensitiveUnlockDraft({ ...base, device_unlock: { method: "pin", value: "" } }),
    ).toBe(false);
    expect(
      hasEditOrderSensitiveUnlockDraft({ ...base, device_unlock: { method: "pin", value: "1" } }),
    ).toBe(true);
    expect(
      isEditOrderFormWorthOfflineAutosave({ data, draft: { ...base, deposit_amount: 25 } }),
    ).toBe(true);
    expect(
      isEditOrderFormWorthOfflineAutosave({
        data,
        draft: { ...base, issue_description: "Changed issue" },
      }),
    ).toBe(false);
  });

  it("uses only allowed top-level payload and relationship keys", () => {
    const data = makeOrderDetail();
    const draft = {
      ...buildEditForm(data),
      device_notes: "Device note",
      diagnosis_result: "Diagnosis note",
      accessory_notes: "Cover",
      warranty_text: "12个月",
      warranty_months: 12,
      warranty_change_reason: "Premium repair",
    };

    expect(Object.keys(buildEditOrderOfflineDraftPayload(draft)).sort()).toEqual([
      "depositAmountCents",
      "quotedPriceCents",
      "repairItems",
    ]);
    expect(buildEditOrderOfflineRelationshipPlan(data).customerLinkMode).toBe("existing_customer");
  });

  it("ignores legacy identity snapshots after another order updates the shared customer", async () => {
    const original = makeOrderDetail();
    const draft = { ...buildEditForm(original), fault_prices: [{ name: "New quote", price: 140 }] };
    const service = createRepairDeskOfflineOrderService({
      store: createRepairDeskOfflineMemoryStore(),
      scope: { storeId: "store_1", userId: "user_1" },
      now: () => "2026-07-06T20:00:00.000Z",
      idFactory: () => "id_1",
    });
    const saved = await service.saveDraft(
      buildEditOrderOfflineDraftInput({ data: original, draft }),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const current: OrderDetail = {
      ...original,
      customer: {
        ...original.customer!,
        name: "Current shared customer",
        phone_e164: "+393330000901",
        contact_phones: ["+393330000902"],
        updated_at: "2026-07-06T21:00:00.000Z",
      },
    };
    const restored = restoreEditOrderFormFromOfflineDraft({
      draft: {
        ...saved.value,
        draftPayload: {
          ...saved.value.draftPayload,
          customerName: "Old customer",
          customerPhone: "+393330000800",
          deviceNotes: "Old device notes",
          diagnosisResult: "Old diagnosis",
        },
        customerLinkDraft: {
          customerId: "customer_1",
          snapshot: { name: "Old customer", phone: "+393330000800" },
        },
      },
      data: current,
    });
    expect(restored.status).toBe("restored");
    if (restored.status !== "restored") return;
    expect(restored.draft).toMatchObject({
      customer_name: "Current shared customer",
      customer_phone: "+393330000901",
      contact_phones: ["+393330000902"],
      expected_customer_updated_at: "2026-07-06T21:00:00.000Z",
    });
    const plan = buildOrderEditSavePlan({
      baseline: buildEditForm(current),
      draft: restored.draft,
      capabilities: { canEditIntake: true, canEditRepair: true, canAdjustFinance: true },
    });
    expect(plan.routineChanges).toEqual({});
    expect(plan.financeChange).toMatchObject({ faultPrices: [{ name: "New quote", price: 140 }] });
    expect(plan.steps).toEqual(["finance"]);
  });
});

function makeOrderDetail(overrides: { updatedAt?: string } = {}): OrderDetail {
  const updatedAt = overrides.updatedAt ?? "2026-07-06T10:00:00.000Z";
  return {
    order: {
      id: "order_1",
      public_no: "R-1001",
      order_type: "quick_repair",
      status: "new",
      customer_id: "customer_1",
      device_id: "device_1",
      customer_name: "Mario Rossi",
      customer_phone: "+393331112222",
      device_label: "Apple iPhone 13",
      device_imei: "356789012345678",
      issue_description: "Broken screen",
      diagnosis_result: "Needs display",
      quotation_amount: 89,
      deposit_amount: 20,
      balance_amount: 69,
      currency_code: "EUR",
      is_paid: false,
      approval_status: "pending",
      technician_name: "Hexiang",
      contact_phones: [],
      fault_prices: [{ name: "Display", price: 89 }],
      device_snapshot: {
        brand: "Apple",
        model: "iPhone 13",
        serial_or_imei: "356789012345678",
        device_notes: "Blue",
      },
      device_unlock_method: "pin",
      device_unlock_value: "001258",
      accessory_notes: "Cover",
      device_custody_status: "with_shop",
      warranty_text: "6个月",
      warranty_months: 6,
      warranty_change_reason: "",
      approval_overdue: false,
      pickup_overdue: false,
      created_at: "2026-07-06T09:00:00.000Z",
      updated_at: updatedAt,
    },
    customer: {
      id: "customer_1",
      name: "Mario Rossi",
      phone_e164: "+393331112222",
      phone_raw: "3331112222",
      contact_phones: [],
      consent_marketing: false,
      consent_sms: false,
    },
    device: {
      id: "device_1",
      customer_id: "customer_1",
      brand: "Apple",
      model: "iPhone 13",
      serial_or_imei: "356789012345678",
      device_notes: "Blue",
    },
    events: [],
    messages: [],
    attachments: [],
  } as OrderDetail;
}
