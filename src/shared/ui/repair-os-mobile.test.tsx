import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { RepairOsListScaffold } from "@/shared/ui/repair-os-mobile";

const mocks = vi.hoisted(() => ({ viewport: "compact" as "pending" | "compact" | "desktop" }));

vi.mock("@/hooks/use-mobile", () => ({
  useViewportMode: () => mocks.viewport,
  useIsCompactWorkspace: () => mocks.viewport === "compact",
  useIsMobile: () => mocks.viewport === "compact",
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("RepairOsListScaffold header chips", () => {
  beforeEach(() => {
    mocks.viewport = "compact";
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
    expect(screen.getByRole("heading", { level: 1, name: "测试列表" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /全部/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /待处理/ })).not.toBeInTheDocument();
  });

  it("keeps actionable chips as buttons", () => {
    const onClick = vi.fn();
    renderScaffold([{ key: "active", label: "处理中", shortLabel: "中", onClick }]);

    fireEvent.click(screen.getByRole("button", { name: /处理中/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the opt-in underline navigation with full labels and its contextual target", () => {
    const onClick = vi.fn();
    render(
      <SidebarProvider>
        <RepairOsListScaffold
          title="客户管理"
          chipsVariant="underline"
          chipsLabel="客户分组"
          chips={[
            { key: "all", label: "全部", shortLabel: "全", count: 128, active: true, onClick },
            { key: "active", label: "处理中", shortLabel: "修", count: 7, onClick },
            { key: "unpaid", label: "待收款", shortLabel: "款", count: 3, onClick },
            { key: "followup", label: "要跟进", shortLabel: "跟", count: 4, onClick },
          ]}
        >
          <div>内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    const navigation = screen.getByRole("group", { name: "客户分组" });
    const all = screen.getByRole("button", { name: "全部，128" });
    expect(navigation).toHaveAttribute("data-ui", "repair-os-header-underline-nav");
    expect(all).toHaveClass("h-11");
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("99+")).toBeVisible();
    expect(screen.queryByText("修")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "处理中，7" }));
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
          <div data-testid="content">内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    const searchContainer = screen.getByRole("textbox", { name: "搜索标题或正文" }).parentElement;
    expect(screen.getByTestId("content").parentElement).toHaveAttribute(
      "data-ui",
      "repair-os-list-content",
    );
    expect(
      screen.getByTestId("content").closest('[data-ui="repair-os-list-scaffold"]'),
    ).not.toBeNull();
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

  it("keeps Chinese defaults and supports localized search and filter overrides", () => {
    const { unmount } = render(
      <SidebarProvider>
        <RepairOsListScaffold title="测试列表" searchValue="Mario" onSearchChange={() => undefined}>
          <div>内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    expect(screen.getByText("搜索：")).toBeVisible();
    expect(screen.getByRole("button", { name: "清除搜索" })).toBeVisible();
    expect(screen.getByRole("button", { name: "筛选" })).toBeVisible();
    unmount();

    render(
      <SidebarProvider>
        <RepairOsListScaffold
          title="Clienti"
          searchValue="Mario"
          searchPrefix="Ricerca:"
          clearSearchLabel="Cancella ricerca"
          filterLabel="Filtri"
          onSearchChange={() => undefined}
        >
          <div>Contenuto</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );

    expect(screen.getByText("Ricerca:")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancella ricerca" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Filtri" })).toBeVisible();
  });

  it("keeps the preparing status default and accepts an explicit override", () => {
    mocks.viewport = "pending";
    const { unmount } = render(
      <SidebarProvider>
        <RepairOsListScaffold title="测试列表">
          <div>内容</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在准备测试列表");
    unmount();

    render(
      <SidebarProvider>
        <RepairOsListScaffold title="Clienti" preparingStatus="Preparazione clienti">
          <div>Contenuto</div>
        </RepairOsListScaffold>
      </SidebarProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Preparazione clienti");
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
