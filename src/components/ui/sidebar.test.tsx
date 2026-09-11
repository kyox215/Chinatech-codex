import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";

import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "./sidebar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SidebarProvider responsive state", () => {
  it("marks the first desktop render so the scheme-three drawer CSS suppresses the transient rail", () => {
    const html = renderToString(
      <SidebarProvider>
        <Sidebar>导航</Sidebar>
      </SidebarProvider>,
    );

    expect(html).toContain('data-sidebar-controlled="false"');
    expect(html).toContain('data-sidebar-viewport-ready="false"');
    expect(html).toContain("rd-compact-workspace-desktop-sidebar");
  });

  it("uses the drawer workspace at 834px", async () => {
    setViewport(834);
    render(
      <SidebarProvider>
        <Sidebar>导航</Sidebar>
        <SidebarStateProbe />
      </SidebarProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-mobile", "true"),
    );
  });

  it("starts compact at 1024px and still allows explicit expansion", async () => {
    setViewport(1024);
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <SidebarStateProbe />
      </SidebarProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-state", "collapsed"),
    );
    await user.click(screen.getByRole("button", { name: "展开侧边栏" }));
    expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-state", "expanded");
  });

  it.each([
    [900, "true", "expanded"],
    [901, "false", "collapsed"],
    [1200, "false", "collapsed"],
    [1201, "false", "expanded"],
  ])(
    "uses prototype navigation boundaries at %ipx without changing business viewport hooks",
    async (width, mobile, state) => {
      setViewport(Number(width));
      render(
        <SidebarProvider>
          <SidebarStateProbe />
        </SidebarProvider>,
      );
      await waitFor(() => {
        expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-mobile", String(mobile));
        expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-state", String(state));
      });
    },
  );

  it("preserves a controlled expanded sidebar at 1024px", async () => {
    setViewport(1024);
    const { container } = render(
      <SidebarProvider open>
        <SidebarStateProbe />
      </SidebarProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-state", "expanded"),
    );
    expect(container.querySelector("[data-sidebar-controlled='true']")).toBeInTheDocument();
  });

  it("renders without matchMedia, responds to resize, and removes its fallback listener", async () => {
    setViewport(930);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <SidebarProvider>
        <SidebarStateProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-mobile", "false");
    const listener = add.mock.calls.find(([type]) => type === "resize")?.[1];
    expect(listener).toBeTypeOf("function");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    fireEvent(window, new Event("resize"));
    await waitFor(() =>
      expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-mobile", "true"),
    );
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", listener);
  });

  it("supports legacy media listeners and cleans them up", () => {
    setViewport(820);
    const addListener = vi.fn();
    const removeListener = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: true, addListener, removeListener }),
    });
    const { unmount } = render(
      <SidebarProvider>
        <SidebarStateProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("sidebar-state")).toHaveAttribute("data-mobile", "true");
    const listener = addListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf("function");
    unmount();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it("localizes the mobile navigation trigger and drawer name", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(
      <LocaleProvider initialLocale="en">
        <SidebarProvider>
          <SidebarTrigger />
          <Sidebar>Navigation</Sidebar>
        </SidebarProvider>
      </LocaleProvider>,
    );

    const trigger = await screen.findByRole("button", { name: "Open navigation menu" });
    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Navigation menu" })).toBeVisible();
  });

  it("closes the drawer with Escape or its visible close control and restores the opener", async () => {
    setViewport(820);
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <Sidebar>导航</Sidebar>
      </SidebarProvider>,
    );
    const trigger = await screen.findByRole("button", { name: "打开导航菜单" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("button", { name: "关闭" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("hands off a drawer action only after closing and releasing focus", async () => {
    setViewport(390);
    const user = userEvent.setup();
    const afterClose = vi.fn();
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <Sidebar>
          <DrawerAction afterClose={afterClose} />
        </Sidebar>
      </SidebarProvider>,
    );
    const trigger = await screen.findByRole("button", { name: "打开导航菜单" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "打开搜索" }));
    await waitFor(() => expect(afterClose).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog", { name: "导航菜单" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });
});

function DrawerAction({ afterClose }: { afterClose: () => void }) {
  const { closeMobileSidebar } = useSidebar();
  return <button onClick={() => closeMobileSidebar(afterClose)}>打开搜索</button>;
}

describe("SidebarInset landmark ownership", () => {
  it("keeps the shell inset as a layout div so Providers owns the sole main", () => {
    const { container } = render(
      <SidebarInset data-testid="sidebar-inset">
        <main>content</main>
      </SidebarInset>,
    );

    expect(screen.getByTestId("sidebar-inset").tagName).toBe("DIV");
    expect(container.querySelectorAll("main")).toHaveLength(1);
  });
});

function SidebarStateProbe() {
  const { state, isMobile } = useSidebar();
  return <output data-testid="sidebar-state" data-state={state} data-mobile={isMobile} />;
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => {
      const maxWidth = /max-width:\s*(\d+)px/.exec(query)?.[1];
      const minWidth = /min-width:\s*(\d+)px/.exec(query)?.[1];
      const matches =
        (maxWidth === undefined || width <= Number(maxWidth)) &&
        (minWidth === undefined || width >= Number(minWidth));
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } satisfies MediaQueryList;
    }),
  });
}
