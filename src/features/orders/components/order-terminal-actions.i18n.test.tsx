import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fallbackOrderWorkflowStatuses } from "@/features/orders/model/order-workflow";
import { orders } from "@/lib/mock/fixtures";
import type { OrderDetail, OrderWorkflow } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

const apiMocks = vi.hoisted(() => ({
  correctTerminalOrder: vi.fn(),
  reopenOrder: vi.fn(),
  voidOrder: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  correctTerminalOrder: apiMocks.correctTerminalOrder,
  reopenOrder: apiMocks.reopenOrder,
  voidOrder: apiMocks.voidOrder,
}));
vi.mock("sonner", () => ({
  toast: { error: apiMocks.toastError, success: vi.fn() },
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import { OrderTerminalActions } from "./order-terminal-actions";

const locales = ["zh-CN", "it-IT", "en"] as const;

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.correctTerminalOrder.mockResolvedValue({ replayed: false });
  apiMocks.reopenOrder.mockResolvedValue({ replayed: false });
  apiMocks.voidOrder.mockResolvedValue({ replayed: false });
});

afterEach(cleanup);

describe("OrderTerminalActions i18n", () => {
  it.each(locales)(
    "localizes the %s terminal lock state and preserves a dynamic permission reason",
    (locale) => {
      const dynamicReason = "动态中文权限原因";
      const detail = {
        order: {
          ...orders[0]!,
          status: "completed",
          record_state: "active",
          deleted_at: undefined,
        },
        events: [],
        messages: [],
        attachments: [],
        capabilities: {
          canEditIntake: false,
          canEditRepair: false,
          canAdjustFinance: false,
          canPrepareQuote: false,
          canSendQuote: false,
          canCollectPayment: false,
          canTransition: false,
          canConfirmCancelledReturn: false,
          canCreateKioskSession: false,
          canCorrect: false,
          canReopen: false,
          canVoid: false,
          blockedReasons: { void: dynamicReason },
        },
      } as unknown as OrderDetail;
      const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

      render(
        <QueryClientProvider client={client}>
          <LocaleProvider initialLocale={locale}>
            <OrderTerminalActions detail={detail} onCompleted={vi.fn()} />
          </LocaleProvider>
        </QueryClientProvider>,
      );

      expect(
        screen.getByText(translateMessage(locale, "orders2b2.terminal.title.ended")),
      ).toBeVisible();
      expect(
        screen.getByText(
          translateMessage(locale, "orders2b2.terminal.voidBlocked", {
            reason: dynamicReason,
          }),
        ),
      ).toBeVisible();
      expect(screen.getByText(dynamicReason, { exact: false })).toBeVisible();
    },
  );

  it.each(locales)("submits exact correct, reopen and void inputs in %s", async (locale) => {
    const calls: Record<string, unknown> = {};

    {
      const view = renderTerminal(locale, terminalDetail());
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.terminal.correctRecord"),
        }),
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "orders2b2.terminal.field.diagnosis")),
        { target: { value: "动态修正诊断" } },
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "orders2b2.terminal.reason")),
        { target: { value: "  动态操作原因  " } },
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.terminal.action.correct"),
        }),
      );
      await waitFor(() => expect(apiMocks.correctTerminalOrder).toHaveBeenCalledOnce());
      calls.correct = structuredClone(apiMocks.correctTerminalOrder.mock.calls[0]);
      view.unmount();
    }

    {
      const view = renderTerminal(locale, terminalDetail());
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.terminal.reopen"),
        }),
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "orders2b2.terminal.reason")),
        { target: { value: "  动态操作原因  " } },
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.terminal.action.reopen"),
        }),
      );
      await waitFor(() => expect(apiMocks.reopenOrder).toHaveBeenCalledOnce());
      calls.reopen = structuredClone(apiMocks.reopenOrder.mock.calls[0]);
      view.unmount();
    }

    {
      const detail = terminalDetail();
      const view = renderTerminal(locale, detail);
      fireEvent.click(
        screen.getByRole("button", { name: translateMessage(locale, "orders2b2.terminal.void") }),
      );
      fireEvent.change(
        screen.getByLabelText(
          translateMessage(locale, "orders2b2.terminal.confirmNumber", {
            publicNo: detail.order.public_no,
          }),
        ),
        { target: { value: detail.order.public_no } },
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "orders2b2.terminal.reason")),
        { target: { value: "  动态操作原因  " } },
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.terminal.action.void"),
        }),
      );
      await waitFor(() => expect(apiMocks.voidOrder).toHaveBeenCalledOnce());
      calls.void = structuredClone(apiMocks.voidOrder.mock.calls[0]);
      view.unmount();
    }

    expect(calls).toMatchObject({
      correct: [
        terminalDetail().order.id,
        {
          expected_updated_at: terminalDetail().order.updated_at,
          idempotency_key: expect.any(String),
          reason: "动态操作原因",
          changes: { diagnosis_result: "动态修正诊断" },
        },
      ],
      reopen: [
        terminalDetail().order.id,
        {
          expected_updated_at: terminalDetail().order.updated_at,
          idempotency_key: expect.any(String),
          reason: "动态操作原因",
          to_status: "diagnosing",
        },
      ],
      void: [
        terminalDetail().order.id,
        {
          expected_updated_at: terminalDetail().order.updated_at,
          idempotency_key: expect.any(String),
          reason: "动态操作原因",
          confirm_public_no: terminalDetail().order.public_no,
        },
      ],
    });
  });

  it.each(locales)(
    "shows a safe %s error and reuses the terminal idempotency input",
    async (locale) => {
      const sentinel = "TERMINAL_SECRET_SENTINEL";
      apiMocks.correctTerminalOrder
        .mockRejectedValueOnce(new Error(sentinel))
        .mockResolvedValueOnce({ replayed: false });
      renderTerminal(locale, terminalDetail());
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "orders2b2.terminal.correctRecord"),
        }),
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "orders2b2.terminal.field.diagnosis")),
        { target: { value: "动态修正诊断" } },
      );
      fireEvent.change(
        screen.getByLabelText(translateMessage(locale, "orders2b2.terminal.reason")),
        {
          target: { value: "动态操作原因" },
        },
      );
      const confirm = screen.getByRole("button", {
        name: translateMessage(locale, "orders2b2.terminal.action.correct"),
      });
      fireEvent.click(confirm);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        translateMessage(locale, "orders2b2.error.generic", {
          operation: translateMessage(locale, "orders2b2.operation.save"),
        }),
      );
      expect(screen.queryByText(sentinel)).not.toBeInTheDocument();
      fireEvent.click(confirm);
      await waitFor(() => expect(apiMocks.correctTerminalOrder).toHaveBeenCalledTimes(2));
      expect(apiMocks.correctTerminalOrder.mock.calls[1]).toEqual(
        apiMocks.correctTerminalOrder.mock.calls[0],
      );
    },
  );
});

