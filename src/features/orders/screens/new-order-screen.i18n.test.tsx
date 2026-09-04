import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ButtonHTMLAttributes, Dispatch, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NewOrderOfflineAutosaveState } from "@/features/orders/api/use-new-order-offline-autosave";
import type { NewOrderFormState } from "@/features/orders/model/new-order-form";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import type { CreateOrderInput } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

type MutationOptions = {
  mutationFn: (input?: unknown) => Promise<unknown> | unknown;
  onSuccess?: (value: unknown) => void;
  onError?: (error: Error) => void;
};

const mocks = vi.hoisted(() => ({
  registerGuard: vi.fn(() => vi.fn()),
  push: vi.fn(),
  createOrder: vi.fn(),
  createStatus: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
  toastSuccess: vi.fn(),
  timeoutError: new Error("request timed out"),
  mutationPending: false,
  queryBase: { isPending: false, isFetching: false, isError: false, refetch: vi.fn() },
  onboarding: {
    userId: "user-1",
    displayName: "Marco Rossi",
    activeStore: { id: "store-1", role: "technician" } as { id: string; role: string } | undefined,
  },
  storeContext: {
    activeStore: { id: "store-1" },
    permissions: { can_manage_order_costs: false },
  },
  storeSettings: { new_order_entry_mode: "professional", default_order_warranty_months: 6 },
  costDefaults: { isPending: false, isError: false, items: [] as unknown[] },
  offline: {
    state: "ready" as NewOrderOfflineAutosaveState,
    lastSavedAt: null as string | null,
    errorMessage: null as string | null,
    hasSensitiveUnlockDraft: false,
    draftPrompt: null as null | {
      localDraftId: string;
      updatedAt: string;
      relationshipNeedsReview: boolean;
    },
    pendingRestoreNotice: null as string | null,
    restoredForm: null as NewOrderFormState | null,
  },
  restorePromptDraft: vi.fn(),
  discardPromptDraft: vi.fn(),
  discardCurrentDraft: vi.fn(),
  queueCurrentDraftForSync: vi.fn(),
  retryPreflight: vi.fn(),
  saveNow: vi.fn(),
  isCurrentDraftDirty: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    message: mocks.toastMessage,
    success: mocks.toastSuccess,
  },
}));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
}));
vi.mock("@/components/navigation-guard-provider", () => ({
  useNavigationGuard: () => ({ registerGuard: mocks.registerGuard }),
}));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  return {
    ...actual,
    createOrder: mocks.createOrder,
    getOrderCreateOperationStatus: mocks.createStatus,
    isRepairDeskRequestTimeoutError: (error: unknown) => error === mocks.timeoutError,
  };
});
vi.mock("@/features/orders/api/use-new-order-offline-autosave", () => ({
  useNewOrderOfflineAutosave: () => ({
    ...mocks.offline,
    restorePromptDraft: mocks.restorePromptDraft,
    discardPromptDraft: mocks.discardPromptDraft,
    discardCurrentDraft: mocks.discardCurrentDraft,
    queueCurrentDraftForSync: mocks.queueCurrentDraftForSync,
    retryPreflight: mocks.retryPreflight,
    saveNow: mocks.saveNow,
    isCurrentDraftDirty: mocks.isCurrentDraftDirty,
  }),
}));
vi.mock("@/features/orders/forms/new-order-customer-device-section", () => ({
  NewOrderCustomerSection: ({
    form,
    setForm,
  }: {
    form: NewOrderFormState;
    setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  }) => (
    <div>
      <output data-testid="customer-state">{form.customerName}</output>
      <button
        type="button"
        onClick={() =>
          setForm((current) => ({
            ...current,
            customerId: "customer-dynamic-1",
            customerName: "动态中文客户",
            customerPhone: "+393330001111",
          }))
        }
      >
        Populate customer
      </button>
    </div>
  ),
  NewOrderDeviceInfoSection: ({
    setForm,
  }: {
    setForm: Dispatch<SetStateAction<NewOrderFormState>>;
  }) => (
    <button
      type="button"
      onClick={() =>
        setForm((current) => ({
          ...current,
          deviceId: "device-dynamic-1",
          brand: "华为",
          model: "Mate 自定义",
          imei: "490154203237518",
          deviceCustodyStatus: "with_shop",
          accessoryNotes: "SIM卡，原装盒",
          deviceUnlock: { method: "pin", value: "0012" },
        }))
      }
    >
      Populate device
    </button>
  ),
  NewOrderDeviceUnlockSection: () => <div data-testid="unlock-section" />,
}));
vi.mock("@/features/orders/forms/new-order-quotation-section", () => ({
  NewOrderQuotationSection: ({
    setForm,
    canManageOrderCosts,
    costDefaultsPending,
    costDefaultsError,
  }: {
    setForm: Dispatch<SetStateAction<NewOrderFormState>>;
    canManageOrderCosts: boolean;
    costDefaultsPending: boolean;
    costDefaultsError: boolean;
  }) => (
    <div
      data-testid="finance-contract"
      data-can-manage={String(canManageOrderCosts)}
      data-readonly={String(costDefaultsPending || costDefaultsError)}
    >
      <button
        type="button"
        onClick={() =>
          setForm((current) => ({
            ...current,
            deposit: 25,
            faults: [
              {
                line_id: "00000000-0000-4000-8000-000000000111",
                key: "display:original",
                categoryKey: "display",
                categoryLabel: "屏幕",
                catalog_key: "display:original",
                name: "原装屏幕",
                note: "客户自定义备注",
                price: 120,
              },
            ],
          }))
        }
      >
        Populate quote
      </button>
    </div>
  ),
}));
vi.mock("@/features/orders/forms/new-order-guided-workspace", () => ({
  NewOrderGuidedWorkspace: () => <div data-testid="guided-workspace" />,
}));
vi.mock("@tanstack/react-query", () => ({
  queryOptions: <T,>(options: T) => options,
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  useMutation: (options: MutationOptions) => ({
    mutate: (input?: unknown) => {
      void Promise.resolve()
        .then(() => options.mutationFn(input))
        .then(options.onSuccess, options.onError);
    },
    mutateAsync: async (input?: unknown) => {
      try {
        const value = await options.mutationFn(input);
        options.onSuccess?.(value);
        return value;
      } catch (error) {
        options.onError?.(error as Error);
        throw error;
      }
    },
    isPending: mocks.mutationPending,
  }),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const key = JSON.stringify(queryKey);
    if (key.includes("onboarding-status")) return { ...mocks.queryBase, data: mocks.onboarding };
    if (key.includes('"stores","context"')) return { ...mocks.queryBase, data: mocks.storeContext };
    if (key.includes("store-settings")) return { ...mocks.queryBase, data: mocks.storeSettings };
    if (key.includes("cost-defaults")) {
      return {
        ...mocks.queryBase,
        isPending: mocks.costDefaults.isPending,
        isError: mocks.costDefaults.isError,
        data: { items: mocks.costDefaults.items },
      };
    }
    return { ...mocks.queryBase, data: undefined };
  },
}));

