import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getInventoryProduct: vi.fn(),
  readInventoryLifecycleSummary: vi.fn(),
  runInventoryLifecycleCommand: vi.fn(),
}));
const shellMocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getInventoryProduct: apiMocks.getInventoryProduct,
  readInventoryLifecycleSummary: apiMocks.readInventoryLifecycleSummary,
  runInventoryLifecycleCommand: apiMocks.runInventoryLifecycleCommand,
}));
vi.mock("@/features/stores/api/use-store-shell-context", () => ({
  useStoreShellContext: () => shellMocks.value,
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));

import { InventoryLifecycleReservationScreen } from "./inventory-lifecycle-reservation-screen";
import { InventoryLifecycleReadonlyScreen } from "./inventory-lifecycle-readonly-screen";
import { InventoryDeviceHealthCard } from "../components/inventory-lifecycle-status";

beforeEach(() => {
  vi.clearAllMocks();
  shellMocks.value = shellContext();
  apiMocks.getInventoryProduct.mockResolvedValue(productFixture);
  apiMocks.readInventoryLifecycleSummary.mockResolvedValue(summaryFixture);
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

describe("inventory lifecycle UI safety gates", () => {
  it("shows an unavailable state and does not request product data without permission", () => {
    shellMocks.value = shellContext({ canReadInventory: false });
    renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);

    expect(screen.getByRole("heading", { name: "无法开始预订" })).toBeVisible();
    expect(apiMocks.getInventoryProduct).not.toHaveBeenCalled();
  });

  it("keeps reservation submission disabled until server actions are projected", async () => {
    renderWithQuery(<InventoryLifecycleReservationScreen itemId="item-1" />);

    expect(await screen.findByText(/服务端尚未返回可用动作/)).toBeVisible();
    expect(screen.getByRole("button", { name: "确认预订" })).toBeDisabled();
    expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
  });

  it("renders independent read-only sales and after-sales routes without inventing data", () => {
    render(<InventoryLifecycleReadonlyScreen kind="sale" recordId="sale-1" />);

    expect(screen.getByRole("heading", { name: "销售详情" })).toBeVisible();
    expect(screen.getByText(/尚未提供销售订单详情/)).toBeVisible();
    expect(screen.getByText("写入保护")).toBeVisible();
  });

  it("shows an explicit untested state instead of converting an absent battery value to zero", () => {
    render(
      <InventoryDeviceHealthCard
        category="phone"
        brand="Apple"
        specifications={{ face_id_status: "normal" }}
      />,
    );

    expect(screen.getByText("电池健康")).toBeVisible();
    expect(screen.getAllByText("尚未检测").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

function shellContext(overrides: Record<string, boolean> = {}) {
  return {
    isLoading: false,
    activeStore: { id: "store-1" },
    authorityFingerprint: "store-1:owner",
    permissions: {
      canReadInventory: true,
      inventoryProductsUiEnabled: true,
      inventoryLifecycleUiEnabled: true,
      ...overrides,
    },
  };
}

const productFixture = {
  id: "item-1",
  sku: "I000001",
  category: "phone" as const,
  brand: "Apple",
  model: "iPhone 15 Pro",
  status: "in_stock" as const,
  currency_code: "EUR" as const,
  updated_at: "2026-08-01T08:00:00.000Z",
  list_price: 899,
  version: 2,
  identifiers: [],
  specifications: {},
};

const summaryFixture = {
  item_id: "item-1",
  stock_unit_id: "unit-1",
  sku: "I000001",
  business_status: "in_stock" as const,
  unit_version: 2,
  allowed_actions: [],
};
