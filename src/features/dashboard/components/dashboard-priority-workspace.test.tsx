import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardPriorityItem, DashboardSummary } from "@/lib/repairdesk/types";

import { DashboardPriorityWorkspace } from "./dashboard-priority-workspace";

describe("DashboardPriorityWorkspace", () => {
  afterEach(cleanup);

  it("shows one explicit handoff order and filters without changing work", async () => {
    const user = userEvent.setup();
    render(
      <DashboardPriorityWorkspace
        summary={summary()}
        isLoading={false}
        hasHardError={false}
        hasStaleData={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("第 1 优先")).toBeInTheDocument();
    expect(screen.getByText("当前步骤")).toBeInTheDocument();
    expect(screen.getByText("下一步")).toBeInTheDocument();
    expect(screen.getByText("负责人")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /联系客户/ })).toHaveAttribute(
      "href",
      "/orders/order-1/task",
    );
    expect(screen.queryByText("未结清")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "等待中" }));
    expect(screen.getByText("当前没有等待中的工单")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "等待中" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not present a zero-work conclusion while loading", () => {
    render(
      <DashboardPriorityWorkspace
        isLoading
        hasHardError={false}
        hasStaleData={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("status", { name: "正在生成工单处理顺序" })).toBeInTheDocument();
    expect(screen.queryByText("当前还没有活跃工单")).not.toBeInTheDocument();
  });

  it("uses a hard error instead of inventing a partial priority queue", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardPriorityWorkspace
        summary={summary()}
        isLoading={false}
        hasHardError
        hasStaleData={false}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("暂时无法生成处理顺序");
    expect(screen.queryByText("第 1 优先")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("reports categories that exist beyond the returned priority sample", async () => {
    const user = userEvent.setup();
    render(
      <DashboardPriorityWorkspace
        summary={{
          ...summary(),
          totalCandidates: 27,
          hasMore: true,
          counts: { overdue: 20, ready: 0, active: 0, waiting: 7 },
        }}
        isLoading={false}
        hasHardError={false}
        hasStaleData={false}
        onRetry={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "等待中" }));
    expect(screen.queryByText("当前没有等待中的工单")).not.toBeInTheDocument();
    expect(screen.getByText("完整队列仍有 7 单，请进入完整队列查看。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看完整队列" })).toHaveAttribute("href", "/orders");
  });

  it("shows a non-retry permission state for unauthorized staff", () => {
    render(
      <DashboardPriorityWorkspace
        isLoading={false}
        hasHardError
        hasPermissionError
        hasStaleData={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("你没有查看优先队列的权限");
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(screen.queryByText("第 1 优先")).not.toBeInTheDocument();
  });

  it("keeps the overview focused on the first five tasks", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...priorityItem(),
      rank: index + 1,
      orderId: `order-${index + 1}`,
      publicNo: `R-SYNTH-${index + 1}`,
      detailHref: `/orders/order-${index + 1}`,
      action: {
        ...priorityItem().action,
        href: `/orders/order-${index + 1}/task`,
      },
    }));

    const { container } = render(
      <DashboardPriorityWorkspace
        summary={{
          ...summary(),
          totalCandidates: 8,
          counts: { overdue: 8, ready: 0, active: 0, waiting: 0 },
          items,
        }}
        isLoading={false}
        hasHardError={false}
        hasStaleData={false}
        onRetry={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('[data-ui="dashboard-priority-card"]')).toHaveLength(5);
    expect(screen.getByText(/完整队列共 8 单/)).toBeInTheDocument();
  });
});

function summary(): DashboardSummary {
  return {
    coverage: "store",
    policyVersion: "dashboard-priority-v1",
    generatedAt: "2026-07-16T12:00:00.000Z",
    totalCandidates: 1,
    hasMore: false,
    counts: { overdue: 1, ready: 0, active: 0, waiting: 0 },
    items: [priorityItem()],
  };
}

function priorityItem(): DashboardPriorityItem {
  return {
    rank: 1,
    orderId: "order-1",
    publicNo: "R-SYNTH-001",
    customerName: "Synthetic Customer",
    deviceLabel: "Synthetic Device",
    tier: "overdue",
    reasonCode: "approval_overdue",
    reasonLabel: "报价超期",
    reasonDescription: "报价确认已超出约定等待时间，需要优先联系客户。",
    currentStep: "等待客户确认报价",
    nextStep: "联系客户确认报价，必要时重新发送消息。",
    assigneeLabel: "Synthetic Owner",
    assigneeState: "assigned",
    isMine: true,
    isOverdue: true,
    isActionable: true,
    updatedAt: "2026-07-16T10:00:00.000Z",
    action: { kind: "open_task", label: "联系客户", href: "/orders/order-1/task" },
    detailHref: "/orders/order-1",
  };
}
