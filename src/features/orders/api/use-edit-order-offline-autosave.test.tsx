import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { createRepairDeskOfflineOrderService } from "@/features/offline/model/offline-order-service";
import { createRepairDeskOfflineMemoryStore } from "@/features/offline/model/offline-store";
import type { RepairDeskOfflineScope } from "@/features/offline/model/offline-types";
import { buildEditForm } from "@/features/orders/model/edit-order-form";
import { buildEditOrderOfflineDraftInput } from "@/features/orders/model/edit-order-offline-draft";
import type { EditOrderOfflineDraftRestoreResult } from "@/features/orders/model/edit-order-offline-draft";
import type { OrderDetail, UpdateOrderInput } from "@/lib/repairdesk/types";

import { useEditOrderOfflineAutosave } from "./use-edit-order-offline-autosave";

const scope: RepairDeskOfflineScope = { storeId: "store_1", userId: "user_1" };
type HookValue = ReturnType<typeof useEditOrderOfflineAutosave>;

describe("useEditOrderOfflineAutosave", () => {
  it("autosaves non-sensitive edit fields without storing raw unlock values", async () => {
    const harness = createServiceHarness();
    const data = makeOrderDetail();
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        orderDetail={data}
        draft={{
          ...buildEditForm(data),
          issue_description: "Updated issue from edit screen",
          device_unlock: { method: "pin", value: "009999" },
        }}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => harness.service}
      />,
    );

    await waitFor(() => expect(latest?.state).toBe("saved"));
    const drafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });

    expect(drafts.ok && drafts.value).toHaveLength(1);
    expect(drafts.ok && drafts.value[0]).toMatchObject({
      mode: "edit",
      localOrderId: "order_1",
      serverOrderId: "order_1",
      baseUpdatedAt: "2026-07-06T10:00:00.000Z",
      draftPayload: {
        issueDescription: "Updated issue from edit screen",
      },
    });
    expect(JSON.stringify(drafts.ok && drafts.value[0])).not.toContain("009999");
    expect(JSON.stringify(drafts.ok && drafts.value[0]).toLowerCase()).not.toContain("unlock");
  });

  it("reports unavailable local storage without blocking edit mode", async () => {
    const store = createRepairDeskOfflineMemoryStore({ unavailable: true });
    const service = createRepairDeskOfflineOrderService({ store, scope });
    const data = makeOrderDetail();
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        orderDetail={data}
        draft={{ ...buildEditForm(data), issue_description: "Local change" }}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => service}
      />,
    );

    await waitFor(() => expect(latest?.state).toBe("unavailable"));
    expect(latest?.errorMessage).toContain("无法使用本机编辑草稿");
  });

  it("restores and discards only the prompted edit draft for the current order", async () => {
    const harness = createServiceHarness();
    const data = makeOrderDetail();
    await harness.service.saveDraft(
      buildEditOrderOfflineDraftInput({
        data: makeOrderDetail({ orderId: "order_2" }),
        draft: {
          ...buildEditForm(makeOrderDetail({ orderId: "order_2" })),
          issue_description: "Other order change",
        },
      }),
    );
    await harness.service.saveDraft(
      buildEditOrderOfflineDraftInput({
        data,
        draft: {
          ...buildEditForm(data),
          issue_description: "Current order local change",
          deposit_amount: 35,
        },
      }),
    );
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        orderDetail={data}
        draft={null}
        autosaveEnabled={false}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => harness.service}
      />,
    );

    await waitFor(() => expect(latest?.draftPrompt?.localDraftId).toBe("draft_id_2"));

    const restoredHolder: { value: EditOrderOfflineDraftRestoreResult | null } = { value: null };
    await act(async () => {
      restoredHolder.value = await requireHook(latest).restorePromptDraft();
    });

    const restored = restoredHolder.value;
    expect(restored?.status).toBe("restored");
    if (!restored || restored.status !== "restored") throw new Error("Draft was not restored.");
    expect(restored.draft).toMatchObject({
      issue_description: "Current order local change",
      deposit_amount: 35,
      device_unlock: { method: "pin", value: "001258" },
    });

    let discarded = false;
    await act(async () => {
      discarded = await requireHook(latest).discardCurrentDraft();
    });
    expect(discarded).toBe(true);
    const activeDrafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });
    expect(activeDrafts.ok && activeDrafts.value.map((draft) => draft.serverOrderId)).toEqual([
      "order_2",
    ]);
  });

  it("marks a prompt as conflict when the saved base version is stale", async () => {
    const harness = createServiceHarness();
    const oldData = makeOrderDetail({ updatedAt: "2026-07-06T10:00:00.000Z" });
    const currentData = makeOrderDetail({ updatedAt: "2026-07-06T11:00:00.000Z" });
    await harness.service.saveDraft(
      buildEditOrderOfflineDraftInput({
        data: oldData,
        draft: {
          ...buildEditForm(oldData),
          issue_description: "Stale local change",
        },
      }),
    );
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        orderDetail={currentData}
        draft={null}
        autosaveEnabled={false}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => harness.service}
      />,
    );

    await waitFor(() => expect(latest?.draftPrompt?.hasConflict).toBe(true));
    const restoredHolder: { value: EditOrderOfflineDraftRestoreResult | null } = { value: null };
    await act(async () => {
      restoredHolder.value = await requireHook(latest).restorePromptDraft();
    });
    const restored = restoredHolder.value;

    expect(restored).toMatchObject({
      status: "conflict",
      baseUpdatedAt: "2026-07-06T10:00:00.000Z",
      currentUpdatedAt: "2026-07-06T11:00:00.000Z",
    });
    await waitFor(() => expect(latest?.pendingRestoreNotice).toContain("需要人工对照"));
  });
});

