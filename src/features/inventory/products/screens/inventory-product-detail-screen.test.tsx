import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryProductDetail } from "@/lib/repairdesk/types";

const apiMocks = vi.hoisted(() => ({ getInventoryProduct: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
const shellMocks = vi.hoisted(() => ({
  value: {
    isLoading: false,
    activeStore: { id: "store-1" },
    permissions: {
      canReadInventory: true,
      canUpdateInventory: true,
      inventoryProductsUiEnabled: true,
    },
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getInventoryProduct: apiMocks.getInventoryProduct,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));

import { InventoryProductDetailScreen } from "./inventory-product-detail-screen";

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = {
    isLoading: false,
    activeStore: { id: "store-1" },
    permissions: {
      canReadInventory: true,
      canUpdateInventory: true,
      inventoryProductsUiEnabled: true,
    },
  };
  apiMocks.getInventoryProduct.mockResolvedValue(productFixture());
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

describe("InventoryProductDetailScreen icon workbench", () => {
  it("renders only real product data in the selected workbench layout", async () => {
    renderScreen();

    expect(
      await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "设备工作台" })).toBeVisible();
    expect(screen.getByText("6 项资料")).toBeVisible();
    for (const value of ["256 GB", "8 GB", "Natural Titanium", "A", "12 个月", "EU 双卡"]) {
      expect(screen.getByText(value)).toBeVisible();
    }
    expect(screen.getByRole("heading", { name: "设备身份" })).toBeVisible();
    const identitySection = screen.getByRole("heading", { name: "设备身份" }).closest("section");
    expect(identitySection).not.toBeNull();
    expect(within(identitySection!).getByText("•••• 4321")).toBeVisible();
    expect(within(identitySection!).getByText("•••• AB9C")).toBeVisible();
    expect(screen.getAllByText("•••• 4321")).toHaveLength(2);
    expect(screen.queryByText("•••• 9999")).not.toBeInTheDocument();
    expect(screen.queryByText("356789012344321")).not.toBeInTheDocument();
    expect(screen.queryByText("激活锁")).not.toBeInTheDocument();
    expect(screen.queryByText("功能正常")).not.toBeInTheDocument();
  });

  it("keeps a legacy masked identifier visible when no V2 identifier rows exist", async () => {
    apiMocks.getInventoryProduct.mockResolvedValue(
      productFixture({ identifiers: [], masked_identifier: "•••• 7788" }),
    );
    renderScreen();

    await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" });
    const identitySection = screen.getByRole("heading", { name: "设备身份" }).closest("section");
    expect(identitySection).not.toBeNull();
    expect(within(identitySection!).getByText("•••• 7788")).toBeVisible();
    expect(screen.getAllByText("•••• 7788")).toHaveLength(2);
  });

  it("omits protected cost and absent fields without inventing placeholders", async () => {
    apiMocks.getInventoryProduct.mockResolvedValue(
      productFixture({
        cost_amount: undefined,
        finance_redacted: true,
        condition: undefined,
        warranty_months: undefined,
        specifications: {},
      }),
    );
    renderScreen();

    await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" });
    expect(screen.queryByText("成本")).not.toBeInTheDocument();
    expect(screen.queryByText("成色")).not.toBeInTheDocument();
    expect(screen.queryByText("保修")).not.toBeInTheDocument();
    expect(screen.queryByText("未录入")).not.toBeInTheDocument();
    expect(screen.getByText("3 项资料")).toBeVisible();
  });

  it("keeps sold products readable but removes every edit action", async () => {
    apiMocks.getInventoryProduct.mockResolvedValue(productFixture({ status: "sold" }));
    renderScreen();

    await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" });
    expect(screen.getAllByText("已售").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "编辑商品" })).not.toBeInTheDocument();
  });

  it("does not request or render product data without read permission", async () => {
    shellMocks.value.permissions.canReadInventory = false;
    renderScreen();

    expect(screen.getByRole("heading", { name: "无法查看商品" })).toBeVisible();
    await waitFor(() => expect(apiMocks.getInventoryProduct).not.toHaveBeenCalled());
    expect(screen.queryByText("Apple iPhone 15 Pro")).not.toBeInTheDocument();
  });
});

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InventoryProductDetailScreen id="product-1" />
    </QueryClientProvider>,
  );
}

function productFixture(overrides: Partial<InventoryProductDetail> = {}): InventoryProductDetail {
  return {
    id: "product-1",
    sku: "I001501",
    category: "phone",
    brand: "Apple",
    model: "iPhone 15 Pro",
    specification: "256 GB · Natural Titanium",
    masked_identifier: "•••• 9999",
    status: "in_stock",
    location: "展柜 A",
    list_price: 899,
    currency_code: "EUR",
    updated_at: "2026-07-30T08:00:00.000Z",
    color: "Natural Titanium",
    ram_capacity: "8 GB",
    storage_capacity: "256 GB",
    gtin: "0195949012345",
    condition: "A",
    specifications: { network_variant: "EU 双卡" },
    identifiers: [
      { kind: "imei1", masked_value: "•••• 4321", primary: true },
      { kind: "serial", masked_value: "•••• AB9C", primary: false },
    ],
    cost_amount: 610,
    warranty_months: 12,
    notes: "配件齐全",
    created_at: "2026-07-29T08:00:00.000Z",
    version: 2,
    ...overrides,
  };
}
