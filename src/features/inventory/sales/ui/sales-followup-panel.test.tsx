import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { RepairDeskApiError } from "@/lib/repairdesk/api";
import { SalesFollowupPanel } from "./sales-followup-panel";
import { SalesDailyReport } from "./sales-daily-report";
import { syntheticSalesDailyReport, syntheticSalesWorkflow } from "./sales-workflow-ui.fixture";
import { syntheticSalesStore } from "./sales-ui.fixture";
const mocks = vi.hoisted(() => ({ read: vi.fn(), command: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/repairdesk/api", async (original) => ({
  ...(await original<typeof import("@/lib/repairdesk/api")>()),
  readInventorySalesWorkflow: mocks.read,
  runInventorySalesWorkflowCommand: mocks.command,
  readInventorySalesWorkflowReport: mocks.report,
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
  mocks.read.mockResolvedValue(syntheticSalesWorkflow());
  mocks.report.mockResolvedValue(syntheticSalesDailyReport());
  mocks.command.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
describe("sales follow-up", () => {
  it("requires a correction reason and freezes the opening workflow version", async () => {
    const data = syntheticSalesWorkflow();
    data.workflow.version = 3;
    data.workflow.fiscal = {
      revision: 1,
      document_type: "receipt",
      reference: "SYN-OLD",
      issued_at: "2026-09-25T10:00:00Z",
      recorded_at: "2026-09-25T10:00:00Z",
      verified_at: "2026-09-25T11:00:00Z",
      verified_by_name: "Synthetic Operator",
    };
    mocks.read.mockResolvedValue(data);
    mount(
      <SalesFollowupPanel
        saleOrderId={data.workflow.sale_order_id}
        storeId={syntheticSalesStore}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Correct reference" }));
    fireEvent.change(screen.getByLabelText("Document number"), { target: { value: "SYN-NEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(mocks.command).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Correction reason"), {
      target: { value: "Register reference corrected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledOnce());
    expect(mocks.command.mock.calls[0][0]).toMatchObject({
      command: "fiscal.record",
      expected_workflow_version: 3,
      payload: { reference: "SYN-NEW", correction_reason: "Register reference corrected" },
    });
  });
  it("retains a failed exception draft and retries with the same idempotency key", async () => {
    mocks.command.mockRejectedValue(new Error("synthetic disconnect"));
    const data = syntheticSalesWorkflow();
    mount(
      <SalesFollowupPanel
        saleOrderId={data.workflow.sale_order_id}
        storeId={syntheticSalesStore}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Record exception" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Customer requests a manual return review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Customer requests a manual return review",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
    expect(mocks.command.mock.calls[0][0].idempotency_key).toBe(
      mocks.command.mock.calls[1][0].idempotency_key,
    );
  });
  it("shows no operational data when the server rejects access", async () => {
    mocks.read.mockRejectedValue(new RepairDeskApiError("forbidden", 403));
    mount(
      <SalesFollowupPanel
        saleOrderId={syntheticSalesWorkflow().workflow.sale_order_id}
        storeId={syntheticSalesStore}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your account cannot perform this action",
    );
    expect(screen.queryByRole("button", { name: "Record exception" })).toBeNull();
  });
  it("keeps dirty follow-up open on Escape until discard is confirmed", async () => {
    mount(
      <SalesFollowupPanel
        saleOrderId={syntheticSalesWorkflow().workflow.sale_order_id}
        storeId={syntheticSalesStore}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Owner and follow-up" }));
    fireEvent.change(screen.getByLabelText("Operational note"), {
      target: { value: "Call after collection" },
    });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(await screen.findByRole("button", { name: "Continue editing" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.getByLabelText("Operational note")).toHaveValue("Call after collection");
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("keeps financial totals absent for an unprivileged report", async () => {
    const data = syntheticSalesDailyReport();
    data.finance = null;
    data.pending.scope = "mine";
    mocks.report.mockResolvedValue(data);
    mount(<SalesDailyReport storeId={syntheticSalesStore} onClose={vi.fn()} />);
    expect(
      await screen.findByText("Financial totals require aggregate finance permission."),
    ).toBeVisible();
    expect(screen.queryByText(/Sales agreed/)).toBeNull();
    expect(screen.getByText(/My sales/)).toBeVisible();
  });
});