function terminalDetail() {
  return {
    order: {
      ...orders[0]!,
      status: "completed",
      record_state: "active",
      deleted_at: undefined,
      issue_description: "动态故障",
      diagnosis_result: "原诊断",
      internal_tag: "动态标签",
      accessory_notes: "动态附件",
      warranty_months: 6,
      warranty_text: "6个月",
      updated_at: "2026-09-02T10:00:00.000Z",
    },
    events: [],
    messages: [],
    attachments: [],
    capabilities: {
      canEditIntake: false,
      canEditRepair: false,
      canAdjustFinance: false,
      canPrepareQuote: false,
      canSendQuote: false,
      canCollectPayment: false,
      canTransition: false,
      canConfirmCancelledReturn: false,
      canCreateKioskSession: false,
      canCorrect: true,
      canReopen: true,
      canVoid: true,
      reopenTargets: [{ code: "diagnosing", label: "动态检测" }],
    },
  } as unknown as OrderDetail;
}

const workflow = {
  statuses: fallbackOrderWorkflowStatuses,
  transitions: [],
} as unknown as OrderWorkflow;

function renderTerminal(locale: (typeof locales)[number], detail: OrderDetail) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider initialLocale={locale}>
        <OrderTerminalActions detail={detail} workflow={workflow} onCompleted={vi.fn()} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}
