import { render, screen, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/inventory") }));

import {
  InventoryLifecycleLoadingCard,
  InventoryLifecyclePageShell,
} from "./inventory-lifecycle-page-shell";

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/inventory");
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

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes shell navigation and loading while preserving caller-owned context in %s",
    (locale) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <InventoryLifecyclePageShell
            title="DYNAMIC-PRODUCT-TITLE"
            context="DYNAMIC-SKU-CONTEXT"
            onBack={vi.fn()}
          >
            <InventoryLifecycleLoadingCard />
          </InventoryLifecyclePageShell>
        </LocaleProvider>,
      );

      expect(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.detail.back"),
        }),
      ).toBeVisible();
      expect(screen.getByRole("heading", { name: "DYNAMIC-PRODUCT-TITLE" })).toBeVisible();
      expect(screen.getByText("DYNAMIC-SKU-CONTEXT")).toBeVisible();
      expect(
        document.querySelector("[data-ui='inventory-lifecycle-page'] section[role='status']"),
      ).toHaveTextContent(translateMessage(locale, "inventory2b4.lifecycle.loading"));
    },
  );

  it("uses the flexible desktop entity grid without changing the collection header grid", () => {
    vi.mocked(usePathname).mockReturnValue("/inventory/product_release_2b4/sell");
    const { rerender } = render(
      <InventoryLifecyclePageShell
        title="Crea prenotazione per la vendita"
        status={<span>STATUS</span>}
        onBack={vi.fn()}
      >
        <div>CONTENT</div>
      </InventoryLifecyclePageShell>,
    );

    const entityHeader = document.querySelector("[data-ui='inventory-lifecycle-header-nav']");
    expect(entityHeader).toHaveClass("grid-cols-[36px_minmax(0,1fr)_auto]");
    expect(entityHeader).toHaveClass("lg:grid-cols-[minmax(0,1fr)_auto]");
    expect(screen.getByRole("button", { name: "返回商品库存" })).toHaveClass("lg:hidden");
    expect(screen.getByRole("heading", { name: "Crea prenotazione per la vendita" })).toHaveClass(
      "lg:whitespace-normal",
      "lg:overflow-visible",
    );

    vi.mocked(usePathname).mockReturnValue("/inventory/after-sales");
    rerender(
      <InventoryLifecyclePageShell
        title="Post-vendita"
        status={<span>STATUS</span>}
        onBack={vi.fn()}
      >
        <div>CONTENT</div>
      </InventoryLifecyclePageShell>,
    );

    const collectionHeader = document.querySelector("[data-ui='inventory-lifecycle-header-nav']");
    expect(collectionHeader).toHaveClass("grid-cols-[36px_minmax(0,1fr)_auto]");
    expect(collectionHeader).not.toHaveClass("lg:grid-cols-[minmax(0,1fr)_auto]");
    expect(screen.getByRole("button", { name: "返回商品库存" })).not.toHaveClass("lg:hidden");
  });
});
