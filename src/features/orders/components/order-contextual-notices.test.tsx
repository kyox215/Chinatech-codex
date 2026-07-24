import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDetail } from "@/lib/repairdesk/types";

import { OrderHero } from "./order-hero";
import { OrderTerminalActions } from "./order-terminal-actions";

function order(overrides: Partial<OrderDetail["order"]> = {}) {
  return {
    id: "order_1",
    public_no: "R2026001",
    status: "completed",
    workflow_status: "closed",
    workflow_bucket: "done",
    order_type: "quick_repair",
    customer_phone: "3330000000",
    device_label: "Apple iPhone 14",
    fault_prices: [],
    quotation_amount: 0,
    deposit_amount: 0,
    balance_amount: 0,
    created_at: "2026-07-16T20:00:00.000Z",
    updated_at: "2026-07-16T20:00:00.000Z",
    ...overrides,
  } as OrderDetail["order"];
}

describe("order detail contextual notices", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("opens the print recovery panel from a focusable blocked print button", async () => {
    const user = userEvent.setup();

    render(
      <OrderHero
        order={order({ status: "diagnosing", workflow_status: "diagnosis" })}
        onPrint={vi.fn()}
        printDisabled
        printDisabledReason="请先补齐当前店铺资料后再打印"
        printRecovery={<p>前往店铺资料后重新检查</p>}
        onCancel={vi.fn()}
        onSaveEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        showBackLink={false}
      />,
    );

    const printButton = screen.getByRole("button", {
      name: "请先补齐当前店铺资料后再打印，查看解决方法",
    });
    expect(printButton).toBeEnabled();

    await user.click(printButton);
    expect(screen.getByText("前往店铺资料后重新检查")).toBeVisible();
  });

  it("keeps terminal mutations behind the compact status actions", () => {
    const detail = {
      order: order(),
      capabilities: {
        canCorrect: true,
        canReopen: true,
        canVoid: true,
      },
    } as OrderDetail;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <OrderTerminalActions
          detail={detail}
          workflow={
            {
              statuses: [
                {
                  code: "diagnosing",
                  label: "检测中",
                  enabled: true,
                  bucket: "active",
                },
              ],
            } as never
          }
          onCompleted={vi.fn()}
          variant="compact"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("工单已结束 · 编辑已锁定")).toBeVisible();
    expect(screen.getByRole("button", { name: "纠正" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "重新打开" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "更多结束工单操作" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "安全作废" })).not.toBeInTheDocument();
  });
});