function AutosaveHarness({
  orderDetail,
  draft,
  onValue,
  serviceFactory,
  autosaveEnabled = true,
}: {
  orderDetail: OrderDetail;
  draft: UpdateOrderInput | null;
  onValue: (value: ReturnType<typeof useEditOrderOfflineAutosave>) => void;
  serviceFactory: Parameters<typeof useEditOrderOfflineAutosave>[0]["serviceFactory"];
  autosaveEnabled?: boolean;
}) {
  const value = useEditOrderOfflineAutosave({
    draft,
    orderDetail,
    scope,
    debounceMs: 0,
    autosaveEnabled,
    serviceFactory,
  });
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);
  return null;
}

function requireHook(value: HookValue | undefined): HookValue {
  if (!value) throw new Error("Hook value was not captured.");
  return value;
}

function createServiceHarness() {
  let id = 0;
  const store = createRepairDeskOfflineMemoryStore();
  const service = createRepairDeskOfflineOrderService({
    store,
    scope,
    now: () => "2026-07-06T20:00:00.000Z",
    idFactory: () => {
      id += 1;
      return `id_${id}`;
    },
  });
  return { store, service };
}

function makeOrderDetail(overrides: { orderId?: string; updatedAt?: string } = {}): OrderDetail {
  const orderId = overrides.orderId ?? "order_1";
  const customerId = `${orderId}_customer`;
  const deviceId = `${orderId}_device`;
  const updatedAt = overrides.updatedAt ?? "2026-07-06T10:00:00.000Z";
  return {
    order: {
      id: orderId,
      public_no: `R-${orderId}`,
      order_type: "quick_repair",
      status: "new",
      customer_id: customerId,
      device_id: deviceId,
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
      warranty_text: "6个月",
      warranty_months: 6,
      warranty_change_reason: "",
      approval_overdue: false,
      pickup_overdue: false,
      created_at: "2026-07-06T09:00:00.000Z",
      updated_at: updatedAt,
    },
    customer: {
      id: customerId,
      name: "Mario Rossi",
      phone_e164: "+393331112222",
      phone_raw: "3331112222",
      contact_phones: [],
      consent_marketing: false,
      consent_sms: false,
    },
    device: {
      id: deviceId,
      customer_id: customerId,
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
