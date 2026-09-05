import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatOrderDateTime } from "@/features/orders/model/order-date";
import { fallbackOrderWorkflowStatuses } from "@/features/orders/model/order-workflow";
import { orders } from "@/lib/mock/fixtures";
import type { FinanceDraftState } from "@/features/orders/model/order-finance-draft";
import type { UpdateOrderInput } from "@/lib/repairdesk/api";
import type { RepairDeskOptions } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}

type MutationOptions = {
  mutationFn: (input?: unknown) => Promise<unknown> | unknown;
  onSuccess?: (value: unknown, input?: unknown) => void | Promise<void>;
  onError?: (error: unknown, input?: unknown) => void | Promise<void>;
};

const detailOrder = {
  ...orders[0]!,
  status: "repairing" as const,
  workflow_status: "repair" as const,
  customer_name: "动态中文客户",
  customer_name_snapshot: "动态中文客户",
  customer_phone: "+393335719865",
  contact_phones: ["+393335719865"],
  device_label: "华为 Mate 自定义",
  device_snapshot: {
    brand: "华为",
    model: "Mate 自定义",
    serial_or_imei: "490154203237518",
    device_notes: "动态设备备注",
  },
  issue_description: "动态故障描述",
  diagnosis_result: "动态检测结论",
  accessory_notes: "SIM卡，原装盒",
  fault_prices: [
    {
      line_id: "00000000-0000-4000-8000-000000000221",
      catalog_key: "display:original",
      name: "原装屏幕",
      price: 120,
      currency_code: "EUR" as const,
      note: "客户自定义备注",
    },
  ],
  quotation_amount: 120,
  deposit_amount: 10,
  balance_amount: 110,
  device_custody_status: "with_shop" as const,
  finance_redacted: false,
  approval_overdue: false,
  pickup_overdue: false,
  record_state: "active" as const,
  created_at: "2026-09-02T08:15:00.000Z",
  updated_at: "2026-09-02T10:01:00.000Z",
};

