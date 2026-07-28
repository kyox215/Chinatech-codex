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

  it("supports a settings subpage return action without nesting it in the menu trigger", () => {
    render(
      <SidebarProvider>
        <RepairOsListScaffold title="店铺设置" mobileLeading={<a href="/settings">返回设置总览</a>}>
          <div>内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: "返回设置总览" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("button", { name: /侧边栏|菜单/ })).not.toBeInTheDocument();
  });

  it("uses a single-frame embedded search inside the floating header", () => {
    render(
      <SidebarProvider>
        <RepairOsListScaffold
          title="备忘录"
          searchValue=""
          searchPlaceholder="搜索标题或正文"
          onSearchChange={() => undefined}
          searchFrame="embedded"
        >
          <div>内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    const searchContainer = screen.getByRole("textbox", { name: "搜索标题或正文" }).parentElement;
    expect(searchContainer).toHaveClass("bg-[var(--surface-panel-muted)]");
    expect(searchContainer).not.toHaveClass("border");
    expect(searchContainer?.className).not.toContain("shadow-[var(--shadow-card)]");
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
