import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { componentDensity, componentSpacing } from "@/lib/component-patterns";
import { controlDensity, repairOs, semanticSpacing } from "@/lib/ui-patterns";
import {
  RepairOsBusinessCard,
  RepairOsChipRow,
  RepairOsListScaffold,
} from "@/shared/ui/repair-os-mobile";

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

    expect(screen.getByText("全")).toBeVisible();
    expect(screen.getByText("待")).toBeVisible();
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

  it("keeps explicit standalone search available when the parent has no frame", () => {
    render(
      <SidebarProvider>
        <RepairOsListScaffold
          title="独立搜索"
          searchValue=""
          searchPlaceholder="搜索"
          onSearchChange={() => undefined}
          searchFrame="standalone"
        >
          <div>内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    const searchContainer = screen.getByRole("textbox", { name: "搜索" }).parentElement;
    expect(searchContainer).toHaveClass("border");
    expect(searchContainer).not.toHaveClass("bg-[var(--surface-panel-muted)]");
  });

  it("wraps chips without horizontal-scroll decoration and preserves non-action semantics", () => {
    render(
      <RepairOsChipRow chips={[{ label: "只读状态" }, { label: "可执行", onClick: vi.fn() }]} />,
    );

    const row = screen.getByText("只读状态").parentElement;
    expect(row).toHaveClass("flex-wrap", "gap-1.5");
    expect(row?.className).not.toMatch(/overflow-x-auto|snap-x/);
    expect(screen.getByText("只读状态").tagName).toBe("SPAN");
    expect(screen.getByRole("button", { name: "可执行" })).toBeInTheDocument();
  });

  it("keeps business-card density backward compatible while exposing dense mode", () => {
    render(
      <>
        <RepairOsBusinessCard data-testid="standard-card">标准</RepairOsBusinessCard>
        <RepairOsBusinessCard data-testid="dense-card" density="dense">
          紧凑
        </RepairOsBusinessCard>
      </>,
    );

    expect(screen.getByTestId("standard-card")).toHaveClass("px-2.5", "py-2");
    expect(screen.getByTestId("dense-card")).toHaveClass("px-2", "py-1.5");
  });

  it("publishes relationship spacing separately from control density", () => {
    expect(semanticSpacing).toEqual({
      inline: "gap-1",
      controlCluster: "gap-1.5",
      contentRow: "gap-2",
      group: "gap-3",
      mobileModule: "gap-4",
      desktopModule: "gap-6",
      denseCardStack: "gap-1.5 sm:gap-2",
    });
    expect(componentSpacing).toEqual({
      inlineSpacing: "gap-1",
      controlClusterSpacing: "gap-1.5",
      contentRowSpacing: "gap-2",
      groupSpacing: "gap-3",
      mobileModuleSpacing: "gap-4",
      desktopModuleSpacing: "gap-6",
      denseCardStackSpacing: "gap-1.5 sm:gap-2",
    });
    expect(controlDensity.standard).toBe("min-h-9 min-w-9");
    expect(componentDensity.mobileStandardTarget).toBe("min-h-9 min-w-9");
    expect(repairOs.quickSheet).toContain("grid-rows-[auto_minmax(0,1fr)]");
    expect(repairOs.quickSheet).toContain("overflow-hidden");
    expect(repairOs.quickSheet).not.toContain("overflow-y-auto");
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
