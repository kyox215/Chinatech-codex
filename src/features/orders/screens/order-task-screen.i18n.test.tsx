import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fallbackOrderWorkflowStatuses } from "@/features/orders/model/order-workflow";
import { orders } from "@/lib/mock/fixtures";
import type {
  FaultPriceItem,
  KioskSessionCreateInput,
  PatchOrderInput,
  PublishOrderQuoteInput,
} from "@/lib/repairdesk/types";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

type MutationOptions = {
  mutationFn: (input?: unknown) => Promise<unknown> | unknown;
  onSuccess?: (value: unknown) => void | Promise<void>;
  onError?: (error: Error) => void;
};

const taskOrder = {
  ...orders[0]!,
  status: "repairing" as const,
  workflow_status: "repair" as const,
  customer_name: "动态中文客户",
  customer_phone: "+393335719865",
  device_label: "华为 Mate 自定义",
  device_imei: "490154203237518",
  issue_description: "动态故障描述",
  diagnosis_result: "动态检测结论",
  accessory_notes: "SIM卡，原装盒",
  fault_prices: [
    {
      line_id: "00000000-0000-4000-8000-000000000211",
      catalog_key: "display:original",
      name: "原装屏幕",
      price: 120,
      currency_code: "EUR" as const,
      note: "客户自定义备注",
    },
  ],
  device_custody_status: "with_shop" as const,
  finance_redacted: false,
  approval_overdue: false,
  pickup_overdue: false,
  record_state: "active" as const,
  approval_status: "approved" as const,
  approval_flow_status: "approved" as const,
};

const mocks = vi.hoisted(() => ({
  transitionOrder: vi.fn(),
  patchOrder: vi.fn(),
  publishOrderQuote: vi.fn(),
  createKioskSession: vi.fn(),
  mutatePending: false,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  query: {
    isLoading: false,
    isError: false,
    error: null as Error | null,
    order: null as typeof taskOrder | null,
    financeRedacted: false,
    capabilities: {
      canTransition: true,
      canEditRepair: true,
      canPrepareQuote: true,
      canCreateKioskSession: true,
    },
    kioskDevices: [{ id: "kiosk-1", label: "iPad 前台", status: "active" }] as Array<{
      id: string;
      label: string;
      status: string;
    }>,
    transitions: [
      {
        id: "transition-mail",
        store_id: "store-1",
        from_status_code: "repairing",
        to_status_code: "mail_in_progress",
        enabled: true,
        is_primary: true,
        sort_order: 10,
        created_at: "",
        updated_at: "",
      },
    ],
  },
  refetch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => ({ activeStore: { id: "store-1" } }),
}));
vi.mock("@/features/orders/print/use-fixed-order-pdf-print", () => ({
  useFixedOrderPdfPrint: () => ({
    requestPrint: vi.fn(),
    preparedPdf: null,
    generationPending: false,
    deliveryPending: false,
    deliveryError: null,
    dismissPreparedPdf: vi.fn(),
    sharePreparedPdf: vi.fn(),
    openPreparedPdf: vi.fn(),
    downloadPreparedPdf: vi.fn(),
  }),
}));
vi.mock("@/features/orders/components/repair-order-print-sheet", () => ({
  RepairOrderPrintSheet: () => null,
  canPrintRepairOrderCustomerDocument: () => false,
}));
vi.mock("@/features/orders/components/order-print-paper-dialog", () => ({
  OrderPrintPaperDialog: () => null,
  readOrderPrintPaperMode: () => "a5-landscape",
  rememberOrderPrintPaperMode: vi.fn(),
}));
vi.mock("@/features/orders/components/fixed-pdf-ready-dialog", () => ({
  FixedPdfReadyDialog: () => null,
}));
vi.mock("@/components/orders/diagnosis-quote-dialog", () => ({
  DiagnosisQuoteDialog: ({
    open,
    isPending,
    onSaveDiagnosis,
    onPublish,
  }: {
    open: boolean;
    isPending: boolean;
    onSaveDiagnosis: (value: string) => Promise<unknown>;
    onPublish: (input: {
      idempotencyKey: string;
      diagnosisResult: string;
      faultPrices: FaultPriceItem[];
    }) => Promise<unknown>;
  }) =>
    open ? (
      <div data-testid="diagnosis-harness">
        <button
          type="button"
          disabled={isPending}
          onClick={() => void onSaveDiagnosis("动态中文诊断").catch(() => undefined)}
        >
          Harness save diagnosis
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            void onPublish({
              idempotencyKey: "quote-idempotency-stable",
              diagnosisResult: "动态中文诊断",
              faultPrices: [
                {
                  line_id: "00000000-0000-4000-8000-000000000212",
                  catalog_key: "display:original",
                  name: "原装屏幕",
                  price: 160,
                  currency_code: "EUR",
                  note: "自定义报价备注",
                },
              ],
            }).catch(() => undefined)
          }
        >
          Harness publish quote
        </button>
      </div>
    ) : null,
}));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  return {
    ...actual,
    transitionOrder: mocks.transitionOrder,
    patchOrder: mocks.patchOrder,
    publishOrderQuote: mocks.publishOrderQuote,
    createKioskSession: mocks.createKioskSession,
  };
});
vi.mock("@tanstack/react-query", () => ({
  queryOptions: <T,>(options: T) => options,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: (options: MutationOptions) => ({
    mutate: (input?: unknown) => {
      void Promise.resolve()
        .then(() => options.mutationFn(input))
        .then(options.onSuccess, options.onError);
    },
    mutateAsync: async (input?: unknown) => {
      try {
        const value = await options.mutationFn(input);
        await options.onSuccess?.(value);
        return value;
      } catch (error) {
        options.onError?.(error as Error);
        throw error;
      }
    },
    isPending: mocks.mutatePending,
  }),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const key = JSON.stringify(queryKey);
    if (key.includes('"orders","detail"')) {
      return {
        data: mocks.query.order
          ? {
              order: { ...mocks.query.order, finance_redacted: mocks.query.financeRedacted },
              capabilities: mocks.query.capabilities,
            }
          : undefined,
        isLoading: mocks.query.isLoading,
        isError: mocks.query.isError,
        error: mocks.query.error,
        refetch: mocks.refetch,
      };
    }
    if (key.includes('"orders","workflow"')) {
      return {
        data: {
          statuses: fallbackOrderWorkflowStatuses,
          transitions: mocks.query.transitions,
        },
      };
    }
    if (key.includes('"kiosk","devices"') && key.includes('"available"')) {
      return { data: mocks.query.kioskDevices };
    }
    if (key.includes("store-settings")) return { data: {} };
    return { data: undefined };
  },
}));