const mocks = vi.hoisted(() => ({
  patchOrder: vi.fn(),
  patchOrderFinance: vi.fn(),
  transitionOrder: vi.fn(),
  updateOrderCustody: vi.fn(),
  confirmCancelledOrderReturn: vi.fn(),
  decideOrderApproval: vi.fn(),
  uploadOrderAttachment: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  detail: null as Record<string, unknown> | null,
  queryError: null as unknown,
  loading: false,
  refetch: vi.fn(),
  mutatePending: false,
  repairDeskOptions: null as RepairDeskOptions | null,
  viewport: "desktop" as "desktop" | "compact",
  shellStatus: "ready" as "ready" | "error" | "platform_admin" | "onboarding_required",
  activeStore: { id: "store-1", name: "动态中文门店", role: "owner" } as
    | { id: string; name: string; role: string }
    | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess, info: vi.fn() },
}));
vi.mock("@/hooks/use-mobile", () => ({ useViewportMode: () => mocks.viewport }));
vi.mock("@/features/orders/screens/order-detail-body-state", () => ({
  registerOrderDetailBodyOwner: () => () => undefined,
  updateOrderDetailBodyOwner: vi.fn(),
}));
vi.mock("@/features/capture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/capture")>();
  return {
    ...actual,
    CameraCaptureSheet: ({
      open,
      onCapture,
      onOpenChange,
    }: {
      open: boolean;
      onCapture: (draft: {
        id: string;
        kind: "fault_photo";
        file: File;
        previewUrl: string;
        name: string;
        size: number;
        mimeType: string;
        createdAt: string;
      }) => void;
      onOpenChange: (open: boolean) => void;
    }) => (
      <div data-testid="camera-capture-sheet">
        {open ? (
          <button
            type="button"
            onClick={() => {
              const file = new File(["x"], "dynamic-photo.jpg", { type: "image/jpeg" });
              onCapture({
                id: "attachment-draft",
                kind: "fault_photo",
                file,
                previewUrl: "blob:dynamic-photo",
                name: file.name,
                size: file.size,
                mimeType: file.type,
                createdAt: "2026-09-02T10:00:00.000Z",
              });
              onOpenChange(false);
            }}
          >
            Harness capture photo
          </button>
        ) : null}
      </div>
    ),
  };
});
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => ({
    status: mocks.shellStatus,
    userId: "user-1",
    activeStore: mocks.activeStore,
    statusLabel: "STORE_SHELL_DYNAMIC_TITLE",
    statusDescription: "STORE_SHELL_DYNAMIC_DESCRIPTION",
    retry: vi.fn(),
  }),
}));
vi.mock("@/entities/store/model/store-output-identity", () => ({
  resolveStoreOutputIdentity: () => ({ storeName: "动态中文门店" }),
  buildStoreCustomerOutputUrl: () => "https://example.invalid/order",
}));
vi.mock("@/features/orders/api/use-edit-order-offline-autosave", () => ({
  useEditOrderOfflineAutosave: () => ({
    state: "idle",
    errorMessage: null,
    lastSavedAt: null,
    draftPrompt: null,
    pendingRestoreNotice: null,
    hasSensitiveUnlockDraft: false,
    restorePromptDraft: vi.fn(),
    discardPromptDraft: vi.fn(),
    discardCurrentDraft: vi.fn().mockResolvedValue(true),
    saveDraftSnapshot: vi.fn().mockResolvedValue(true),
  }),
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
vi.mock("@/features/orders/components/order-terminal-actions", () => ({
  OrderTerminalActions: () => null,
}));
vi.mock("@/components/orders/diagnosis-quote-dialog", () => ({
  DiagnosisQuoteDialog: () => null,
}));
vi.mock("@/features/orders/forms/cancel-dialog", () => ({ CancelDialog: () => null }));
vi.mock("@/features/orders/forms/notify-dialog", () => ({ NotifyDialog: () => null }));
vi.mock("@/features/orders/forms/payment-dialog", () => ({ PaymentDialog: () => null }));
vi.mock("@/features/orders/components/order-overview-tab", () => ({
  OrderDetailActionDock: ({
    onFlow,
    onApprovalDecision,
  }: {
    onFlow: () => void;
    onApprovalDecision: () => void;
  }) => (
    <>
      <button type="button" onClick={onFlow}>
        Harness flow
      </button>
      <button type="button" onClick={onApprovalDecision}>
        Harness approval
      </button>
    </>
  ),
  OrderDetailHeaderFinanceSummary: () => null,
  OrderKeyInfoCard: () => null,
  DesktopOrderPhotosPanel: ({
    onCapture,
  }: {
    onCapture?: (kind: "other", trigger: HTMLButtonElement) => void;
  }) =>
    onCapture ? (
      <button type="button" onClick={(event) => onCapture("other", event.currentTarget)}>
        Harness photos panel capture
      </button>
    ) : null,
  OrderOverviewTab: ({
    order,
    isEditing,
    editDraft,
    onEditDraftChange,
    onFinanceDraftChange,
    custodyControl,
    onPhotoCapture,
  }: {
    order: typeof detailOrder;
    isEditing: boolean;
    editDraft?: UpdateOrderInput;
    onEditDraftChange?: (draft: UpdateOrderInput) => void;
    onFinanceDraftChange?: (draft: FinanceDraftState) => void;
    custodyControl?: ReactNode;
    onPhotoCapture?: (kind: "other", trigger: HTMLButtonElement) => void;
  }) => (
    <div>
      <span>{order.customer_name}</span>
      <span>{order.device_label}</span>
      <span>{order.issue_description}</span>
      {custodyControl}
      {onPhotoCapture ? (
        <button type="button" onClick={(event) => onPhotoCapture("other", event.currentTarget)}>
          Harness open photo capture
        </button>
      ) : null}
      {isEditing && editDraft && onEditDraftChange && onFinanceDraftChange ? (
        <>
          <button
            type="button"
            onClick={() => {
              onEditDraftChange({ ...editDraft, customer_name: "动态中文客户改" });
              onFinanceDraftChange({
                faults: [
                  {
                    line_id: "00000000-0000-4000-8000-000000000221",
                    catalog_key: "display:original",
                    name: "原装屏幕",
                    priceText: "160",
                    note: "客户自定义备注",
                  },
                ],
                depositText: "20",
              });
            }}
          >
            Harness change canonical draft
          </button>
          <button
            type="button"
            onClick={() => onEditDraftChange({ ...editDraft, customer_name: "" })}
          >
            Harness invalidate customer
          </button>
        </>
      ) : null}
    </div>
  ),
}));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  return {
    ...actual,
    patchOrder: mocks.patchOrder,
    patchOrderFinance: mocks.patchOrderFinance,
    transitionOrder: mocks.transitionOrder,
    updateOrderCustody: mocks.updateOrderCustody,
    confirmCancelledOrderReturn: mocks.confirmCancelledOrderReturn,
    decideOrderApproval: mocks.decideOrderApproval,
    uploadOrderAttachment: mocks.uploadOrderAttachment,
  };
});
vi.mock("@tanstack/react-query", () => {
  const queryClient = {
    invalidateQueries: vi.fn(),
    getQueryData: () => mocks.detail,
    setQueriesData: vi.fn(),
  };
  return {
    queryOptions: <T,>(options: T) => options,
    useQueryClient: () => queryClient,
    useMutation: (options: MutationOptions) => ({
      mutate: (input?: unknown) => {
        void Promise.resolve(options.mutationFn(input)).then(
          (value) => options.onSuccess?.(value, input),
          (error) => options.onError?.(error, input),
        );
      },
      mutateAsync: async (input?: unknown) => {
        try {
          const value = await options.mutationFn(input);
          await options.onSuccess?.(value, input);
          return value;
        } catch (error) {
          await options.onError?.(error, input);
          throw error;
        }
      },
      isPending: mocks.mutatePending,
    }),
    useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const key = JSON.stringify(queryKey);
      if (key.includes('"orders","detail"')) {
        return {
          data: mocks.detail ?? undefined,
          error: mocks.queryError,
          isError: Boolean(mocks.queryError),
          isLoading: mocks.loading,
          isPending: mocks.loading,
          refetch: mocks.refetch,
        };
      }
      if (key.includes('"orders","workflow"')) {
        return {
          data: {
            statuses: fallbackOrderWorkflowStatuses,
            transitions: [
              {
                id: "transition-repaired",
                store_id: "store-1",
                from_status_code: "repairing",
                to_status_code: "repaired",
                enabled: true,
                is_primary: true,
                sort_order: 10,
                created_at: "",
                updated_at: "",
              },
            ],
          },
        };
      }
      if (key.includes('"repairdesk-options"')) {
        return {
          data: mocks.repairDeskOptions ?? {
            permissions: {
              canReadSuppliers: false,
              canAssignSuppliers: false,
              canManageSuppliers: false,
              canAssignOrders: false,
            },
            suppliers: [],
            assigneeOptions: [],
          },
        };
      }
      if (key.includes("store-settings")) return { data: {} };
      return { data: undefined };
    },
  };
});

