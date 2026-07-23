import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from "./sidebar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SidebarProvider responsive state", () => {
  it("marks the first desktop render so 768-1023 CSS can suppress the transient rail", () => {
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
