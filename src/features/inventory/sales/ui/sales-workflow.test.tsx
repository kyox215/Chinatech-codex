import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { SalesTransactionDialog } from "./sales-transaction-dialog";
import { SalesWorkspace } from "./sales-workspace";
import { SalesInspectionDialog } from "./sales-inspection-dialog";
import { SalesReceiptDialog } from "./sales-receipt-dialog";
import {
  syntheticSalesDetail,
  syntheticSalesReceipt,
  syntheticSalesStore,
  syntheticSalesSummary,
} from "./sales-ui.fixture";
const mocks = vi.hoisted(() => ({
  command: vi.fn(),
  detail: vi.fn(),
  receipt: vi.fn(),
  workflow: vi.fn(),
}));
vi.mock("@/lib/repairdesk/api", async (original) => ({
  ...(await original<typeof import("@/lib/repairdesk/api")>()),
  runInventorySalesCommand: mocks.command,
  readInventorySalesDetail: mocks.detail,
  readInventorySalesReceipt: mocks.receipt,
  applyInventoryWorkflowV2: mocks.workflow,
}));
vi.mock("@/features/orders/forms/customer-intake-lookup", () => ({
  CustomerIdentityLookup: ({ onPickCustomer }: { onPickCustomer: (c: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onPickCustomer({
          customer: {
            id: "60000000-0000-4000-8000-000000000001",
            name: "Synthetic",
            phone_e164: "+390000000001",
          },
        })
      }
    >
      Select synthetic customer
    </button>
  ),
}));
function mount(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <LocaleProvider initialLocale="en">{node}</LocaleProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.command.mockResolvedValue({ ok: true, code: "completed" });
  mocks.workflow.mockResolvedValue({ ok: true });
  mocks.detail.mockResolvedValue(syntheticSalesDetail());
  mocks.receipt.mockResolvedValue(syntheticSalesReceipt());
});
afterEach(cleanup);
describe("real sales command components", () => {
  it("keeps the opening CAS snapshot when background balance data changes", async () => {
    function Harness() {
      const [summary, setSummary] = useState(syntheticSalesDetail());
      return (
        <>
          <button
            onClick={() =>
              setSummary({
                ...summary,
                order: { ...summary.order!, version: 8, paid_cents: 5000, balance_cents: 5000 },
              })
            }
          >
            Remote update
          </button>
          <SalesTransactionDialog
            summary={summary}
            command="payment.append"
            storeId={syntheticSalesStore}
            onClose={vi.fn()}
            onRefresh={vi.fn()}
          />
        </>
      );
    }
    mount(<Harness />);
    fireEvent.click(screen.getByText("Remote update"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledOnce());
    expect(mocks.command.mock.calls[0][0].payload).toMatchObject({
      expected_order_version: 1,
      payment: { amount_cents: 7000 },
    });
  });
  it("collects the remaining balance and delivers atomically, preventing pending double clicks", async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocks.command.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const close = vi.fn();
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesDetail()}
        command="payment.append"
        storeId={syntheticSalesStore}
        onClose={close}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Collect and deliver" }));
    fireEvent.click(screen.getByLabelText(/Confirm actual handover/));
    const submit = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.command).toHaveBeenCalledOnce());
    expect(mocks.command.mock.calls[0][0].payload).toMatchObject({
      deliver: true,
      payment: { amount_cents: 7000 },
      delivered_at: expect.any(String),
    });
    expect(
      screen
        .getAllByRole("button", { name: "Close" })
        .find((button) => button.getAttribute("data-slot") !== "dialog-close")!,
    ).toBeDisabled();
    expect(close).not.toHaveBeenCalled();
    finish({ ok: true });
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it("does not allow a standalone pickup while a balance remains", () => {
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesDetail()}
        command="pickup.confirm"
        storeId={syntheticSalesStore}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Confirm actual handover/));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("creates a partial paid reservation with precise cents and 24 month default", async () => {
    const close = vi.fn();
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesSummary()}
        command="sale.create"
        storeId={syntheticSalesStore}
        onClose={close}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Select synthetic customer"));
    fireEvent.change(screen.getByLabelText("This payment (€)"), { target: { value: "10.29" } });
    expect(screen.getByRole("button", { name: "Collect and deliver" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
    expect(mocks.command.mock.calls[0][0]).toMatchObject({
      command: "sale.create",
      payload: {
        price_cents: 10000,
        payment: { amount_cents: 1029 },
        deliver: false,
        warranty_months: 24,
        customer_id: "60000000-0000-4000-8000-000000000001",
      },
    });
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
  it("retries identical uncertain payment with the same operation and new key after edits", async () => {
    mocks.command.mockRejectedValue(new TypeError("synthetic disconnect"));
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesDetail()}
        command="payment.append"
        storeId={syntheticSalesStore}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    const submit = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(submit);
    await screen.findByRole("alert");
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
    expect(mocks.command.mock.calls[0][0].idempotency_key).toBe(
      mocks.command.mock.calls[1][0].idempotency_key,
    );
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.change(screen.getByLabelText("This payment (€)"), { target: { value: "60.01" } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(3));
    expect(mocks.command.mock.calls[2][0].idempotency_key).not.toBe(
      mocks.command.mock.calls[0][0].idempotency_key,
    );
  });
  it("blocks overpayment and underpaid pickup", () => {
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesDetail()}
        command="payment.append"
        storeId={syntheticSalesStore}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("This payment (€)"), { target: { value: "70.01" } });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("uses explicit 12-month consent and actual handover confirmation", () => {
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesSummary()}
        command="sale.create"
        storeId={syntheticSalesStore}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Select synthetic customer"));
    fireEvent.change(screen.getByLabelText("Warranty"), { target: { value: "12" } });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/expressly agreed/));
    fireEvent.click(screen.getByRole("button", { name: "Collect and deliver" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirm actual handover/));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  });
  it("offers refresh after CAS conflict without silently submitting a new payment", async () => {
    const refresh = vi.fn();
    mocks.command.mockRejectedValue(new RepairDeskApiError("conflict", 409, "stale_version"));
    mount(
      <SalesTransactionDialog
        summary={syntheticSalesDetail()}
        command="payment.append"
        storeId={syntheticSalesStore}
        onClose={vi.fn()}
        onRefresh={refresh}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(await screen.findByRole("button", { name: "Refresh and review" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(mocks.command).toHaveBeenCalledOnce();
  });
  it("does not automatically pass uninspected fields", async () => {
    const summary = syntheticSalesSummary();
    summary.inspection = {
      ...summary.inspection,
      imei_check_status: "unknown",
      activation_lock_status: "unknown",
      data_wipe_status: "unknown",
      functional_grade: "untested",
      cosmetic_grade: "unknown",
    };
    mount(
      <SalesInspectionDialog summary={summary} storeId={syntheticSalesStore} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("IMEI / serial verified"), {
      target: { value: "pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.workflow).toHaveBeenCalledOnce());
    expect(mocks.workflow.mock.calls[0][1]).toMatchObject({
      operation: "inspect",
      inspection: {
        imei_check_status: "pass",
        activation_lock_status: "unknown",
        data_wipe_status: "unknown",
        functional_grade: "untested",
      },
    });
    expect(mocks.workflow.mock.calls[0][1].target_status).toBeUndefined();
  });
  it("keeps legacy no-unit read only with no sale or inspection actions", () => {
    const summary = syntheticSalesSummary();
    summary.stock_unit_id = null;
    summary.allowed_actions = [];
    summary.capabilities.can_inspect = false;
    summary.capabilities.can_prepare_for_sale = false;
    summary.capabilities.inspection_block_reason = "stock_unit_required";
    mount(<SalesWorkspace summary={summary} storeId={syntheticSalesStore} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Historical record without a stock unit/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sell / take deposit" })).not.toBeInTheDocument();
  });
  it("historical missing seller never offers a settings repair link", async () => {
    mocks.receipt.mockRejectedValue(
      new RepairDeskApiError("history", 409, "historical_store_identity_incomplete"),
    );
    mount(
      <SalesReceiptDialog
        input={{ id: syntheticSalesDetail().order!.id, kind: "sale" }}
        storeId={syntheticSalesStore}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText(/current settings cannot repair/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open settings" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-ui="sales-document-sheet"]')).toBeNull();
  });
});
