import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { RepairOsListScaffold } from "@/shared/ui/repair-os-mobile";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("RepairOsListScaffold header chips", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders informational chips without fake button semantics", () => {
    renderScaffold([
      { key: "total", label: "全部", shortLabel: "全", count: 12 },
      { key: "pending", label: "待处理", shortLabel: "待", count: 3 },
    ]);

    expect(screen.getByText("全部")).toBeVisible();
    expect(screen.getByText("待处理")).toBeVisible();
    expect(screen.queryByRole("button", { name: /全部/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /待处理/ })).not.toBeInTheDocument();
  });

  it("keeps actionable chips as buttons", () => {
    const onClick = vi.fn();
    renderScaffold([{ key: "active", label: "处理中", shortLabel: "中", onClick }]);

    fireEvent.click(screen.getByRole("button", { name: /处理中/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

function renderScaffold(chips: React.ComponentProps<typeof RepairOsListScaffold>["chips"]) {
  return render(
    <SidebarProvider>
      <RepairOsListScaffold title="测试列表" chips={chips}>
        <div>内容</div>
      </RepairOsListScaffold>
    </SidebarProvider>,
  );
}