import { OrderDetailScreen } from "@/features/orders/screens/order-detail-screen";

const locales = ["zh-CN", "it-IT", "en"] as const;

function makeDetail() {
  return {
    order: { ...detailOrder },
    customer: undefined,
    device: undefined,
    supplier: undefined,
    parts_supplier: undefined,
    events: [],
    messages: [],
    attachments: [],
    capabilities: {
      canEditIntake: true,
      canEditRepair: true,
      canAdjustFinance: true,
      canTransition: true,
      canCorrect: false,
      canCollectPayment: false,
      canCreateKioskSession: false,
      canUploadPhoto: true,
    },
  };
}

function makeRepairDeskOptions(
  permissions: Partial<RepairDeskOptions["permissions"]> = {},
): RepairDeskOptions {
  return {
    permissions: {
      canReadSuppliers: false,
      canAssignSuppliers: false,
      canManageSuppliers: false,
      canAssignOrders: false,
      ...permissions,
    },
    suppliers: [],
    technicians: [],
    assigneeOptions: [],
  };
}

function renderDetail(locale: (typeof locales)[number], surface: "dialog" | "page" = "dialog") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <OrderDetailScreen id={detailOrder.id} surface={surface} onClose={vi.fn()} />
    </LocaleProvider>,
  );
}

