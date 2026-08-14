import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/inventory") }));

import {
  InventoryLifecycleLoadingCard,
  InventoryLifecyclePageShell,
} from "./inventory-lifecycle-page-shell";

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("max-width") ? false : true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InventoryLifecycleLoadingCard", () => {
  it("announces loading while keeping the skeleton busy", () => {
    render(<InventoryLifecycleLoadingCard />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("keeps one visible desktop H1 in the shared lifecycle shell", async () => {
    render(
      <InventoryLifecyclePageShell title="生命周期" onBack={() => undefined}>
        <div>内容</div>
      </InventoryLifecyclePageShell>,
    );

    const heading = await screen.findByRole("heading", { level: 1, name: "生命周期" });
    await waitFor(() => expect(heading).toBeVisible());
    expect(screen.getAllByRole("heading", { level: 1, name: "生命周期" })).toHaveLength(1);
  });
});
