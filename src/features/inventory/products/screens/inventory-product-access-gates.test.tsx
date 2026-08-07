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

  it("renders a real thumbnail and falls back to the category icon after an image error", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ thumbnail_url: "https://private.example/thumb-token" })],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    const { queryClient } = renderWithQuery(<InventoryProductListScreen />);

    const image = await screen.findByAltText("Apple，iPhone 13，128GB，手机");
    expect(image).toHaveAttribute("src", "https://private.example/thumb-token");
    fireEvent.error(image);
    expect(await screen.findByText("暂无图片")).toBeVisible();

    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ thumbnail_url: "https://private.example/refreshed-thumb-token" })],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    await queryClient.refetchQueries();
    expect(await screen.findByAltText("Apple，iPhone 13，128GB，手机")).toHaveAttribute(
      "src",
      "https://private.example/refreshed-thumb-token",
    );
  });

  it("keeps a missing thumbnail usable with the category fallback", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    expect(await screen.findByText("暂无图片")).toBeVisible();
    expect(screen.getByRole("link", { name: /Apple iPhone 13/ })).toHaveAttribute(
      "href",
      "/inventory/product-1",
    );
  });

  it("uses fixed category buttons with aria-pressed and combines the selection with search filters", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
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
