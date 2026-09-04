import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const apiMocks = vi.hoisted(() => ({ listInventoryProducts: vi.fn() }));
const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));
const shellMocks = vi.hoisted(() => ({ value: {} as ReturnType<typeof shellContext> }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
  useSearchParams: () => routerMocks.searchParams,
}));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  listInventoryProducts: apiMocks.listInventoryProducts,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("../components/inventory-product-create-dialog", () => ({
  InventoryProductCreateDialog: () => null,
}));

import { InventoryProductListScreen } from "./inventory-product-list-screen";

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.searchParams = new URLSearchParams();
  shellMocks.value = shellContext();
  apiMocks.listInventoryProducts.mockResolvedValue(productResult());
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  window.localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InventoryProductListScreen i18n", () => {
  it.each([
    ["zh-CN", "商品库存", "搜索商品、SKU、型号", "快速录入商品", "手机"],
    [
      "it-IT",
      "Inventario prodotti",
      "Cerca marca, modello, SKU o posizione",
      "Nuovo prodotto",
      "Telefono",
    ],
    ["en", "Product inventory", "Search brand, model, SKU, or location", "New product", "Phone"],
  ] as const)(
    "localizes stable list chrome in %s and preserves product facts",
    async (locale, title, searchLabel, createLabel, categoryLabel) => {
      const { container } = renderList(locale);

      expect(await findVisibleHeading(title)).toBeVisible();
      expect(await screen.findByText("SKU SKU-动态-001")).toBeVisible();
      expect(screen.getAllByLabelText(searchLabel).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: createLabel }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: categoryLabel }).length).toBeGreaterThan(0);
      for (const value of [
        "动态品牌 Ω",
        "Modello 客制",
        "SKU-动态-001",
        "展柜 客制-9",
        "•••• 2345",
        "Custom 朱红",
      ]) {
        expect(container.textContent).toContain(value);
      }
      expect(apiMocks.listInventoryProducts).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["zh-CN", "商品库存暂不可用", "你没有查看商品库存的权限。"],
    [
      "it-IT",
      "Inventario prodotti non disponibile",
      "Non hai il permesso di visualizzare l'inventario prodotti.",
    ],
    [
      "en",
      "Product inventory unavailable",
      "You do not have permission to view product inventory.",
    ],
  ] as const)(
    "localizes no-access and performs zero requests in %s",
    async (locale, title, body) => {
      shellMocks.value = shellContext({ canReadInventory: false });
      renderList(locale);

      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(screen.getByText(body)).toBeVisible();
      await waitFor(() => expect(apiMocks.listInventoryProducts).not.toHaveBeenCalled());
    },
  );

  it("keeps URL query input and requests stable while switching locale", async () => {
    renderList("en", true);
    expect(await findVisibleHeading("Product inventory")).toBeVisible();
    expect(apiMocks.listInventoryProducts).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "switch-locale" }));
    expect(await findVisibleHeading("Inventario prodotti")).toBeVisible();
    expect(apiMocks.listInventoryProducts).toHaveBeenCalledTimes(1);
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("preserves search, filters, view, focus, scroll and canonical reads during locale switch", async () => {
    routerMocks.searchParams = new URLSearchParams("page=2&scope=dynamic");
    const { container } = renderList("en", true);
    await findVisibleHeading("Product inventory");

    const searchInputs = screen.getAllByLabelText(
      translateMessage("en", "inventory2b4.list.search"),
    );
    fireEvent.change(searchInputs[0], { target: { value: "SKU-动态-001" } });
    fireEvent.click(
      screen.getAllByRole("button", {
        name: translateMessage("en", "inventory2b4.list.view.listAria"),
      })[0]!,
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: translateMessage("en", "inventory2b4.list.filterProducts"),
      })[0]!,
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "动态品牌 Ω" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: translateMessage("en", "inventory2b4.list.applyFilters"),
      }),
    );

    await waitFor(() =>
      expect(apiMocks.listInventoryProducts.mock.calls.length).toBeGreaterThan(1),
    );
    await waitFor(() =>
      expect(window.localStorage.getItem("repairdesk.inventory.product-view")).toBe("list"),
    );
    const callsBeforeSwitch = apiMocks.listInventoryProducts.mock.calls.length;
    const canonicalLastRead = apiMocks.listInventoryProducts.mock.calls.at(-1);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 91 });
    searchInputs[0]!.focus();

    fireEvent.click(screen.getByRole("button", { name: "switch-locale" }));

    expect(await findVisibleHeading("Inventario prodotti")).toBeVisible();
    expect(screen.getByDisplayValue("SKU-动态-001")).toBe(searchInputs[0]);
    expect(document.activeElement).toBe(searchInputs[0]);
    expect(window.scrollY).toBe(91);
    expect(routerMocks.searchParams.toString()).toBe("page=2&scope=dynamic");
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(apiMocks.listInventoryProducts).toHaveBeenCalledTimes(callsBeforeSwitch);
    expect(apiMocks.listInventoryProducts.mock.calls.at(-1)).toEqual(canonicalLastRead);
    expect(container.textContent).toContain("SKU-动态-001");
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "exposes localized filter-sheet and pressed/live-region state in %s",
    async (locale) => {
      renderList(locale);
      await findVisibleHeading(translateMessage(locale, "inventory2b4.list.title"));

      const listView = screen.getAllByRole("button", {
        name: translateMessage(locale, "inventory2b4.list.view.listAria"),
      })[0]!;
      expect(listView).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(listView);
      expect(listView).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(
        screen.getAllByRole("button", {
          name: translateMessage(locale, "inventory2b4.list.filterProducts"),
        })[0]!,
      );
      const sheet = await screen.findByRole("dialog", {
        name: translateMessage(locale, "inventory2b4.list.filterProducts"),
      });
      expect(sheet).toHaveAccessibleDescription(
        translateMessage(locale, "inventory2b4.list.filterDescription"),
      );
      fireEvent.click(within(sheet).getByRole("checkbox", { name: "动态品牌 Ω" }));
      fireEvent.click(
        within(sheet).getByRole("button", {
          name: translateMessage(locale, "inventory2b4.list.applyFilters"),
        }),
      );

      const applied = await screen.findByText(
        translateMessage(locale, "inventory2b4.list.filtersApplied", { count: 1 }),
      );
      expect(applied.parentElement).toHaveAttribute("aria-live", "polite");
      expect(
        screen.getAllByRole("button", {
          name: translateMessage(locale, "inventory2b4.list.filterAppliedAria", { count: 1 }),
        }).length,
      ).toBeGreaterThan(0);
    },
  );

  it.each([
    ["zh-CN", "当前分类暂无商品", "没有符合条件的商品"],
    ["it-IT", "Nessun prodotto in questa categoria", "Nessun prodotto corrispondente"],
    ["en", "No products in this category", "No matching products"],
  ] as const)(
    "distinguishes category-empty and filtered-empty live states in %s",
    async (locale, categoryEmpty, filteredEmpty) => {
      apiMocks.listInventoryProducts.mockResolvedValue(productResult([]));
      const { unmount } = renderList(locale);
      fireEvent.click(
        screen.getAllByRole("button", {
          name: locale === "zh-CN" ? "手机" : locale === "it-IT" ? "Telefono" : "Phone",
        })[0]!,
      );
      expect(await screen.findByRole("heading", { name: categoryEmpty })).toBeVisible();
      unmount();

      renderList(locale);
      fireEvent.change(
        screen.getAllByLabelText(translateMessage(locale, "inventory2b4.list.search"))[0]!,
        { target: { value: "NO-MATCH" } },
      );
      expect(await screen.findByRole("heading", { name: filteredEmpty })).toBeVisible();
    },
  );

  it.each([
    ["zh-CN", "还没有商品"],
    ["it-IT", "Nessun prodotto in inventario"],
    ["en", "No inventory products yet"],
  ] as const)("localizes the empty state in %s", async (locale, title) => {
    apiMocks.listInventoryProducts.mockResolvedValue(productResult([]));
    renderList(locale);
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
  });

  it.each([
    ["zh-CN", "正在加载商品库存"],
    ["it-IT", "Caricamento inventario prodotti"],
    ["en", "Loading product inventory"],
  ] as const)("localizes the loading state in %s", async (locale, label) => {
    apiMocks.listInventoryProducts.mockReturnValue(new Promise(() => undefined));
    renderList(locale);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it.each([
    ["zh-CN", "商品库存加载失败", "重试"],
    ["it-IT", "Impossibile caricare l'inventario prodotti", "Riprova"],
    ["en", "Product inventory failed to load", "Retry"],
  ] as const)(
    "localizes safe load failure and refetch in %s",
    async (locale, title, retryLabel) => {
      apiMocks.listInventoryProducts
        .mockRejectedValueOnce(new Error("RAW-LIST-SENTINEL"))
        .mockRejectedValueOnce(new Error("RAW-LIST-SENTINEL"))
        .mockResolvedValue(productResult([]));
      renderList(locale);

      expect(await screen.findByRole("heading", { name: title }, { timeout: 3_000 })).toBeVisible();
      expect(screen.queryByText(/RAW-LIST-SENTINEL/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: retryLabel }));
      await waitFor(() => expect(apiMocks.listInventoryProducts).toHaveBeenCalledTimes(3));
    },
  );
});