import { OrderTaskScreen } from "@/features/orders/screens/order-task-screen";

const locales = ["zh-CN", "it-IT", "en"] as const;

describe("OrderTaskScreen i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transitionOrder.mockResolvedValue({ ok: true });
    mocks.patchOrder.mockResolvedValue({ ok: true, updated_at: "2026-09-02T10:01:00Z" });
    mocks.publishOrderQuote.mockResolvedValue({ ok: true });
    mocks.createKioskSession.mockResolvedValue({
      id: "session-1",
      device: { label: "iPad 前台" },
    });
    mocks.mutatePending = false;
    Object.assign(mocks.query, {
      isLoading: false,
      isError: false,
      error: null,
      order: taskOrder,
      financeRedacted: false,
      capabilities: {
        canTransition: true,
        canEditRepair: true,
        canPrepareQuote: true,
        canCreateKioskSession: true,
      },
      kioskDevices: [{ id: "kiosk-1", label: "iPad 前台", status: "active" }],
      transitions: [
        {
          id: "transition-mail",
          store_id: "store-1",
          from_status_code: "repairing",
          to_status_code: "mail_in_progress",
          enabled: true,
          is_primary: true,
          sort_order: 10,
          created_at: "",
          updated_at: "",
        },
      ],
    });
  });

  it.each([
    ["zh-CN", "任务工作台", "任务信息"],
    ["it-IT", "Area attività", "Informazioni attività"],
    ["en", "Task workspace", "Task information"],
  ] as const)(
    "localizes fixed task chrome in %s and preserves dynamic data",
    (locale, title, info) => {
      renderTask(locale);
      expect(screen.getByText(title)).toBeVisible();
      expect(screen.getByText(info)).toBeVisible();
      expect(screen.getByText(taskOrder.customer_name)).toBeVisible();
      expect(screen.getByText(taskOrder.issue_description)).toBeVisible();
      expect(screen.getByText("华为 Mate 自定义")).toBeVisible();
      expect(mocks.transitionOrder).not.toHaveBeenCalled();
    },
  );

  it("submits deep-equivalent Transition, Diagnosis Patch, Quote Publish and Kiosk inputs", async () => {
    const perLocale: Array<{
      transition: unknown[];
      patch: unknown[];
      quote: unknown[];
      kiosk: unknown[];
    }> = [];

    for (const locale of locales) {
      const view = renderTask(locale);
      fireEvent.click(screen.getByRole("button", { name: advancePattern(locale) }));
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.confirmTransition"),
        }),
      );
      await waitFor(() => expect(mocks.transitionOrder).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", {
            name: translateMessage(locale, "orders2b1.task.transitionTitle"),
          }),
        ).not.toBeInTheDocument(),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.diagnoseQuote"),
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness save diagnosis" }));
      await waitFor(() => expect(mocks.patchOrder).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "Harness publish quote" }));
      await waitFor(() => expect(mocks.publishOrderQuote).toHaveBeenCalledTimes(1));
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.sendKiosk"),
        }),
      );

      await waitFor(() => expect(mocks.createKioskSession).toHaveBeenCalledTimes(1));
      perLocale.push({
        transition: structuredClone(mocks.transitionOrder.mock.calls[0]!),
        patch: structuredClone(mocks.patchOrder.mock.calls[0]!),
        quote: structuredClone(mocks.publishOrderQuote.mock.calls[0]!),
        kiosk: structuredClone(mocks.createKioskSession.mock.calls[0]!),
      });
      vi.clearAllMocks();
      view.unmount();
    }

    const normalized = perLocale.map((entry) => ({
      ...entry,
      transition: [
        entry.transition[0],
        entry.transition[1],
        { ...(entry.transition[2] as Record<string, unknown>), idempotencyKey: "<uuid>" },
      ],
    }));
    expect(normalized[1]).toEqual(normalized[0]);
    expect(normalized[2]).toEqual(normalized[0]);
    expect(normalized[0]).toMatchObject({
      transition: [
        taskOrder.id,
        "mail_in_progress",
        {
          reason: "门店检测后判断需要主板级外修，已报价并准备寄给外部维修方处理。",
          expectedUpdatedAt: taskOrder.updated_at,
        },
      ],
      patch: [
        taskOrder.id,
        {
          expected_updated_at: taskOrder.updated_at,
          changes: { diagnosis_result: "动态中文诊断" },
        },
      ],
      quote: [
        taskOrder.id,
        {
          expected_updated_at: taskOrder.updated_at,
          idempotency_key: "quote-idempotency-stable",
          diagnosis_result: "动态中文诊断",
          fault_prices: [
            {
              line_id: "00000000-0000-4000-8000-000000000212",
              catalog_key: "display:original",
              name: "原装屏幕",
              price: 160,
              currency_code: "EUR",
              note: "自定义报价备注",
            },
          ],
        },
      ],
      kiosk: [
        {
          device_id: "kiosk-1",
          order_id: taskOrder.id,
          session_type: "pickup_signature",
          expires_in_minutes: 30,
          request_payload: { source: "order_task", order_public_no: taskOrder.public_no },
        },
      ],
    });
  });

  it.each(locales)("renders loading, not-found and read-error states in %s", (locale) => {
    mocks.query.isLoading = true;
    mocks.query.order = null;
    const loading = renderTask(locale);
    expect(loading.container.querySelector('[data-order-task-root="true"]')).toBeTruthy();
    loading.unmount();

    mocks.query.isLoading = false;
    mocks.query.isError = true;
    mocks.query.error = new RepairDeskApiError("secret missing detail", 404);
    const missing = renderTask(locale);
    expect(screen.getByText(translateMessage(locale, "orders2b1.task.notFound"))).toBeVisible();
    expect(screen.queryByText("secret missing detail")).not.toBeInTheDocument();
    missing.unmount();

    mocks.query.error = new RepairDeskApiError("SERVER_SECRET_READ", 500);
    renderTask(locale);
    expect(screen.getByText(translateMessage(locale, "orders2b1.task.loadFailed"))).toBeVisible();
    expect(screen.queryByText("SERVER_SECRET_READ")).not.toBeInTheDocument();
  });

  it.each(locales)("covers finance redaction and permission combinations in %s", (locale) => {
    mocks.query.financeRedacted = true;
    mocks.query.capabilities = {
      canTransition: false,
      canEditRepair: false,
      canPrepareQuote: false,
      canCreateKioskSession: false,
    };
    renderTask(locale);
    expect(
      screen.getByText(translateMessage(locale, "orders2b1.task.financeRestricted")),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: translateMessage(locale, "orders2b1.task.diagnoseQuote"),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: translateMessage(locale, "orders2b1.task.sendKiosk") }),
    ).not.toBeInTheDocument();
  });

  it.each(locales)(
    "covers Kiosk unavailable, pending, success and safe error in %s",
    async (locale) => {
      mocks.query.kioskDevices = [];
      const unavailable = renderTask(locale);
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.task.noKiosk") }),
      ).toBeDisabled();
      unavailable.unmount();

      mocks.query.kioskDevices = [{ id: "kiosk-1", label: "iPad 前台", status: "active" }];
      mocks.mutatePending = true;
      const pending = renderTask(locale);
      expect(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.task.sending") }),
      ).toBeDisabled();
      pending.unmount();

      mocks.mutatePending = false;
      const success = renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.task.sendKiosk") }),
      );
      await waitFor(() => expect(mocks.createKioskSession).toHaveBeenCalledTimes(1));
      expect(mocks.createKioskSession).toHaveBeenCalledWith({
        device_id: "kiosk-1",
        order_id: taskOrder.id,
        session_type: "pickup_signature",
        expires_in_minutes: 30,
        request_payload: { source: "order_task", order_public_no: taskOrder.public_no },
      } satisfies KioskSessionCreateInput);
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.task.kioskSent", { device: "iPad 前台" }),
      );
      success.unmount();

      mocks.createKioskSession.mockClear();
      mocks.toastSuccess.mockClear();
      mocks.createKioskSession.mockRejectedValueOnce(new Error("SERVER_SECRET_KIOSK"));
      renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b1.task.sendKiosk") }),
      );
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b1.task.actionFailed"),
        ),
      );
      expect(mocks.toastError).not.toHaveBeenCalledWith("SERVER_SECRET_KIOSK");
    },
  );

  it.each(locales)(
    "covers diagnosis pending, canonical success and safe localized error in %s",
    async (locale) => {
      mocks.query.capabilities.canPrepareQuote = false;
      mocks.mutatePending = true;
      const pending = renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.recordDiagnosis"),
        }),
      );
      expect(screen.getByRole("button", { name: "Harness save diagnosis" })).toBeDisabled();
      pending.unmount();

      mocks.mutatePending = false;
      const success = renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.recordDiagnosis"),
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness save diagnosis" }));
      await waitFor(() => expect(mocks.patchOrder).toHaveBeenCalledTimes(1));
      expect(mocks.patchOrder).toHaveBeenCalledWith(taskOrder.id, {
        expected_updated_at: taskOrder.updated_at,
        changes: { diagnosis_result: "动态中文诊断" },
      } satisfies PatchOrderInput);
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.task.diagnosisSuccess"),
      );
      success.unmount();

      mocks.patchOrder.mockClear();
      mocks.toastSuccess.mockClear();
      mocks.patchOrder.mockRejectedValueOnce(new Error("SERVER_SECRET_DIAGNOSIS"));
      renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.recordDiagnosis"),
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness save diagnosis" }));
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b1.task.actionFailed"),
        ),
      );
      expect(screen.queryByText("SERVER_SECRET_DIAGNOSIS")).not.toBeInTheDocument();
    },
  );

  it.each(locales)(
    "covers quote pending, canonical success and safe localized error in %s",
    async (locale) => {
      mocks.mutatePending = true;
      const pending = renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.diagnoseQuote"),
        }),
      );
      expect(screen.getByRole("button", { name: "Harness publish quote" })).toBeDisabled();
      pending.unmount();

      mocks.mutatePending = false;
      const success = renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.diagnoseQuote"),
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness publish quote" }));
      await waitFor(() => expect(mocks.publishOrderQuote).toHaveBeenCalledTimes(1));
      expect(mocks.publishOrderQuote).toHaveBeenCalledWith(taskOrder.id, {
        expected_updated_at: taskOrder.updated_at,
        idempotency_key: "quote-idempotency-stable",
        diagnosis_result: "动态中文诊断",
        fault_prices: [
          {
            line_id: "00000000-0000-4000-8000-000000000212",
            catalog_key: "display:original",
            name: "原装屏幕",
            price: 160,
            currency_code: "EUR",
            note: "自定义报价备注",
          },
        ],
      } satisfies PublishOrderQuoteInput);
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.task.quoteSuccess"),
      );
      success.unmount();

      mocks.publishOrderQuote.mockClear();
      mocks.toastSuccess.mockClear();
      mocks.publishOrderQuote.mockRejectedValueOnce(new Error("SERVER_SECRET_QUOTE"));
      renderTask(locale);
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.diagnoseQuote"),
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness publish quote" }));
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b1.task.actionFailed"),
        ),
      );
      expect(screen.queryByText("SERVER_SECRET_QUOTE")).not.toBeInTheDocument();
    },
  );

  it.each(locales)("submits an optional canonical transition reason in %s", async (locale) => {
    mocks.query.transitions = [
      {
        ...mocks.query.transitions[0]!,
        id: "transition-approval",
        to_status_code: "waiting_approval",
      },
    ];
    renderTask(locale);
    fireEvent.click(screen.getByRole("button", { name: advancePattern(locale) }));
    const dialog = screen.getByRole("dialog", {
      name: translateMessage(locale, "orders2b1.task.transitionTitle"),
    });
    const note = within(dialog).getByPlaceholderText(
      translateMessage(locale, "orders2b1.transition.optionalNote"),
    );
    fireEvent.change(note, { target: { value: "动态可选处理说明" } });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: translateMessage(locale, "orders2b1.task.confirmTransition"),
      }),
    );
    await waitFor(() => expect(mocks.transitionOrder).toHaveBeenCalledTimes(1));
    expect(mocks.transitionOrder).toHaveBeenCalledWith(taskOrder.id, "waiting_approval", {
      reason: "动态可选处理说明",
      expectedUpdatedAt: taskOrder.updated_at,
      idempotencyKey: expect.any(String),
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      translateMessage(locale, "orders2b1.task.transitionSuccess"),
    );
  });

  it.each(locales)("blocks a required transition after its reason is cleared in %s", (locale) => {
    renderTask(locale);
    fireEvent.click(screen.getByRole("button", { name: advancePattern(locale) }));
    const dialog = screen.getByRole("dialog", {
      name: translateMessage(locale, "orders2b1.task.transitionTitle"),
    });
    expect(
      within(dialog).getByText(translateMessage(locale, "orders2b1.transition.reasonRequired")),
    ).toBeVisible();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "" } });
    expect(
      within(dialog).getByRole("button", {
        name: translateMessage(locale, "orders2b1.task.confirmTransition"),
      }),
    ).toBeDisabled();
    expect(mocks.transitionOrder).not.toHaveBeenCalled();
  });

  it.each(locales)(
    "shows safe localized transition conflict and generic error before succeeding in %s",
    async (locale) => {
      mocks.transitionOrder.mockRejectedValueOnce(
        new RepairDeskApiError("SERVER_SECRET_CONFLICT", 409, "ORDER_WRITE_CONFLICT"),
      );
      renderTask(locale);
      fireEvent.click(screen.getByRole("button", { name: advancePattern(locale) }));
      const dialog = screen.getByRole("dialog", {
        name: translateMessage(locale, "orders2b1.task.transitionTitle"),
      });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.confirmTransition"),
        }),
      );
      await waitFor(() => expect(mocks.transitionOrder).toHaveBeenCalledTimes(1));
      expectCanonicalRequiredTransitionCall();
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.task.actionFailed"),
      );
      expect(screen.queryByText("SERVER_SECRET_CONFLICT")).not.toBeInTheDocument();

      mocks.transitionOrder.mockClear();
      mocks.toastError.mockClear();
      mocks.transitionOrder.mockRejectedValueOnce(new Error("SERVER_SECRET_TRANSITION"));
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.confirmTransition"),
        }),
      );
      await waitFor(() => expect(mocks.transitionOrder).toHaveBeenCalledTimes(1));
      expectCanonicalRequiredTransitionCall();
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.task.actionFailed"),
      );
      expect(screen.queryByText("SERVER_SECRET_TRANSITION")).not.toBeInTheDocument();

      mocks.transitionOrder.mockClear();
      mocks.toastError.mockClear();
      mocks.transitionOrder.mockResolvedValueOnce({ ok: true });
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: translateMessage(locale, "orders2b1.task.confirmTransition"),
        }),
      );
      await waitFor(() => expect(mocks.transitionOrder).toHaveBeenCalledTimes(1));
      expectCanonicalRequiredTransitionCall();
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b1.task.transitionSuccess"),
      );
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
    },
  );
});

function renderTask(locale: (typeof locales)[number]) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <OrderTaskScreen id={taskOrder.id} />
    </LocaleProvider>,
  );
}

function advancePattern(locale: (typeof locales)[number]) {
  if (locale === "zh-CN") return /^推进至/;
  if (locale === "it-IT") return /^Avanza a/;
  return /^Advance to/;
}

function expectCanonicalRequiredTransitionCall() {
  expect(mocks.transitionOrder).toHaveBeenCalledWith(taskOrder.id, "mail_in_progress", {
    reason: "门店检测后判断需要主板级外修，已报价并准备寄给外部维修方处理。",
    expectedUpdatedAt: taskOrder.updated_at,
    idempotencyKey: expect.any(String),
  });
}
