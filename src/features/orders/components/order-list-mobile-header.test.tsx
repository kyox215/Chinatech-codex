import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

import { MobileOrdersFloatingHeader } from "./order-list-mobile-header";
import { OrderListQueueMenu } from "./order-list-queue-menu";
import { OrderListViewMode } from "./order-list-view-mode";

vi.mock("@/features/realtime", () => ({
  RealtimeSyncIndicator: () => null,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

const groups = [
  { key: "all", label: "全部任务", shortLabel: "全", count: 174 },
  { key: "processing", label: "正在处理", shortLabel: "处理中", count: 45 },
  { key: "ordered", label: "等待配件", shortLabel: "等配件", count: 24, tone: "info" as const },
  { key: "arrived", label: "配件已到", shortLabel: "已到货", count: 27, tone: "warn" as const },
  {
    key: "arrived_notified",
    label: "已通知到货",
    shortLabel: "已通知",
    count: 32,
    tone: "warn" as const,
  },
  {
    key: "repaired",
    label: "待通知取机",
    shortLabel: "待通知",
    count: 4,
    tone: "success" as const,
  },
  {
    key: "repaired_notified",
    label: "等待客户取机",
    shortLabel: "待取机",
    count: 42,
    tone: "success" as const,
  },
];

function renderHeader({
  pendingGroupValue,
  interactionDisabled,
  aiAction,
}: { pendingGroupValue?: string; interactionDisabled?: boolean; aiAction?: React.ReactNode } = {}) {
  const onGroupChange = vi.fn();
  const result = render(
    <SidebarProvider>
      <MobileOrdersFloatingHeader
        groups={groups}
        groupValue={pendingGroupValue ?? "all"}
        pendingGroupValue={pendingGroupValue}
        pendingLabel={pendingGroupValue ? "等待配件" : undefined}
        totalOrders={174}
        onGroupChange={onGroupChange}
        onCreateOrder={vi.fn()}
        aiAction={aiAction}
        searchValue=""
        searchBusy={false}
        interactionDisabled={interactionDisabled}
        onSearchChange={vi.fn()}
        onSearchSubmit={vi.fn()}
        onSearchClear={vi.fn()}
        scanAction={<button aria-label="扫码搜索">扫码</button>}
        filterAction={<button aria-label="筛选订单">筛选</button>}
        rangeLabel="待处理"
      />
    </SidebarProvider>,
  );
  return { ...result, onGroupChange };
}

describe("MobileOrdersFloatingHeader", () => {
  it("shows a static summary without queues while the independent range can return to active", async () => {
    const onQueue = vi.fn();
    const onRange = vi.fn();
    render(
      <>
        <OrderListQueueMenu
          groups={[]}
          value="all"
          total={12}
          rangeLabel="已归档"
          onChange={onQueue}
        />
        <OrderListViewMode disclosure value="archive" canBrowseArchive onChange={onRange} />
      </>,
    );
    const summary = document.querySelector('[data-order-static-results="true"]');
    expect(summary).toBeVisible();
    expect(summary).toHaveTextContent("12");
    expect(screen.queryByRole("button", { name: /切换工作队列/ })).not.toBeInTheDocument();
    await userEvent.click(summary!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /订单显示范围/ }));
    await userEvent.click(screen.getByRole("button", { name: "待处理" }));
    expect(onRange).toHaveBeenCalledWith("active");
    expect(onQueue).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("keeps the header compact and discloses all seven named queues with their counts", async () => {
    const { container, onGroupChange } = renderHeader();
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "扫码搜索" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "筛选订单" })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "搜索工单、客户、电话或 IMEI" }).parentElement,
    ).toHaveClass("bg-[var(--surface-panel-muted)]");
    expect(container.querySelectorAll("[data-order-queue-option]")).toHaveLength(0);
    const trigger = screen.getByRole("button", { name: /切换工作队列/ });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "工作队列" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-order-queue-option]")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "等待客户取机，42 条工单" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部任务，174 条工单" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "等待配件，24 条工单" }));
    expect(onGroupChange).toHaveBeenCalledWith("ordered");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("shows pending intent while keeping the current queue and scope explicit", async () => {
    renderHeader({ pendingGroupValue: "ordered" });
    expect(screen.getByText("正在加载等待配件…")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /切换工作队列/ }));
    expect(screen.getByRole("button", { name: "等待配件，24 条工单" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("待处理");
  });

  it("disables queue and search changes while the list is offline", () => {
    const { onGroupChange } = renderHeader({ interactionDisabled: true });
    expect(screen.getByRole("textbox", { name: "搜索工单、客户、电话或 IMEI" })).toBeDisabled();
    const trigger = screen.getByRole("button", { name: /切换工作队列/ });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onGroupChange).not.toHaveBeenCalled();
  });

  it("closes on Escape without opening the text keyboard and returns focus", async () => {
    renderHeader();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: /切换工作队列/ });
    await user.click(trigger);
    expect(document.activeElement?.tagName).not.toBe("INPUT");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("button", { name: /排序/ })).not.toBeInTheDocument();
    expect(screen.getByText("进度优先")).toBeInTheDocument();
  });

  it("renders the contextual AI action without removing the new-order action", () => {
    renderHeader({ aiAction: <button aria-label="打开 RepairDesk AI 小助手">AI</button> });

    expect(screen.getByRole("button", { name: "打开 RepairDesk AI 小助手" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建工单" })).toBeInTheDocument();
  });
});