import { NewOrderScreen } from "@/features/orders/screens/new-order-screen";

const locales = ["zh-CN", "it-IT", "en"] as const;

describe("NewOrderScreen i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createOrder.mockResolvedValue({ id: "order-created-1" });
    mocks.createStatus.mockResolvedValue({ status: "created", id: "order-created-1" });
    mocks.saveNow.mockResolvedValue(true);
    mocks.restorePromptDraft.mockImplementation(async () =>
      mocks.offline.restoredForm ? { form: mocks.offline.restoredForm } : null,
    );
    mocks.discardPromptDraft.mockResolvedValue(true);
    mocks.queueCurrentDraftForSync.mockResolvedValue("offline-operation-1");
    mocks.isCurrentDraftDirty.mockReturnValue(false);
    mocks.mutationPending = false;
    mocks.onboarding.activeStore = { id: "store-1", role: "technician" };
    mocks.onboarding.userId = "user-1";
    mocks.storeContext.permissions.can_manage_order_costs = false;
    Object.assign(mocks.costDefaults, { isPending: false, isError: false, items: [] });
    Object.assign(mocks.offline, {
      state: "ready",
      lastSavedAt: null,
      errorMessage: null,
      hasSensitiveUnlockDraft: false,
      draftPrompt: null,
      pendingRestoreNotice: null,
      restoredForm: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["zh-CN", "新建维修工单", "创建工单"],
    ["it-IT", "Nuovo ordine di riparazione", "Crea ordine"],
    ["en", "New repair order", "Create order"],
  ] as const)("renders the localized new-order chrome in %s", (locale, title, create) => {
    const { container } = render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: create })).toBeVisible();
    if (locale !== "zh-CN") expect(container.textContent).not.toMatch(/[一-鿿]/);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("submits deep-equivalent canonical Create inputs in all three locales", async () => {
    const captured: CreateOrderInput[] = [];
    mocks.createOrder.mockImplementation(async (input: CreateOrderInput) => {
      captured.push(structuredClone(input));
      return { id: `created-${captured.length}` };
    });

    for (const locale of locales) {
      const view = render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen onCreated={vi.fn()} />
        </LocaleProvider>,
      );
      populateValidForm();
      fireEvent.submit(view.container.querySelector("form")!);
      await waitFor(() => expect(captured).toHaveLength(locales.indexOf(locale) + 1));
      view.unmount();
    }

    const normalized = captured.map(({ operation_id: _operationId, ...input }) => input);
    expect(normalized[1]).toEqual(normalized[0]);
    expect(normalized[2]).toEqual(normalized[0]);
    expect(normalized[0]).toMatchObject({
      customer_id: "customer-dynamic-1",
      customer_name: "动态中文客户",
      device_id: "device-dynamic-1",
      device_brand: "华为",
      device_model: "Mate 自定义",
      accessory_notes: "SIM卡，原装盒",
      device_unlock: { method: "pin", value: "0012" },
      fault_prices: [
        {
          line_id: "00000000-0000-4000-8000-000000000111",
          catalog_key: "display:original",
          name: "原装屏幕",
          note: "客户自定义备注",
          price: 120,
        },
      ],
    });
    expect(new Set(captured.map((input) => input.operation_id)).size).toBe(3);
  });

  it.each(locales)(
    "confirms a timed-out Create with the original operation id in %s",
    async (locale) => {
      mocks.createOrder.mockRejectedValueOnce(mocks.timeoutError);
      const view = render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen onCreated={vi.fn()} />
        </LocaleProvider>,
      );
      populateValidForm();
      fireEvent.submit(view.container.querySelector("form")!);

      await waitFor(() => expect(mocks.createStatus).toHaveBeenCalledTimes(1));
      const operationId = (mocks.createOrder.mock.calls[0]?.[0] as CreateOrderInput).operation_id;
      expect(mocks.createStatus).toHaveBeenCalledWith(operationId, { timeoutMs: 8_000 });
      expect(mocks.createOrder).toHaveBeenCalledTimes(1);
      expect(mocks.toastMessage).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.new.recovery.confirming"),
      );
    },
  );

  it.each(locales)("shows safe localized validation without a Create call in %s", (locale) => {
    const view = render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    fireEvent.submit(view.container.querySelector("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      translateMessage(locale, "orders2b1.new.validation.customerPhone"),
    );
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it.each(locales)("covers every localized offline draft status in %s", (locale) => {
    const states: NewOrderOfflineAutosaveState[] = [
      "checking",
      "ready",
      "saving",
      "saved",
      "queued",
      "error",
      "unavailable",
      "disabled",
    ];
    for (const state of states) {
      mocks.offline.state = state;
      mocks.offline.lastSavedAt = state === "saved" ? "2026-09-02T10:00:00.000Z" : null;
      const view = render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen />
        </LocaleProvider>,
      );
      const expectedKey =
        state === "saved"
          ? "orders2b1.new.offline.savedAt"
          : state === "error" || state === "unavailable"
            ? "orders2b1.new.offline.unavailable"
            : (`orders2b1.new.offline.${state}` as const);
      const leadingCopy = translateMessage(locale, expectedKey).split("{")[0]!;
      expect(screen.getAllByText(new RegExp(leadingCopy)).length).toBeGreaterThan(0);
      view.unmount();
    }
  });

  it.each(locales)("shows the localized offline scope-not-ready state in %s", async (locale) => {
    mocks.onboarding.activeStore = undefined;
    render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    expect(
      await screen.findAllByText(translateMessage(locale, "orders2b1.new.offline.scope")),
    ).not.toHaveLength(0);
  });

  it.each(locales)(
    "confirms and executes localized offline-draft discard in %s",
    async (locale) => {
      mocks.offline.draftPrompt = {
        localDraftId: "draft-discard-1",
        updatedAt: "2026-09-02T10:00:00.000Z",
        relationshipNeedsReview: true,
      };
      render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen />
        </LocaleProvider>,
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.new.offline.discard"),
        }),
      );
      const dialog = screen.getByRole("alertdialog", {
        name: translateMessage(locale, "orders2b1.new.discardTitle"),
      });
      expect(dialog).toHaveTextContent(translateMessage(locale, "orders2b1.new.discardHelp"));
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.new.discardConfirm"),
        }),
      );
      await waitFor(() => expect(mocks.discardPromptDraft).toHaveBeenCalledTimes(1));
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.new.toast.discarded"),
      );
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
    },
  );

  it.each(locales)("passes hidden and read-only finance contracts in %s", async (locale) => {
    const hidden = render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("finance-contract")).toHaveAttribute("data-can-manage", "false");
    hidden.unmount();

    mocks.storeContext.permissions.can_manage_order_costs = true;
    mocks.costDefaults.isPending = true;
    render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("finance-contract")).toHaveAttribute("data-can-manage", "true"),
    );
    expect(screen.getByTestId("finance-contract")).toHaveAttribute("data-readonly", "true");
  });

  it.each(locales)(
    "localizes restore and preserves restored dynamic data in %s",
    async (locale) => {
      mocks.offline.draftPrompt = {
        localDraftId: "draft-1",
        updatedAt: "2026-09-02T10:00:00.000Z",
        relationshipNeedsReview: true,
      };
      mocks.offline.restoredForm = restoredCanonicalForm();
      render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen />
        </LocaleProvider>,
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.new.offline.restore"),
        }),
      );
      await waitFor(() => expect(mocks.restorePromptDraft).toHaveBeenCalledTimes(1));
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.new.toast.restored"),
      );
    },
  );

  it.each(locales)(
    "resolves a shared phone as a separate canonical identity in %s",
    async (locale) => {
      const conflictToken = "00000000-0000-4000-8000-000000000941";
      mocks.createOrder
        .mockRejectedValueOnce(
          new RepairDeskApiError("SERVER_SECRET_IDENTITY", 409, "CUSTOMER_IDENTITY_CONFLICT", {
            conflictToken,
            candidates: [{ customerId: "customer-existing-1", displayName: "已有中文客户" }],
          }),
        )
        .mockResolvedValueOnce({ id: "order-distinct-1" });
      const onCreated = vi.fn();
      const view = render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen onCreated={onCreated} />
        </LocaleProvider>,
      );
      populateValidForm();
      fireEvent.submit(view.container.querySelector("form")!);
      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "orders2b1.new.identityTitle"),
        }),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.new.otherShared") }),
      );
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "orders2b1.new.distinctTitle"),
        }),
      ).toBeVisible();
      expect(
        screen.getByText(translateMessage(locale, "orders2b1.new.distinctHelp")),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.new.distinctConfirm"),
        }),
      );
      await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(2));
      const first = mocks.createOrder.mock.calls[0]?.[0] as CreateOrderInput;
      const second = mocks.createOrder.mock.calls[1]?.[0] as CreateOrderInput;
      expect(second.operation_id).toBe(first.operation_id);
      expect(second).toEqual({
        ...first,
        customer_identity_resolution: {
          mode: "create_distinct_shared_phone",
          conflict_token: conflictToken,
          reason: "other",
        },
      });
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith("order-distinct-1"));
      expect(screen.queryByText("SERVER_SECRET_IDENTITY")).not.toBeInTheDocument();
    },
  );

  it.each(locales)(
    "checks six unknown Create statuses, shows uncertain, and retries the same operation id in %s",
    async (locale) => {
      vi.useFakeTimers();
      mocks.createOrder.mockRejectedValueOnce(mocks.timeoutError);
      mocks.createStatus.mockResolvedValue({ status: "pending" });
      const onCreated = vi.fn();
      const view = render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen onCreated={onCreated} />
        </LocaleProvider>,
      );
      populateValidForm();
      fireEvent.submit(view.container.querySelector("form")!);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      expect(mocks.createOrder).toHaveBeenCalledTimes(1);
      expect(mocks.createStatus).toHaveBeenCalledTimes(6);
      const operationId = (mocks.createOrder.mock.calls[0]?.[0] as CreateOrderInput).operation_id;
      expect(operationId).toEqual(expect.any(String));
      for (const call of mocks.createStatus.mock.calls) {
        expect(call).toEqual([operationId, { timeoutMs: 8_000 }]);
      }
      expect(
        screen.getByText(translateMessage(locale, "orders2b1.new.recovery.uncertain")),
      ).toBeVisible();
      expect(
        screen.getAllByText(translateMessage(locale, "orders2b1.new.recovery.uncertainHelp")),
      ).not.toHaveLength(0);
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.new.recovery.uncertain"),
      );

      mocks.createStatus.mockResolvedValueOnce({ status: "created", id: "order-recovered-1" });
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", {
            name: translateMessage(locale, "orders2b1.new.recovery.retry"),
          }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mocks.createStatus).toHaveBeenCalledTimes(7);
      expect(mocks.createStatus.mock.calls[6]).toEqual([operationId, { timeoutMs: 8_000 }]);
      expect(mocks.createOrder).toHaveBeenCalledTimes(1);
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.new.toast.createdConfirmed"),
      );
      expect(onCreated).toHaveBeenCalledWith("order-recovered-1");
    },
  );

  it.each(locales)("completes localized dirty-leave save and discard in %s", async (locale) => {
    mocks.isCurrentDraftDirty.mockReturnValue(true);
    render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    const guard = latestNavigationGuard();
    expect(guard.label()).toBe(translateMessage(locale, "orders2b1.new.shortTitle"));
    expect(guard.isDirty()).toBe(true);
    expect(guard.canSave()).toBe(true);
    let saveResult: { status: string } | undefined;
    await act(async () => {
      saveResult = await guard.save();
    });
    expect(saveResult).toEqual({ status: "resolved" });
    expect(mocks.saveNow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Populate customer" }));
    expect(screen.getByTestId("customer-state")).toHaveTextContent("动态中文客户");
    let discardResult: { status: string } | undefined;
    await act(async () => {
      discardResult = await guard.discard();
    });
    expect(discardResult).toEqual({ status: "resolved" });
    expect(mocks.discardCurrentDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("customer-state")).toBeEmptyDOMElement();
  });

  it.each(locales)("maps unknown Create failures to safe localized copy in %s", async (locale) => {
    mocks.createOrder.mockRejectedValueOnce(new Error("SERVER_SECRET_CREATE_FAILURE"));
    const view = render(
      <LocaleProvider initialLocale={locale}>
        <NewOrderScreen />
      </LocaleProvider>,
    );
    populateValidForm();
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.new.error.generic"),
      ),
    );
    expect(mocks.toastError).not.toHaveBeenCalledWith("SERVER_SECRET_CREATE_FAILURE");
  });

  it.each(locales)(
    "renders pending lock and registers dirty-leave blocking behavior in %s",
    async (locale) => {
      mocks.mutationPending = true;
      mocks.isCurrentDraftDirty.mockReturnValue(true);
      render(
        <LocaleProvider initialLocale={locale}>
          <NewOrderScreen />
        </LocaleProvider>,
      );
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.new.processing") }),
      ).toBeDisabled();
      const calls = mocks.registerGuard.mock.calls as unknown as Array<
        [
          {
            isDirty: () => boolean;
            isBusy: () => boolean;
            discard: () => Promise<{ status: string }>;
          },
        ]
      >;
      const guard = calls.at(-1)?.[0];
      expect(guard).toBeDefined();
      if (!guard) throw new Error("navigation guard was not registered");
      expect(guard.isDirty()).toBe(true);
      expect(guard.isBusy()).toBe(true);
      await expect(guard.discard()).resolves.toEqual({ status: "blocked" });
    },
  );
});