describe("OrderDetailScreen i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    mocks.detail = makeDetail();
    mocks.queryError = null;
    mocks.loading = false;
    mocks.mutatePending = false;
    mocks.repairDeskOptions = null;
    mocks.viewport = "desktop";
    mocks.shellStatus = "ready";
    mocks.activeStore = { id: "store-1", name: "动态中文门店", role: "owner" };
    mocks.patchOrder.mockResolvedValue({ updated_at: "2026-09-02T10:02:00.000Z" });
    mocks.patchOrderFinance.mockResolvedValue({ updated_at: "2026-09-02T10:03:00.000Z" });
    mocks.transitionOrder.mockResolvedValue({ updated_at: "2026-09-02T10:04:00.000Z" });
    mocks.updateOrderCustody.mockResolvedValue({ updated_at: "2026-09-02T10:05:00.000Z" });
    mocks.confirmCancelledOrderReturn.mockResolvedValue({
      updated_at: "2026-09-02T10:05:30.000Z",
    });
    mocks.decideOrderApproval.mockResolvedValue({
      decision: "approved",
      to: "repairing",
      updated_at: "2026-09-02T10:06:00.000Z",
    });
    mocks.uploadOrderAttachment.mockResolvedValue({});
  });

  it.each([
    ["zh-CN", "概览"],
    ["it-IT", "Panoramica"],
    ["en", "Overview"],
  ] as const)("renders localized core chrome and locale-aware Rome time in %s", (locale, tab) => {
    renderDetail(locale);
    expect(
      screen.getByRole("heading", {
        name: translateMessage(locale, "orders2b2.title"),
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: tab })).toBeVisible();
    expect(screen.getByText(detailOrder.customer_name)).toBeVisible();
    expect(screen.getByText(detailOrder.device_label)).toBeVisible();
    expect(screen.getByText(detailOrder.issue_description)).toBeVisible();
    const localizedDate = formatOrderDateTime(detailOrder.created_at, locale);
    expect(
      screen.getAllByText((_content, element) =>
        Boolean(element?.textContent?.includes(localizedDate)),
      ).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ["zh-CN", "门店保管"],
    ["it-IT", "In negozio"],
    ["en", "With shop"],
  ] as const)("localizes the with-shop custody badge in %s", (locale, label) => {
    const view = renderDetail(locale);
    const custody = view.container.querySelector<HTMLElement>('[data-order-device-custody="true"]');
    expect(custody).not.toBeNull();
    expect(within(custody!).getByText(label, { exact: true })).toBeVisible();
    if (locale !== "zh-CN") {
      expect(within(custody!).queryByText("门店保管", { exact: true })).not.toBeInTheDocument();
    }
  });

  it("keeps active shop custody compact and expands a customer-held conflict", () => {
    mocks.viewport = "compact";
    for (const workflowStatus of ["diagnosing", "repairing", "notified"] as const) {
      mocks.detail = {
        ...makeDetail(),
        order: {
          ...detailOrder,
          status: workflowStatus,
          workflow_status: workflowStatus,
          device_custody_status: "with_shop",
        },
      };
      const view = renderDetail("en", "page");
      const custody = view.container.querySelector<HTMLElement>(
        '[data-order-device-custody="true"]',
      );
      expect(custody).not.toBeNull();
      expect(custody).toHaveAttribute("data-order-custody-mode", "compact");
      view.unmount();
    }

    mocks.detail = {
      ...makeDetail(),
      order: {
        ...detailOrder,
        status: "diagnosing",
        workflow_status: "diagnosing",
        device_custody_status: "with_customer",
      },
    };
    const conflictView = renderDetail("en", "page");
    const conflict = conflictView.container.querySelector<HTMLElement>(
      '[data-order-device-custody="true"]',
    );
    expect(conflict).not.toBeNull();
    expect(conflict).toHaveAttribute("data-order-custody-mode", "expanded");
    expect(conflict).toHaveTextContent(
      translateMessage("en", "orders2b2.custody.conflictCustomer"),
    );
    conflictView.unmount();

    mocks.detail = {
      ...makeDetail(),
      order: {
        ...detailOrder,
        status: "completed",
        workflow_status: "done",
        device_custody_status: null,
      },
    };
    const unknownView = renderDetail("en", "page");
    const unknown = unknownView.container.querySelector<HTMLElement>(
      '[data-order-device-custody="true"]',
    );
    expect(unknown).not.toBeNull();
    expect(unknown).toHaveAttribute("data-order-custody-mode", "expanded");
    expect(unknown).toHaveTextContent(
      translateMessage("en", "orders2b2.custody.terminalNeedsManager"),
    );
    unknownView.unmount();
  });

  it("keeps cancelled-return canonical inputs locale-invariant across all locales", async () => {
    const calls: unknown[][] = [];

    for (const locale of locales) {
      const detail = makeDetail();
      mocks.detail = {
        ...detail,
        order: {
          ...detail.order,
          status: "cancelled",
          workflow_status: "cancelled",
          device_custody_status: "with_shop",
          delivered_at: null,
          record_state: "active",
        },
        capabilities: {
          ...detail.capabilities,
          canConfirmCancelledReturn: true,
        },
      };
      mocks.confirmCancelledOrderReturn.mockClear();
      const user = userEvent.setup();
      const view = renderDetail(locale);
      const custody = view.container.querySelector<HTMLElement>(
        '[data-order-device-custody="true"]',
      );
      expect(custody).not.toBeNull();
      expect(custody).toHaveAttribute("data-order-custody-mode", "expanded");

      await user.click(
        within(custody!).getByRole("button", {
          name: translateMessage(locale, "orders2b2.custody.confirmReturned"),
        }),
      );
      const overlay = await screen.findByRole("dialog", {
        name: translateMessage(locale, "orders2b2.custody.returnTitle"),
      });
      const confirm = within(overlay).getByRole("button", {
        name: translateMessage(locale, "orders2b2.custody.confirmReturn"),
      });
      expect(confirm).toBeVisible();
      await user.click(confirm);
      await waitFor(() => expect(mocks.confirmCancelledOrderReturn).toHaveBeenCalledOnce());
      calls.push(structuredClone(mocks.confirmCancelledOrderReturn.mock.calls[0]!));
      view.unmount();
    }

    for (const call of calls) {
      expect(call[2]).toEqual(expect.any(String));
      expect(call[2]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }
    expect(calls.map(([id, updatedAt]) => [id, updatedAt, "<uuid>"])).toEqual(
      locales.map(() => [detailOrder.id, detailOrder.updated_at, "<uuid>"]),
    );
  });

  it.each(locales)("renders the localized %s loading shell without writes", (locale) => {
    mocks.detail = null;
    mocks.loading = true;
    renderDetail(locale);
    expect(screen.getByText(translateMessage(locale, "orders2b2.loading"))).toBeVisible();
    expect(mocks.patchOrder).not.toHaveBeenCalled();
    expect(mocks.patchOrderFinance).not.toHaveBeenCalled();
  });

  it.each(locales)("keeps the %s finance-redacted viewer read-only", (locale) => {
    const detail = makeDetail();
    detail.order.finance_redacted = true;
    detail.capabilities.canEditIntake = false;
    detail.capabilities.canEditRepair = false;
    detail.capabilities.canAdjustFinance = false;
    mocks.detail = detail;
    renderDetail(locale);
    expect(
      screen.queryByRole("button", {
        name: translateMessage(locale, "orders2b2.hero.edit"),
      }),
    ).not.toBeInTheDocument();
    expect(mocks.patchOrder).not.toHaveBeenCalled();
    expect(mocks.patchOrderFinance).not.toHaveBeenCalled();
  });

  it.each(locales)(
    "makes zero supplier, assignee, finance and nested mutation requests without %s capabilities",
    (locale) => {
      const detail = makeDetail();
      detail.capabilities = {
        ...detail.capabilities,
        canEditIntake: false,
        canEditRepair: false,
        canAdjustFinance: false,
        canTransition: false,
        canCreateKioskSession: false,
      };
      mocks.detail = detail;
      const view = renderDetail(locale);
      fireEvent.click(
        screen.getByRole("tab", {
          name: translateMessage(locale, "orders2b2.tab.records", { count: 0 }),
        }),
      );

      expect(view.container.querySelector("[data-order-records-controls='true']")).toBeNull();
      expect(mocks.patchOrder).not.toHaveBeenCalled();
      expect(mocks.patchOrderFinance).not.toHaveBeenCalled();
      expect(mocks.transitionOrder).not.toHaveBeenCalled();
      expect(mocks.updateOrderCustody).not.toHaveBeenCalled();
      expect(mocks.decideOrderApproval).not.toHaveBeenCalled();
      expect(mocks.uploadOrderAttachment).not.toHaveBeenCalled();
    },
  );

  it("keeps localized supplier and assignee controls byte-equivalent at their production callbacks", async () => {
    const supplierId = "supplier-dynamic-id";
    const assigneeId = "membership-dynamic-id";
    const calls: unknown[][][] = [];

    for (const locale of locales) {
      const user = userEvent.setup();
      mocks.repairDeskOptions = {
        ...makeRepairDeskOptions({
          canReadSuppliers: true,
          canAssignSuppliers: true,
          canAssignOrders: true,
        }),
        suppliers: [
          {
            id: supplierId,
            name: "动态中文供应商",
            short_name: "动态供应商",
            color: "#123456",
          },
        ],
        assigneeOptions: [{ id: assigneeId, display_name: "动态中文负责人", role: "technician" }],
      };
      const view = renderDetail(locale);
      await user.click(
        screen.getByRole("tab", {
          name: translateMessage(locale, "orders2b2.tab.records", { count: 0 }),
        }),
      );

      const supplierCard = Array.from(
        view.container.querySelectorAll<HTMLElement>("[data-order-record-control-card='supplier']"),
      ).find((element) => !element.closest("[hidden]"));
      const assigneeCard = Array.from(
        view.container.querySelectorAll<HTMLElement>("[data-order-record-control-card='assignee']"),
      ).find((element) => !element.closest("[hidden]"));
      expect(supplierCard).not.toBeNull();
      expect(assigneeCard).not.toBeNull();
      expect(supplierCard).toHaveTextContent(translateMessage(locale, "orders2b2.supplier.label"));
      expect(assigneeCard).toHaveTextContent(
        translateMessage(locale, "orders2b2.overview.assignee"),
      );

      await user.click(
        within(supplierCard!).getByRole("button", {
          name: translateMessage(locale, "orders2b2.supplier.title"),
        }),
      );
      await user.click(await screen.findByRole("menuitem", { name: "动态中文供应商" }));
      await waitFor(() => expect(mocks.patchOrder).toHaveBeenCalledTimes(1));

      await user.click(within(assigneeCard!).getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: "动态中文负责人" }));
      await waitFor(() => expect(mocks.patchOrder).toHaveBeenCalledTimes(2));

      expect(mocks.patchOrder.mock.calls[0]).toEqual([
        detailOrder.id,
        {
          expected_updated_at: detailOrder.updated_at,
          changes: { parts_supplier_id: supplierId },
        },
      ]);
      expect(mocks.patchOrder.mock.calls[1]).toEqual([
        detailOrder.id,
        {
          expected_updated_at: detailOrder.updated_at,
          changes: { assignee_membership_id: assigneeId },
        },
      ]);
      calls.push(structuredClone(mocks.patchOrder.mock.calls));
      view.unmount();
      mocks.patchOrder.mockClear();
    }

    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toEqual(calls[0]);
  });

  it.each([
    {
      actor: "owner",
      role: "owner",
      canEditIntake: true,
      canEditRepair: true,
      canAdjustFinance: true,
      canAssignSuppliers: true,
      canAssignOrders: true,
      canUploadPhoto: true,
      editVisible: true,
      controlsVisible: true,
    },
    {
      actor: "manager",
      role: "manager",
      canEditIntake: true,
      canEditRepair: true,
      canAdjustFinance: true,
      canAssignSuppliers: false,
      canAssignOrders: true,
      canUploadPhoto: true,
      editVisible: true,
      controlsVisible: true,
    },
    {
      actor: "assigned technician",
      role: "technician",
      canEditIntake: false,
      canEditRepair: true,
      canAdjustFinance: false,
      canAssignSuppliers: false,
      canAssignOrders: false,
      canUploadPhoto: true,
      editVisible: true,
      controlsVisible: false,
    },
    {
      actor: "unassigned technician",
      role: "technician",
      canEditIntake: false,
      canEditRepair: false,
      canAdjustFinance: false,
      canAssignSuppliers: false,
      canAssignOrders: false,
      canUploadPhoto: false,
      editVisible: false,
      controlsVisible: false,
    },
    {
      actor: "sales",
      role: "sales",
      canEditIntake: true,
      canEditRepair: false,
      canAdjustFinance: false,
      canAssignSuppliers: false,
      canAssignOrders: false,
      canUploadPhoto: true,
      editVisible: true,
      controlsVisible: false,
    },
    {
      actor: "viewer",
      role: "viewer",
      canEditIntake: false,
      canEditRepair: false,
      canAdjustFinance: false,
      canAssignSuppliers: false,
      canAssignOrders: false,
      canUploadPhoto: false,
      editVisible: false,
      controlsVisible: false,
    },
  ])(
    "honors the projected $actor capability matrix without implicit requests",
    ({
      role,
      canEditIntake,
      canEditRepair,
      canAdjustFinance,
      canAssignSuppliers,
      canAssignOrders,
      canUploadPhoto,
      editVisible,
      controlsVisible,
    }) => {
      const detail = makeDetail();
      detail.capabilities = {
        ...detail.capabilities,
        canEditIntake,
        canEditRepair,
        canAdjustFinance,
        canUploadPhoto,
      };
      mocks.detail = detail;
      mocks.activeStore = { id: "store-1", name: "动态中文门店", role };
      mocks.repairDeskOptions = {
        ...makeRepairDeskOptions({
          canReadSuppliers: canAssignSuppliers,
          canAssignSuppliers,
          canAssignOrders,
        }),
        suppliers: canAssignSuppliers
          ? [
              {
                id: "supplier-matrix",
                name: "动态中文供应商",
                short_name: "动态供应商",
                color: "#123456",
              },
            ]
          : [],
        assigneeOptions: canAssignOrders
          ? [{ id: "membership-matrix", display_name: "动态中文负责人", role: "technician" }]
          : [],
      };
      const view = renderDetail("en");

      expect(
        Boolean(
          screen.queryByRole("button", { name: translateMessage("en", "orders2b2.hero.edit") }),
        ),
      ).toBe(editVisible);
      expect(Boolean(screen.queryByRole("button", { name: "Harness open photo capture" }))).toBe(
        canUploadPhoto,
      );
      expect(screen.queryAllByTestId("camera-capture-sheet")).toHaveLength(canUploadPhoto ? 1 : 0);
      fireEvent.click(
        screen.getByRole("tab", {
          name: translateMessage("en", "orders2b2.tab.photos", { count: 0 }),
        }),
      );
      expect(Boolean(screen.queryByRole("button", { name: "Harness photos panel capture" }))).toBe(
        canUploadPhoto,
      );
      fireEvent.click(
        screen.getByRole("tab", {
          name: translateMessage("en", "orders2b2.tab.records", { count: 0 }),
        }),
      );
      expect(Boolean(view.container.querySelector("[data-order-records-controls='true']"))).toBe(
        controlsVisible,
      );
      expect(mocks.patchOrder).not.toHaveBeenCalled();
      expect(mocks.patchOrderFinance).not.toHaveBeenCalled();
      expect(mocks.transitionOrder).not.toHaveBeenCalled();
      expect(mocks.updateOrderCustody).not.toHaveBeenCalled();
      expect(mocks.decideOrderApproval).not.toHaveBeenCalled();
      expect(mocks.uploadOrderAttachment).not.toHaveBeenCalled();
    },
  );

  it.each([
    { capability: true, expectedEntry: true },
    { capability: false, expectedEntry: false },
  ])(
    "gates the compact photo entry and Sheet mount with canUploadPhoto=$capability",
    ({ capability, expectedEntry }) => {
      const detail = makeDetail();
      detail.capabilities.canUploadPhoto = capability;
      mocks.detail = detail;
      mocks.viewport = "compact";
      renderDetail("en", "page");

      expect(
        Boolean(
          screen.queryAllByRole("button", {
            name: new RegExp(translateMessage("en", "orders2b2.overview.capture")),
          }).length > 0,
        ),
      ).toBe(expectedEntry);
      expect(screen.queryAllByTestId("camera-capture-sheet")).toHaveLength(expectedEntry ? 2 : 0);
      expect(mocks.uploadOrderAttachment).not.toHaveBeenCalled();
    },
  );

  it.each([
    { surface: "desktop", voided: false, expectedEntry: true },
    { surface: "compact", voided: false, expectedEntry: true },
    { surface: "desktop", voided: true, expectedEntry: false },
    { surface: "compact", voided: true, expectedEntry: false },
  ] as const)(
    "keeps $surface terminal photo entry at non-void=$expectedEntry and voided fail-closed",
    ({ surface, voided, expectedEntry }) => {
      const detail = makeDetail();
      detail.capabilities.canUploadPhoto = true;
      mocks.detail = {
        ...detail,
        order: {
          ...detailOrder,
          status: "completed",
          workflow_status: "closed",
          workflow_bucket: "done",
          record_state: voided ? "voided" : "active",
        },
      };
      mocks.viewport = surface;
      renderDetail("en", surface === "compact" ? "page" : "dialog");

      const entry =
        surface === "desktop"
          ? Boolean(screen.queryByRole("button", { name: "Harness open photo capture" }))
          : screen.queryAllByRole("button", {
              name: new RegExp(translateMessage("en", "orders2b2.overview.capture")),
            }).length > 0;
      expect(entry).toBe(expectedEntry);
      expect(screen.queryAllByTestId("camera-capture-sheet")).toHaveLength(
        expectedEntry ? (surface === "compact" ? 2 : 1) : 0,
      );
      expect(mocks.uploadOrderAttachment).not.toHaveBeenCalled();
    },
  );

  it.each(locales)("maps %s detail failures without exposing provider text", (locale) => {
    mocks.detail = null;
    mocks.queryError = {
      status: 503,
      code: "STORAGE_DOWN",
      message: "SENTINEL bucket policy customer-secret",
    };
    renderDetail(locale);
    expect(screen.getByText(translateMessage(locale, "orders2b2.loadFailed"))).toBeVisible();
    expect(
      screen.getByText(
        translateMessage(locale, "orders2b2.error.unavailable", {
          operation: translateMessage(locale, "orders2b2.operation.load"),
        }),
      ),
    ).toBeVisible();
    expect(screen.queryByText(/SENTINEL|bucket policy|customer-secret/i)).not.toBeInTheDocument();
  });

  it.each(locales)("renders localized %s no-store recovery chrome without writes", (locale) => {
    mocks.activeStore = undefined;
    mocks.shellStatus = "platform_admin";

    renderDetail(locale);

    expect(
      screen.getByRole("heading", {
        name: translateMessage(locale, "orders2b2.storeUnavailable.title"),
      }),
    ).toBeVisible();
    expect(
      screen.getByText(translateMessage(locale, "orders2b2.storeUnavailable.description")),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: translateMessage(locale, "orders2b2.storeUnavailable.action"),
      }),
    ).toHaveAttribute("href", "/platform");
    expect(screen.queryByText(/STORE_SHELL_DYNAMIC/)).not.toBeInTheDocument();
    expect(mocks.patchOrder).not.toHaveBeenCalled();
  });

  it.each(locales)("renders the localized %s no-store retry action", (locale) => {
    mocks.activeStore = undefined;
    mocks.shellStatus = "error";

    renderDetail(locale);

    expect(
      screen.getByRole("button", {
        name: translateMessage(locale, "orders2b2.storeUnavailable.retry"),
      }),
    ).toBeVisible();
    expect(mocks.patchOrder).not.toHaveBeenCalled();
  });

  it.each(locales)("renders localized %s compact title, history empty state and ARIA", (locale) => {
    mocks.viewport = "compact";

    renderDetail(locale, "page");

    expect(screen.getAllByText(translateMessage(locale, "orders2b2.title")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId("mobile-order-header-meta")).toBeVisible();
    expect(
      screen.getByRole("button", { name: translateMessage(locale, "orders2b2.unlock.entry") }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: translateMessage(locale, "orders2b2.mobile.historyCount", { count: 0 }),
      }),
    ).toBeVisible();
    expect(
      screen.getByText(translateMessage(locale, "orders2b2.mobile.historyEmpty")),
    ).toBeVisible();
  });

  it.each(locales)("keeps the localized %s compact read-only assignee fallback", (locale) => {
    mocks.viewport = "compact";
    mocks.detail = {
      ...makeDetail(),
      order: { ...detailOrder, technician_name: "动态中文负责人" },
    };

    renderDetail(locale, "page");

    expect(screen.getByText("动态中文负责人")).toBeVisible();
    expect(screen.getByText(translateMessage(locale, "orders2b2.overview.assignee"))).toBeVisible();
  });

  it.each(locales)("uses the localized %s compact operator fallback", (locale) => {
    mocks.viewport = "compact";
    mocks.detail = {
      ...makeDetail(),
      events: [
        {
          id: "event-operator-fallback",
          order_id: detailOrder.id,
          event_type: "created",
          payload: {},
          operator_id: null,
          operator_name: "",
          created_at: "2026-09-02T09:15:00.000Z",
        },
      ],
    };

    renderDetail(locale, "page");

    expect(
      screen.getByText(translateMessage(locale, "orders2b2.mobile.system"), { exact: false }),
    ).toBeVisible();
  });

  it.each(locales)("renders invalid dates with the safe localized %s fallback", (locale) => {
    mocks.viewport = "compact";
    mocks.detail = {
      ...makeDetail(),
      order: { ...detailOrder, created_at: "INVALID_DATE_SENTINEL" },
      events: [
        {
          id: "event-invalid-date",
          order_id: detailOrder.id,
          event_type: "created",
          payload: {},
          operator_id: null,
          operator_name: "",
          created_at: "INVALID_DATE_SENTINEL",
        },
      ],
    };

    renderDetail(locale, "page");

    expect(
      screen.getAllByText(translateMessage(locale, "orders.unknownDate")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Invalid Date|INVALID_DATE_SENTINEL/i)).not.toBeInTheDocument();
  });

  it.each(locales)("formats the Rome DST boundary consistently in %s", (locale) => {
    const boundary = "2026-03-29T01:30:00.000Z";
    mocks.detail = {
      ...makeDetail(),
      order: { ...detailOrder, created_at: boundary },
    };

    renderDetail(locale);

    const expected = formatOrderDateTime(boundary, locale);
    expect(
      screen.getAllByText((_content, element) => Boolean(element?.textContent?.includes(expected)))
        .length,
    ).toBeGreaterThan(0);
  });

  it.each(locales)(
    "contains a rejected %s approval mutation with safe feedback and preserves the dialog",
    async (locale) => {
      const sentinel = "APPROVAL_SECRET_SENTINEL";
      mocks.detail = {
        ...makeDetail(),
        order: {
          ...detailOrder,
          status: "waiting_approval",
          approval_status: "pending",
          approval_flow_status: "waiting_customer",
        },
      };
      mocks.decideOrderApproval.mockRejectedValueOnce(new Error(sentinel));
      renderDetail(locale);

      fireEvent.click(screen.getByRole("button", { name: "Harness approval" }));
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.approval.confirm"),
        }),
      );

      await waitFor(() => expect(mocks.decideOrderApproval).toHaveBeenCalledOnce());
      expect(mocks.decideOrderApproval).toHaveBeenCalledWith(detailOrder.id, {
        decision: "approved",
        next_status: "repairing",
        reason: undefined,
      });
      expect(mocks.toastError).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b2.error.generic", {
          operation: translateMessage(locale, "orders2b2.operation.approval"),
        }),
      );
      expect(
        screen.getByRole("heading", { name: translateMessage(locale, "orders2b2.hero.approval") }),
      ).toBeVisible();
      expect(JSON.stringify(mocks.toastError.mock.calls)).not.toContain(sentinel);
    },
  );

  it.each(locales)(
    "contains a detached rejected %s attachment upload after the real capture close sequence",
    async (locale) => {
      const sentinel = "ATTACHMENT_SECRET_SENTINEL";
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.uploadOrderAttachment.mockRejectedValueOnce(new Error(sentinel));
      renderDetail(locale);

      fireEvent.click(screen.getByRole("button", { name: "Harness open photo capture" }));
      fireEvent.click(screen.getByRole("button", { name: "Harness capture photo" }));

      await waitFor(() => expect(mocks.uploadOrderAttachment).toHaveBeenCalledOnce());
      expect(mocks.uploadOrderAttachment).toHaveBeenCalledWith(detailOrder.id, {
        kind: "fault_photo",
        file_name: "dynamic-photo.jpg",
        mime_type: "image/jpeg",
        file_size: 1,
        data_base64: "eA==",
      });
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.error.generic", {
            operation: translateMessage(locale, "orders2b2.operation.attachment"),
          }),
        ),
      );
      expect(mocks.toastError).toHaveBeenCalledTimes(1);
      expect(mocks.uploadOrderAttachment).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("button", { name: "Harness capture photo" }),
      ).not.toBeInTheDocument();
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(sentinel);
      expect(JSON.stringify(mocks.toastError.mock.calls)).not.toContain(sentinel);
      consoleError.mockRestore();
    },
  );

  it.each(locales)("shows localized %s edit validation and remote-conflict recovery", (locale) => {
    const view = renderDetail(locale);
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage(locale, "orders2b2.hero.edit") }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Harness invalidate customer" }));
    expect(
      screen.getByRole("alert", {
        name: "",
      }),
    ).toHaveTextContent(translateMessage(locale, "orders2b2.validation.customerName"));

    fireEvent.click(screen.getByRole("button", { name: "Harness change canonical draft" }));
    mocks.detail = {
      ...makeDetail(),
      order: { ...detailOrder, updated_at: "2026-09-02T11:00:00.000Z" },
    };
    view.rerender(
      <LocaleProvider initialLocale={locale}>
        <OrderDetailScreen id={detailOrder.id} surface="dialog" onClose={vi.fn()} />
      </LocaleProvider>,
    );

    expect(screen.getByText(translateMessage(locale, "orders2b2.conflict.title"))).toBeVisible();
    expect(
      screen.getByRole("button", { name: translateMessage(locale, "orders2b2.conflict.reload") }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: translateMessage(locale, "orders2b2.conflict.reload") }),
    );
    return waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        translateMessage(locale, "orders2b2.conflict.loaded"),
      ),
    );
  });

  it.each(locales)(
    "preserves completed steps in a safe localized %s partial-save error",
    async (locale) => {
      const providerSentinel = "PROVIDER_SECRET_PARTIAL_SAVE";
      mocks.patchOrderFinance.mockRejectedValueOnce({ status: 503, message: providerSentinel });
      const view = renderDetail(locale);

      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.hero.edit") }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness change canonical draft" }));
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.hero.save") }),
      );

      await waitFor(() => expect(mocks.patchOrder).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mocks.patchOrderFinance).toHaveBeenCalledTimes(1));
      const expectedFailure = translateMessage(locale, "orders2b2.error.unavailable", {
        operation: translateMessage(locale, "orders2b2.operation.finance"),
      });
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(
          translateMessage(locale, "orders2b2.error.partial", {
            failure: expectedFailure,
            completed: translateMessage(locale, "orders2b2.saveStep.routine"),
          }),
        ),
      );
      expect(JSON.stringify(mocks.toastError.mock.calls)).not.toContain(providerSentinel);
      view.unmount();
    },
  );

  it("submits byte-equivalent routine and finance inputs in all locales", async () => {
    const calls: Array<{ routine: unknown[]; finance: unknown[] }> = [];
    for (const locale of locales) {
      const view = renderDetail(locale);
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.hero.edit") }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Harness change canonical draft" }));
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.hero.save") }),
      );
      await waitFor(() => expect(mocks.patchOrder).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mocks.patchOrderFinance).toHaveBeenCalledTimes(1));
      calls.push({
        routine: structuredClone(mocks.patchOrder.mock.calls[0]!),
        finance: structuredClone(mocks.patchOrderFinance.mock.calls[0]!),
      });
      expect(mocks.patchOrder.mock.calls[0]?.[1]).toMatchObject({
        expected_updated_at: detailOrder.updated_at,
        changes: { customer_name: "动态中文客户改" },
      });
      expect(mocks.patchOrderFinance.mock.calls[0]?.[1]).toMatchObject({
        expected_updated_at: "2026-09-02T10:02:00.000Z",
        fault_prices: [
          {
            line_id: "00000000-0000-4000-8000-000000000221",
            catalog_key: "display:original",
            name: "原装屏幕",
            price: 160,
            note: "客户自定义备注",
          },
        ],
        deposit_amount: 20,
      });
      view.unmount();
      mocks.patchOrder.mockClear();
      mocks.patchOrderFinance.mockClear();
    }
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[2]).toEqual(calls[0]);
  });

  it("keeps transition and custody canonical inputs byte-equivalent in all locales", async () => {
    const calls: Array<{ transition: unknown[]; custody: unknown[] }> = [];
    for (const locale of locales) {
      const transitionView = renderDetail(locale);
      fireEvent.click(screen.getByRole("button", { name: "Harness flow" }));
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(translateMessage(locale, "orders.repaired")),
        }),
      );
      await waitFor(() => expect(mocks.transitionOrder).toHaveBeenCalledTimes(1));
      const transitionCall = structuredClone(mocks.transitionOrder.mock.calls[0]!);
      transitionView.unmount();

      mocks.detail = {
        ...makeDetail(),
        order: {
          ...detailOrder,
          status: "created",
          workflow_status: "intake",
          workflow_bucket: undefined,
        },
      };
      const custodyView = renderDetail(locale);
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.custody.deliver") }),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.custody.confirmSave"),
        }),
      );
      await waitFor(() => expect(mocks.updateOrderCustody).toHaveBeenCalledTimes(1));
      const custodyCall = structuredClone(mocks.updateOrderCustody.mock.calls[0]!);
      custodyView.unmount();

      calls.push({ transition: transitionCall, custody: custodyCall });
      mocks.transitionOrder.mockClear();
      mocks.updateOrderCustody.mockClear();
    }

    const normalized = calls.map((entry) => ({
      transition: [
        entry.transition[0],
        entry.transition[1],
        { ...(entry.transition[2] as Record<string, unknown>), idempotencyKey: "<uuid>" },
      ],
      custody: [
        entry.custody[0],
        { ...(entry.custody[1] as Record<string, unknown>), idempotency_key: "<uuid>" },
      ],
    }));
    expect(normalized[1]).toEqual(normalized[0]);
    expect(normalized[2]).toEqual(normalized[0]);
    expect(normalized[0]).toMatchObject({
      transition: [
        detailOrder.id,
        "repaired",
        {
          expectedUpdatedAt: detailOrder.updated_at,
          idempotencyKey: "<uuid>",
        },
      ],
      custody: [
        detailOrder.id,
        {
          expected_updated_at: detailOrder.updated_at,
          device_custody_status: "with_customer",
          idempotency_key: "<uuid>",
        },
      ],
    });
  });
});
