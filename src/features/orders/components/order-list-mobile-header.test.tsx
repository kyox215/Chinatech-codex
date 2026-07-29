import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

import { MobileOrdersFloatingHeader } from "./order-list-mobile-header";

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
        viewModeControl={<div>范围切换</div>}
      />
    </SidebarProvider>,
  );
  return { ...result, onGroupChange };
}

describe("MobileOrdersFloatingHeader", () => {
  it("keeps scan, filter and all seven queues in the touch-first header", () => {
    const { container, onGroupChange } = renderHeader();

    expect(screen.getByRole("button", { name: "扫码搜索" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "筛选订单" })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "搜索工单、客户、电话或 IMEI" }).parentElement,
    ).toHaveClass("bg-[var(--surface-panel-muted)]");
    expect(screen.queryByText(/队列：/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "第 7 阶段：等待客户取机，42 条" }),
    ).toBeInTheDocument();

    const queueGroup = screen.getByRole("group", { name: "待处理状态" });
    expect(queueGroup).toHaveClass("grid-cols-4");
    expect(screen.getByRole("button", { name: "第 1 阶段：全部任务，174 条" })).toHaveClass(
      "col-span-2",
    );
    expect(screen.getByText("待取机")).toBeInTheDocument();
    expect(screen.queryByText("等待客户取机")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label$=" 条"]')).toHaveLength(7);

    fireEvent.click(screen.getByRole("button", { name: "第 3 阶段：等待配件，24 条" }));
    expect(onGroupChange).toHaveBeenCalledWith("ordered");
  });

  it("shows immediate pending state on the selected queue", () => {
    renderHeader({ pendingGroupValue: "ordered" });

    expect(screen.getByText("正在加载等待配件…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "第 3 阶段：等待配件，24 条" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("disables queue and search changes while the list is offline", () => {
    const { onGroupChange } = renderHeader({ interactionDisabled: true });

    expect(screen.getByRole("textbox", { name: "搜索工单、客户、电话或 IMEI" })).toBeDisabled();
    const ordered = screen.getByRole("button", { name: "第 3 阶段：等待配件，24 条" });
    expect(ordered).toBeDisabled();
    fireEvent.click(ordered);
    expect(onGroupChange).not.toHaveBeenCalled();
  });

  it("renders the contextual AI action without removing the new-order action", () => {
    renderHeader({ aiAction: <button aria-label="打开 RepairDesk AI 小助手">AI</button> });

    expect(screen.getByRole("button", { name: "打开 RepairDesk AI 小助手" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建工单" })).toBeInTheDocument();
  });
});