function populateValidForm() {
  fireEvent.click(screen.getByRole("button", { name: "Populate customer" }));
  fireEvent.click(screen.getByRole("button", { name: "Populate device" }));
  fireEvent.click(screen.getByRole("button", { name: "Populate quote" }));
}

function latestNavigationGuard() {
  type Guard = {
    label: () => string;
    isDirty: () => boolean;
    canSave: () => boolean;
    save: () => Promise<{ status: string }>;
    discard: () => Promise<{ status: string }>;
  };
  const calls = mocks.registerGuard.mock.calls as unknown as Array<[Guard]>;
  const guard = calls.at(-1)?.[0];
  if (!guard) throw new Error("navigation guard was not registered");
  return guard;
}

function restoredCanonicalForm(): NewOrderFormState {
  return {
    type: "quick_repair",
    status: "new",
    customerName: "草稿动态客户",
    customerPhone: "+393330002222",
    brand: "小米",
    model: "自定义型号",
    imei: "",
    deviceNotes: "",
    deviceCustodyStatus: "with_shop",
    deviceUnlock: { method: "none" },
    internalTag: "",
    accessoryNotes: "自定义附件",
    warrantyText: "6个月",
    warrantyMonths: 6,
    warrantyChangeReason: "",
    deposit: 0,
    faults: [],
  };
}