function renderList(locale: AppLocale, withSwitcher = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        <SidebarProvider>
          {withSwitcher ? <LocaleTestSwitcher /> : null}
          <InventoryProductListScreen />
        </SidebarProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

async function findVisibleHeading(name: string) {
  const headings = await screen.findAllByRole("heading", { name });
  const visible = headings.find((heading) => !heading.classList.contains("sr-only"));
  if (!visible) throw new Error(`Expected one visible heading named ${name}`);
  return visible;
}

function LocaleTestSwitcher() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("it-IT")}>
      switch-locale
    </button>
  );
}

function productResult(items = [product()]) {
  return {
    items,
    total: items.length,
    facets: { brands: ["动态品牌 Ω"], locations: ["展柜 客制-9"] },
  };
}

function product() {
  return {
    id: "product-dynamic-1",
    sku: "SKU-动态-001",
    category: "phone" as const,
    brand: "动态品牌 Ω",
    model: "Modello 客制",
    color: "Custom 朱红",
    specification: "Spec 动态值",
    masked_identifier: "•••• 2345",
    status: "in_stock" as const,
    location: "展柜 客制-9",
    list_price: 420,
    currency_code: "EUR" as const,
    updated_at: "2026-10-25T01:30:00.000Z",
  };
}

function shellContext(permissionOverrides: Record<string, boolean> = {}) {
  return {
    isLoading: false,
    activeStore: { id: "store-1" },
    authorityFingerprint: "store-1:owner",
    permissions: {
      canReadInventory: true,
      canCreateInventory: true,
      canUpdateInventory: true,
      canAllocateInventoryCosts: true,
      inventoryProductsUiEnabled: true,
      inventoryProductQuickCreateEnabled: true,
      ...permissionOverrides,
    },
  };
}
