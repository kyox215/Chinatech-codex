import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { createRepairDeskOfflineOrderService } from "@/features/offline/model/offline-order-service";
import { createRepairDeskOfflineMemoryStore } from "@/features/offline/model/offline-store";
import type { RepairDeskOfflineScope } from "@/features/offline/model/offline-types";
import { buildNewOrderOfflineDraftInput } from "@/features/orders/model/new-order-offline-draft";
import type { NewOrderOfflineDraftRestoreResult } from "@/features/orders/model/new-order-offline-draft";
import {
  initialNewOrderForm,
  type NewOrderFormState,
} from "@/features/orders/model/new-order-form";

import { useNewOrderOfflineAutosave } from "./use-new-order-offline-autosave";

const scope: RepairDeskOfflineScope = { storeId: "store_1", userId: "user_1" };
type HookValue = ReturnType<typeof useNewOrderOfflineAutosave>;

describe("useNewOrderOfflineAutosave", () => {
  it("autosaves safe fields with only a sensitive re-entry marker", async () => {
    const harness = createServiceHarness();
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        form={makeForm({
          customerName: "Mario Rossi",
          customerPhone: "+393331112222",
          brand: "Apple",
          model: "iPhone 13",
          deviceUnlock: { method: "pin", value: "001258" },
        })}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => harness.service}
      />,
    );

    await waitFor(() => expect(latest?.state).toBe("saved"));
    const drafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });

    expect(drafts.ok && drafts.value).toHaveLength(1);
    expect(drafts.ok && drafts.value[0]?.draftPayload).toMatchObject({
      customerName: "Mario Rossi",
      customerPhone: "+393331112222",
      deviceBrand: "Apple",
      deviceModel: "iPhone 13",
      issueDescription: "",
    });
    expect(drafts.ok && drafts.value[0]?.hasSensitiveVaultEntry).toBe(true);
    expect(JSON.stringify(drafts.ok && drafts.value[0])).not.toContain("001258");
    expect(JSON.stringify(drafts.ok && drafts.value[0]).toLowerCase()).not.toContain("unlock");
  });

  it("reports unavailable local storage without blocking the form", async () => {
    const store = createRepairDeskOfflineMemoryStore({ unavailable: true });
    const service = createRepairDeskOfflineOrderService({ store, scope });
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        form={makeForm({ customerPhone: "+393331112222" })}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => service}
      />,
    );

    await waitFor(() => expect(latest?.state).toBe("unavailable"));
    expect(latest?.errorMessage).toContain("无法使用本机草稿");
  });

  it("times out a stalled preflight and succeeds after retry", async () => {
    const harness = createServiceHarness();
    const healthCheck = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementation(() => harness.service.healthCheck());
    const service = { ...harness.service, healthCheck };
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        form={initialNewOrderForm}
        onValue={(value) => {
          latest = value;
        }}
        preflightTimeoutMs={20}
        serviceFactory={() => service}
      />,
    );

    await waitFor(() => expect(latest?.state).toBe("error"));
    expect(latest?.errorMessage).toContain("超时");
    act(() => requireHook(latest).retryPreflight());
    await waitFor(() => expect(latest?.state).toBe("ready"));
    expect(healthCheck).toHaveBeenCalledTimes(2);
  });

  it("restores and discards prompted local drafts by scope", async () => {
    const harness = createServiceHarness();
    await harness.service.saveDraft(
      buildNewOrderOfflineDraftInput({
        form: makeForm({
          customerId: "customer_1",
          customerName: "Mario Rossi",
          customerPhone: "+393331112222",
          deviceId: "device_1",
          brand: "Apple",
          model: "iPhone 13",
        }),
      }),
    );
    let latest: HookValue | undefined;

    render(
      <AutosaveHarness
        form={initialNewOrderForm}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => harness.service}
      />,
    );

    await waitFor(() => expect(latest?.draftPrompt?.localDraftId).toBe("draft_id_1"));

    const hook = requireHook(latest);
    const restoredHolder: { value: NewOrderOfflineDraftRestoreResult | null } = { value: null };
    await act(async () => {
      restoredHolder.value = await hook.restorePromptDraft();
    });

    const restored = restoredHolder.value;
    expect(restored).not.toBeNull();
    if (!restored) throw new Error("Draft was not restored.");
    expect(restored.form).toMatchObject({
      customerId: "customer_1",
      customerName: "Mario Rossi",
      customerPhone: "+393331112222",
      deviceId: "device_1",
      brand: "Apple",
      model: "iPhone 13",
      deviceUnlock: { method: "none" },
    });
    await waitFor(() => expect(latest?.draftPrompt).toBeNull());

    let discarded = false;
    await act(async () => {
      discarded = await requireHook(latest).discardCurrentDraft();
    });
    expect(discarded).toBe(true);
    const activeDrafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });
    expect(activeDrafts.ok && activeDrafts.value).toEqual([]);
  });

  it("promotes an offline create with custody into the idempotent outbox", async () => {
    const harness = createServiceHarness();
    let latest: HookValue | undefined;
    render(
      <AutosaveHarness
        form={makeForm({
          customerName: "Mario Rossi",
          customerPhone: "+393331112222",
          brand: "Apple",
          model: "iPhone 13",
          deviceCustodyStatus: "with_customer",
        })}
        onValue={(value) => {
          latest = value;
        }}
        serviceFactory={() => harness.service}
      />,
    );

    await waitFor(() => expect(latest?.state).toBe("saved"));
    await act(async () => {
      await requireHook(latest).queueCurrentDraftForSync();
    });

    await waitFor(() => expect(latest?.state).toBe("queued"));
    const queued = await harness.store.listOutboxEntries({ ...scope, status: "pending_sync" });
    expect(queued.ok && queued.value).toHaveLength(1);
    expect(queued.ok && queued.value[0]?.payload).toMatchObject({
      deviceCustody: "with_customer",
      orderStatus: "new",
    });
  });

  it.each(["with_shop", "with_customer"] as const)(
    "refuses to queue raw unlock secrets while custody is %s",
    async (deviceCustodyStatus) => {
      const harness = createServiceHarness();
      let latest: HookValue | undefined;
      render(
        <AutosaveHarness
          form={makeForm({
            customerPhone: "+393331112222",
            brand: "Apple",
            model: "iPhone 13",
            deviceCustodyStatus,
            deviceUnlock: { method: "pin", value: "001258" },
          })}
          onValue={(value) => {
            latest = value;
          }}
          serviceFactory={() => harness.service}
        />,
      );

      await waitFor(() => expect(latest?.state).toBe("saved"));
      let error: unknown;
      await act(async () => {
        try {
          await requireHook(latest).queueCurrentDraftForSync();
        } catch (caught) {
          error = caught;
        }
      });
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("不会保存手机密码");
      const queued = await harness.store.listOutboxEntries({ ...scope, status: "pending_sync" });
      expect(queued.ok && queued.value).toEqual([]);
    },
  );
});

function AutosaveHarness({
  form,
  onValue,
  serviceFactory,
  preflightTimeoutMs,
}: {
  form: NewOrderFormState;
  onValue: (value: ReturnType<typeof useNewOrderOfflineAutosave>) => void;
  serviceFactory: Parameters<typeof useNewOrderOfflineAutosave>[0]["serviceFactory"];
  preflightTimeoutMs?: number;
}) {
  const value = useNewOrderOfflineAutosave({
    form,
    scope,
    debounceMs: 0,
    preflightTimeoutMs,
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

function makeForm(patch: Partial<NewOrderFormState>) {
  return {
    ...initialNewOrderForm,
    ...patch,
  };
}
