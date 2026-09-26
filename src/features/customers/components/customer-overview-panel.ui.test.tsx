import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerOverviewPanel } from "./customer-detail-panels";
import { getCustomerDetail } from "@/features/customers/testing/mock-api";
import { customers } from "@/lib/mock/state";
import type { CustomerDetail } from "@/lib/repairdesk/api";

afterEach(cleanup);

async function fixture() {
  const data = structuredClone(await getCustomerDetail(customers[0].id));
  const base = data.orders[0];
  const order = (id: string, changes: Partial<typeof base> = {}) =>
    ({
      ...base,
      id,
      public_no: id,
      status: "repairing",
      workflow_status: "repair",
      workflow_bucket: "in_progress",
      exception_status: undefined,
      finance_redacted: false,
      quotation_amount: 100,
      deposit_amount: 30,
      balance_amount: 70,
      is_paid: false,
      payment_status: "partial",
      approval_status: "approved",
      approval_flow_status: "not_required",
      ...changes,
    }) as CustomerDetail["orders"][number];
  data.stats.finance_redacted = false;
  data.orders = [
    order("ACTIVE-UNPAID"),
    order("CLOSED-UNPAID", {
      status: "completed",
      workflow_status: "closed",
      workflow_bucket: "done",
    }),
    order("HISTORY-PAID", {
      status: "completed",
      workflow_status: "closed",
      workflow_bucket: "done",
      balance_amount: 0,
      deposit_amount: 100,
      is_paid: true,
      payment_status: "paid",
    }),
    order("CANCELLED", {
      status: "cancelled",
      workflow_status: "closed",
      workflow_bucket: "cancelled",
      exception_status: "cancelled",
    }),
    order("ACTIVE-PAID", {
      balance_amount: 0,
      deposit_amount: 100,
      is_paid: true,
      payment_status: "paid",
    }),
    order("ACTIVE-QUOTE", { approval_status: "pending", approval_flow_status: "waiting_customer" }),
    order("CLOSED-CONFLICT", {
      status: "completed",
      workflow_status: "closed",
      workflow_bucket: "done",
      is_paid: true,
      payment_status: "paid",
    }),
  ];
  return data;
}

describe("customer overview unfinished orders", () => {
  it("shows each unfinished or collectible order once without historical or cancelled orders", async () => {
    render(
      <CustomerOverviewPanel
        data={await fixture()}
        onOpenBusiness={vi.fn()}
        onOpenProfile={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getAllByText("ACTIVE-UNPAID")).toHaveLength(1);
    expect(screen.getByText("CLOSED-UNPAID")).toBeVisible();
    expect(screen.getByText("ACTIVE-PAID")).toBeVisible();
    const pending = screen.getByRole("link", { name: /ACTIVE-QUOTE/ });
    expect(within(pending).queryByText(/待收/)).not.toBeInTheDocument();
    for (const id of ["HISTORY-PAID", "CANCELLED", "CLOSED-CONFLICT"]) {
      expect(screen.queryByText(id)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /ACTIVE-UNPAID/ })).toHaveAttribute(
      "href",
      expect.stringContaining("orderId=ACTIVE-UNPAID"),
    );
  });

  it("does not reveal amounts or completed receivables to a finance-restricted viewer", async () => {
    const data = await fixture();
    data.stats.finance_redacted = true;
    render(<CustomerOverviewPanel data={data} onOpenBusiness={vi.fn()} onOpenProfile={vi.fn()} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByText("CLOSED-UNPAID")).not.toBeInTheDocument();
    expect(screen.queryByText(/€|待收/)).not.toBeInTheDocument();
  });

  it("keeps a short empty state when all orders are finished", async () => {
    const data = await fixture();
    data.orders = data.orders.filter((order) => order.public_no === "HISTORY-PAID");
    render(<CustomerOverviewPanel data={data} onOpenBusiness={vi.fn()} onOpenProfile={vi.fn()} />);
    expect(screen.getByText("暂无未完成工单")).toBeVisible();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
