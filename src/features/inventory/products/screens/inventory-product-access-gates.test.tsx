import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  createInventoryProduct: vi.fn(),
  getInventoryProductEditData: vi.fn(),
  listInventoryProducts: vi.fn(),
  updateInventoryProduct: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
const shellMocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  createInventoryProduct: apiMocks.createInventoryProduct,
  getInventoryProductEditData: apiMocks.getInventoryProductEditData,
  listInventoryProducts: apiMocks.listInventoryProducts,
  updateInventoryProduct: apiMocks.updateInventoryProduct,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));

import { InventoryProductEditScreen } from "./inventory-product-edit-screen";
import { InventoryProductIntakeScreen } from "./inventory-product-intake-screen";
import { InventoryProductListScreen } from "./inventory-product-list-screen";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  shellMocks.value = shellContext();
});

afterEach(() => cleanup());

describe("inventory product UI access gates", () => {
  it("does not request list data when the product UI flag is disabled", async () => {
    shellMocks.value = shellContext({ inventoryProductsUiEnabled: false });
    renderWithQuery(<InventoryProductListScreen />);

    expect(screen.getByRole("heading", { name: "商品库存暂不可用" })).toBeVisible();
    await waitFor(() => expect(apiMocks.listInventoryProducts).not.toHaveBeenCalled());
  });

  it("does not request full edit data when product UI access is unavailable", async () => {
    shellMocks.value = shellContext({ canUpdateInventory: false });
    renderWithQuery(<InventoryProductEditScreen id="product-1" />);

    expect(screen.getByRole("heading", { name: "无法编辑商品" })).toBeVisible();
    await waitFor(() => expect(apiMocks.getInventoryProductEditData).not.toHaveBeenCalled());
  });

  it("never flashes an editable intake form while authority is loading", () => {
    shellMocks.value = { ...shellContext(), isLoading: true };
    renderWithQuery(<InventoryProductIntakeScreen />);

    expect(screen.getByRole("heading", { name: "正在载入录入权限" })).toBeVisible();
    expect(screen.queryByLabelText("品牌")).not.toBeInTheDocument();
  });

  it("prioritizes a real thumbnail, then uses the local reference after an image error", async () => {
    const thumbnailUrl =
      "/api/repairdesk/inventory/product-thumbnails/00000000-0000-4000-8000-000000000501";
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ model: "iPhone 13", thumbnail_url: thumbnailUrl })],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    const { queryClient } = renderWithQuery(<InventoryProductListScreen />);

    const image = await screen.findByAltText("Apple，iPhone 13，128GB，手机");
    expect(image).toHaveAttribute("src", thumbnailUrl);
    fireEvent.error(image);
    expect(await screen.findByAltText("Apple iPhone 标准机型设备参考图")).toHaveAttribute(
      "src",
      "/inventory-reference/iphone-standard.webp",
    );
    expect(screen.getByText("参考图")).toBeVisible();

    const reference = screen.getByAltText("Apple iPhone 标准机型设备参考图");
    fireEvent.error(reference);
    expect(await screen.findByText("暂无图片")).toBeVisible();
    expect(screen.queryByAltText("Apple，iPhone 13，128GB，手机")).not.toBeInTheDocument();

    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [
        product({
          thumbnail_url:
            "/api/repairdesk/inventory/product-thumbnails/00000000-0000-4000-8000-000000000502",
        }),
      ],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    await queryClient.refetchQueries();
    expect(await screen.findByAltText("Apple，iPhone 13，128GB，手机")).toHaveAttribute(
      "src",
      "/api/repairdesk/inventory/product-thumbnails/00000000-0000-4000-8000-000000000502",
    );
  });

  it("rejects an external thumbnail URL before rendering and uses the local reference", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ thumbnail_url: "https://tracking.example/device.webp" })],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    expect(await screen.findByAltText("Apple iPhone 标准机型设备参考图")).toBeVisible();
    expect(document.querySelector('img[src^="https://tracking.example/"]')).toBeNull();
  });

  it("keeps a missing thumbnail usable with the category fallback", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ brand: "Samsung", model: "Galaxy S24" })],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    expect(await screen.findByText("暂无图片")).toBeVisible();
    expect(screen.getByRole("link", { name: /Samsung Galaxy S24/ })).toHaveAttribute(
      "href",
      "/inventory/product-1",
    );
  });

  it("falls through from a failed local reference to the category icon", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ model: "iPhone 13" })],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    const reference = await screen.findByAltText("Apple iPhone 标准机型设备参考图");
    fireEvent.error(reference);
    expect(await screen.findByText("暂无图片")).toBeVisible();
  });

  it("shows a color swatch without repeating the color inside the specification", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ color: "Blue", specification: "128 GB · Blue" })],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    expect(await screen.findByText("128 GB")).toBeVisible();
    expect(screen.queryByText("128 GB · Blue")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "颜色 蓝色" })).toBeVisible();
  });

  it("uses fixed category buttons with aria-pressed and combines the selection with search filters", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ brand: "Samsung", model: "Galaxy S24" })],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    await screen.findByText("暂无图片");
    const categoryGroups = document.querySelectorAll('[data-ui="inventory-product-category-tabs"]');
    const firstGroup = categoryGroups[0] as HTMLElement;
    const phoneButton = within(firstGroup).getByRole("button", { name: "手机" });
    const allButton = within(firstGroup).getByRole("button", { name: "全部" });
    expect(allButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(phoneButton);
    expect(phoneButton).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(apiMocks.listInventoryProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ categories: ["phone"] }),
        expect.anything(),
      ),
    );
  });

  it("offers shelf and compact list views with an SSR-safe local preference", async () => {
    window.localStorage.clear();
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ brand: "Samsung", model: "Galaxy S24" })],
      total: 1,
      facets: { brands: ["Samsung"], locations: ["A-02"] },
    });
    const { unmount } = renderWithQuery(<InventoryProductListScreen />);

    await screen.findByText("暂无图片");
    const toggle = screen.getByRole("group", { name: "商品列表视图" });
    const shelf = within(toggle).getByRole("button", { name: "智能货架视图" });
    const list = within(toggle).getByRole("button", { name: "紧凑列表视图" });
    expect(shelf).toHaveAttribute("aria-pressed", "true");
    expect(list).toHaveAttribute("aria-pressed", "false");
    expect(shelf).toHaveClass("min-h-11");
    fireEvent.click(list);
    await waitFor(() =>
      expect(document.querySelector('[data-inventory-product-view="list"]')).toBeTruthy(),
    );
    expect(window.localStorage.getItem("repairdesk.inventory.product-view")).toBe("list");
    unmount();

    window.localStorage.setItem("repairdesk.inventory.product-view", "invalid");
    renderWithQuery(<InventoryProductListScreen />);
    await screen.findByText("暂无图片");
    expect(document.querySelector('[data-inventory-product-view="shelf"]')).toBeTruthy();
  });
});

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    sku: "SKU-001",
    category: "phone" as const,
    brand: "Apple",
    model: "iPhone 13",
    specification: "128GB",
    masked_identifier: "•••• 2345",
    status: "in_stock" as const,
    location: "A-02",
    list_price: 420,
    currency_code: "EUR" as const,
    updated_at: "2026-08-07T10:00:00.000Z",
    ...overrides,
  };
}

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>),
    queryClient,
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
