import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
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
  it("retains the recovery card with one preflight when a parent supplies a new inline factory", async () => {
    const harness = createServiceHarness();
    await harness.service.saveDraft(
      buildNewOrderOfflineDraftInput({ form: makeForm({ model: "Synthetic recovery draft" }) }),
    );
    const healthCheck = vi.spyOn(harness.service, "healthCheck");
    const listLocalDrafts = vi.spyOn(harness.service, "listLocalDrafts");
    const services = Array.from({ length: 6 }, () => ({ ...harness.service }));
    const factory = vi.fn((version: number) => services[version]!);
    let latest: HookValue | undefined;
    function Parent({ version }: { version: number }) {
      const value = useNewOrderOfflineAutosave({
        form: initialNewOrderForm,
        scope: { ...scope },
        serviceFactory: () => factory(version),
      });
      useLayoutEffect(() => {
        latest = value;
      }, [value]);
      return value.draftPrompt ? <div role="status">Synthetic recovery card</div> : null;
    }
    const result = render(<Parent version={0} />);
    const card = await screen.findByRole("status");
    const prompt = requireHook(latest).draftPrompt;
    for (let version = 1; version <= 5; version++) {
      result.rerender(<Parent version={version} />);
      expect(requireHook(latest).state).toBe("ready");
      expect(requireHook(latest).draftPrompt).toBe(prompt);
      expect(screen.getByRole("status")).toBe(card);
    }
    expect(factory).toHaveBeenCalledTimes(1);
    expect(healthCheck).toHaveBeenCalledTimes(1);
    expect(listLocalDrafts).toHaveBeenCalledTimes(1);
  });

  it("starts a new service for a changed store, user or enabled session and keeps retry explicit", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    const services = new Map<string, ReturnType<typeof createRepairDeskOfflineOrderService>>();
    const factory = vi.fn((nextScope: RepairDeskOfflineScope) => {
      const key = JSON.stringify(nextScope);
      if (!services.has(key)) {
        services.set(key, createRepairDeskOfflineOrderService({ store, scope: nextScope }));
      }
      return services.get(key)!;
    });
    let latest: HookValue | undefined;
    function Parent({
      currentScope,
      enabled = true,
    }: {
      currentScope: RepairDeskOfflineScope;
      enabled?: boolean;
    }) {
      const value = useNewOrderOfflineAutosave({
        form: initialNewOrderForm,
        scope: currentScope,
        enabled,
        serviceFactory: (nextScope) => factory(nextScope),
      });
      useLayoutEffect(() => {
        latest = value;
      }, [value]);
      return null;
    }
    const result = render(<Parent currentScope={scope} />);
    await waitFor(() => expect(latest?.state).toBe("ready"));
    expect(factory).toHaveBeenCalledTimes(1);
    const otherStore = { ...scope, storeId: "store_2" };
    result.rerender(<Parent currentScope={otherStore} />);
    await waitFor(() => expect(latest?.state).toBe("ready"));
    expect(factory).toHaveBeenLastCalledWith(otherStore);
    expect(factory).toHaveBeenCalledTimes(2);
    const otherUser = { ...otherStore, userId: "user_2" };
    result.rerender(<Parent currentScope={otherUser} />);
    await waitFor(() => expect(latest?.state).toBe("ready"));
    expect(factory).toHaveBeenLastCalledWith(otherUser);
    expect(factory).toHaveBeenCalledTimes(3);
    act(() => requireHook(latest).retryPreflight());
    await waitFor(() => expect(latest?.state).toBe("ready"));
    expect(factory).toHaveBeenCalledTimes(3);
    result.rerender(<Parent currentScope={otherUser} enabled={false} />);
    expect(latest?.state).toBe("disabled");
    result.rerender(<Parent currentScope={otherUser} />);
    await waitFor(() => expect(latest?.state).toBe("ready"));
    expect(factory).toHaveBeenCalledTimes(4);
  });

  it("does not restart draft checking when a parent rebuilds the same store/user scope", async () => {
    const harness = createServiceHarness();
    await harness.service.saveDraft(
      buildNewOrderOfflineDraftInput({ form: makeForm({ model: "Retained synthetic draft" }) }),
    );
    const healthCheck = vi.spyOn(harness.service, "healthCheck");
    const listLocalDrafts = vi.spyOn(harness.service, "listLocalDrafts");
    const serviceFactory = () => harness.service;
    let latest: HookValue | undefined;
    function Parent({ version }: { version: number }) {
      const value = useNewOrderOfflineAutosave({
        form: { ...initialNewOrderForm },
        scope: { ...scope },
        serviceFactory,
      });
      useEffect(() => {
        latest = value;
      }, [value]);
      return <span>{version}</span>;
    }
    const result = render(<Parent version={0} />);
    await waitFor(() => expect(latest?.draftPrompt?.localDraftId).toBe("draft_id_1"));
    const prompt = requireHook(latest).draftPrompt;
    for (let version = 1; version <= 5; version++) {
      result.rerender(<Parent version={version} />);
      expect(requireHook(latest).state).toBe("ready");
      expect(requireHook(latest).draftPrompt).toBe(prompt);
    }
    expect(healthCheck).toHaveBeenCalledTimes(1);
    expect(listLocalDrafts).toHaveBeenCalledTimes(1);
  });
  it("reports the committed reset as clean before passive effects after discarding a saved draft", async () => {
    const harness = createServiceHarness();
    const serviceFactory = () => harness.service;
    let latest: HookValue | undefined;
    let resetForm: (() => void) | undefined;
    let dirtyAtResetCommit: boolean | undefined;

    function CommitHarness() {
      const [form, setForm] = useState(makeForm({ model: "Synthetic Safari draft" }));
      const value = useNewOrderOfflineAutosave({ form, scope, debounceMs: 0, serviceFactory });
      resetForm = () => setForm(initialNewOrderForm);
      useLayoutEffect(() => {
        latest = value;
        if (!form.model && dirtyAtResetCommit === undefined) {
          dirtyAtResetCommit = value.isCurrentDraftDirty();
        }
      }, [form, value]);
      return null;
    }

    render(<CommitHarness />);
    await waitFor(() => expect(latest?.state).toBe("saved"));
    expect(requireHook(latest).isCurrentDraftDirty()).toBe(false);
    await act(async () => {
      expect(await requireHook(latest).discardCurrentDraft()).toBe(true);
      expect(requireHook(latest).isCurrentDraftDirty()).toBe(true);
      flushSync(() => resetForm?.());
      expect(dirtyAtResetCommit).toBe(false);
      expect(requireHook(latest).isCurrentDraftDirty()).toBe(false);
    });
    const drafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });
    expect(drafts.ok && drafts.value).toEqual([]);
  });

  it("discards a prompted draft and the current form as one close-session operation", async () => {
    const harness = createServiceHarness();
    await harness.service.saveDraft(
      buildNewOrderOfflineDraftInput({ form: makeForm({ model: "PROMPTED DRAFT" }) }),
    );
    let latest: HookValue | undefined;
    let resetForm: (() => void) | undefined;

    function PromptedDraftHarness() {
      const [form, setForm] = useState(makeForm({ model: "UNSAVED FORM CHANGE" }));
      const value = useNewOrderOfflineAutosave({
        form,
        scope,
        debounceMs: 0,
        serviceFactory: () => harness.service,
      });
      resetForm = () => setForm(initialNewOrderForm);
      useLayoutEffect(() => {
        latest = value;
      }, [value]);
      return null;
    }

    render(<PromptedDraftHarness />);
    await waitFor(() => expect(latest?.draftPrompt?.localDraftId).toBe("draft_id_1"));

    await act(async () => {
      expect(await requireHook(latest).discardSessionDrafts()).toBe(true);
      flushSync(() => resetForm?.());
    });

    await waitFor(() => expect(latest?.draftPrompt).toBeNull());
    expect(requireHook(latest).isCurrentDraftDirty()).toBe(false);
    const drafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });
    expect(drafts.ok && drafts.value).toEqual([]);
  });

  it("removes a save that finishes after the editor session was discarded", async () => {
    const harness = createServiceHarness();
    let releaseSave: (() => void) | undefined;
    let markSaveStarted: (() => void) | undefined;
    const saveStarted = new Promise<void>((resolve) => {
      markSaveStarted = resolve;
    });
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const service = {
      ...harness.service,
      saveDraft: vi.fn(async (...args: Parameters<typeof harness.service.saveDraft>) => {
        markSaveStarted?.();
        await saveGate;
        return harness.service.saveDraft(...args);
      }),
    };
    let latest: HookValue | undefined;
    let resetForm: (() => void) | undefined;

    function LateSaveHarness() {
      const [form, setForm] = useState(makeForm({ model: "LATE SAVE" }));
      const value = useNewOrderOfflineAutosave({
        form,
        scope,
        debounceMs: 0,
        serviceFactory: () => service,
      });
      resetForm = () => setForm(initialNewOrderForm);
      useLayoutEffect(() => {
        latest = value;
      }, [value]);
      return null;
    }

    render(<LateSaveHarness />);
    await saveStarted;
    await act(async () => {
      expect(await requireHook(latest).discardSessionDrafts()).toBe(true);
      flushSync(() => resetForm?.());
      releaseSave?.();
    });

    await waitFor(async () => {
      const drafts = await harness.store.listOrderDrafts({ ...scope, status: "draft_local" });
      expect(drafts.ok && drafts.value).toEqual([]);
    });
    expect(requireHook(latest).isCurrentDraftDirty()).toBe(false);
  });

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
