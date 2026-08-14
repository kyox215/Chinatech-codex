import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryProductDetail } from "@/lib/repairdesk/types";
import { inventoryLifecycleKeys } from "@/features/inventory/lifecycle/api/query-keys";

const apiMocks = vi.hoisted(() => ({
  getInventoryProduct: vi.fn(),
  readInventoryLifecycleSummary: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
const shellMocks = vi.hoisted(() => ({
  value: {
    isLoading: false,
    activeStore: { id: "store-1" },
    permissions: {
      canReadInventory: true,
      canUpdateInventory: true,
      inventoryProductsUiEnabled: true,
      inventoryLifecycleUiEnabled: false,
    },
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMocks }));
vi.mock("@/lib/repairdesk/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repairdesk/api")>()),
  getInventoryProduct: apiMocks.getInventoryProduct,
  readInventoryLifecycleSummary: apiMocks.readInventoryLifecycleSummary,
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
      inventoryLifecycleUiEnabled: false,
    },
  };
  apiMocks.getInventoryProduct.mockResolvedValue(productFixture());
  apiMocks.readInventoryLifecycleSummary.mockResolvedValue(undefined);
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

describe("InventoryProductDetailScreen complete device profile", () => {
  it("renders the complete profile with stable core, health and business sections", async () => {
    renderScreen();

    expect(
      await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "设备工作台" })).toBeVisible();
    expect(screen.getByText("5 项核心资料")).toBeVisible();
    for (const value of ["256 GB", "8 GB", "Natural Titanium", "A", "EU 双卡"]) {
      expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("heading", { name: "设备检测" })).toBeVisible();
    expect(screen.getByText("电池健康")).toBeVisible();
    expect(screen.getByText("Face ID")).toBeVisible();
    expect(screen.getAllByText("未检测").length).toBeGreaterThan(0);
    expect(screen.getByText(/^检测时间：/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "经营信息" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "设备身份" })).toBeVisible();
    const identitySection = screen.getByRole("heading", { name: "设备身份" }).closest("details");
    expect(identitySection).not.toBeNull();
    expect(within(identitySection!).getByText("•••• 4321")).toBeVisible();
    expect(within(identitySection!).getByText("•••• AB9C")).toBeVisible();
    expect(screen.getAllByText("•••• 4321")).toHaveLength(1);
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
    const identitySection = screen.getByRole("heading", { name: "设备身份" }).closest("details");
    expect(identitySection).not.toBeNull();
    expect(within(identitySection!).getByText("•••• 7788")).toBeVisible();
    expect(screen.getAllByText("•••• 7788")).toHaveLength(1);
  });

  it("keeps rendering older responses that omit the identifiers collection", async () => {
    apiMocks.getInventoryProduct.mockResolvedValue({
      ...productFixture({ masked_identifier: "•••• 7788" }),
      identifiers: undefined,
    });
    renderScreen();

    await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" });
    expect(screen.getByText("•••• 7788")).toBeVisible();
  });

  it("keeps protected cost hidden while explaining missing editable fields", async () => {
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
    expect(screen.getByText("成色")).toBeVisible();
    expect(screen.getByText("保修")).toBeVisible();
    expect(screen.getAllByText("未录入").length).toBeGreaterThan(0);
    expect(screen.getByText("5 项核心资料")).toBeVisible();
  });

  it("keeps a sparse product understandable without hiding the profile", async () => {
    apiMocks.getInventoryProduct.mockResolvedValue(
      productFixture({
        list_price: undefined,
        location: undefined,
        color: undefined,
        ram_capacity: undefined,
        storage_capacity: undefined,
        condition: undefined,
        warranty_months: undefined,
        specifications: {},
        identifiers: [],
        gtin: undefined,
        notes: undefined,
        cost_amount: undefined,
        finance_redacted: true,
        inspection: undefined,
      }),
    );
    renderScreen();

    await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" });
    expect(screen.getAllByText("未定价").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未设置库位").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未录入").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("暂无备注。编辑商品时可补充检测结果、配件或售后说明。")).toBeVisible();
    expect(screen.getByRole("heading", { name: "设备检测" })).toBeVisible();
    expect(screen.getAllByText("未检测").length).toBeGreaterThan(0);
    expect(screen.getByText("检测时间：未检测")).toBeVisible();
    expect(screen.queryByText("成本")).not.toBeInTheDocument();
  });

  it("keeps sold products readable but removes every edit action", async () => {
    apiMocks.getInventoryProduct.mockResolvedValue(productFixture({ status: "sold" }));
    renderScreen();

    await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" });
    expect(screen.getAllByText("已售").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "编辑商品" })).not.toBeInTheDocument();
  });

  it("uses one server-driven after-sales action in the mobile dock", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({
        business_status: "after_sales",
        after_sales: {
          case_id: "case-1",
          sale_order_id: "sale-1",
          inventory_item_id: "product-1",
          status: "open",
          received_at: "2026-08-11T08:00:00.000Z",
          version: 1,
        },
        allowed_actions: ["after_sales.update"],
      }),
    );
    renderScreen();

    const actionButton = await screen.findByRole("button", { name: "继续处理售后" });
    expect(screen.getByRole("heading", { name: "关键里程碑（摘要）" })).toBeVisible();
    const dock = actionButton.closest("[data-ui='inventory-detail-action-dock']") as HTMLElement;
    expect(dock).not.toBeNull();
    expect(within(dock).getByRole("button", { name: "继续处理售后" })).toBeVisible();
    expect(within(dock).getAllByRole("button")).toHaveLength(1);
    const summaryCard = screen
      .getByRole("heading", { name: "当前业务" })
      .closest("[data-ui='inventory-lifecycle-summary']");
    expect(summaryCard).not.toBeNull();
    const desktopSummaryAction = within(summaryCard! as HTMLElement).getByRole("link", {
      name: "继续处理售后",
    });
    expect(desktopSummaryAction).toHaveClass("max-lg:hidden");
    expect(document.querySelectorAll("[data-ui='inventory-detail-action-dock']")).toHaveLength(1);
  });

  it("shows a disabled loading status without flashing edit", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockReturnValue(new Promise(() => undefined));
    renderScreen();

    const loadingText = await screen.findByText("正在读取下一动作");
    const dock = loadingText.closest("[data-ui='inventory-detail-action-dock']") as HTMLElement;
    expect(dock).not.toBeNull();
    expect(dock).toHaveAttribute("role", "status");
    expect(dock).toHaveAttribute("aria-busy", "true");
    expect(within(dock).getByText("正在读取下一动作")).toBeVisible();
    expect(within(dock).queryByRole("button", { name: "编辑商品" })).not.toBeInTheDocument();
  });

  it("focuses the inspection editor when inspection.save is the next action", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({
        allowed_actions: ["inspection.save"],
      }),
    );
    renderScreen();

    await screen.findByRole("heading", { name: "录入设备检测" });
    const dock = document.querySelector<HTMLElement>("[data-ui='inventory-detail-action-dock']");
    expect(dock).not.toBeNull();
    const editor = document.querySelector<HTMLElement>("[data-ui='inventory-inspection-editor']");
    expect(editor).not.toBeNull();
    const scrollIntoView = vi.fn();
    editor!.scrollIntoView = scrollIntoView;
    const actionButton = within(dock!).getByRole("button", { name: "补齐设备检测" });
    expect(actionButton).toBeVisible();
    actionButton.click();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(editor);
    expect(screen.getByRole("heading", { name: "录入设备检测" })).toBeVisible();
  });

  it("uses exact projection actions for both the dock and inspection editor", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({
        allowed_actions: ["reservation.create"],
        projection: {
          mode: "exact",
          status: "in_stock",
          confidence: "high",
          needs_review: false,
          allowed_actions: ["inspection.save"],
        },
      }),
    );
    renderScreen();

    await screen.findByRole("heading", { name: "录入设备检测" });
    const dock = document.querySelector<HTMLElement>("[data-ui='inventory-detail-action-dock']");
    expect(dock).not.toBeNull();
    expect(within(dock!).getByRole("button", { name: "补齐设备检测" })).toBeVisible();
  });

  it("does not render the inspection editor when exact projection removes inspection.save", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({
        allowed_actions: ["inspection.save"],
        projection: {
          mode: "exact",
          status: "in_stock",
          confidence: "high",
          needs_review: false,
          allowed_actions: [],
        },
      }),
    );
    renderScreen();

    await screen.findByRole("heading", { name: "当前业务" });
    expect(screen.getByRole("heading", { name: "服务端未提供可执行动作" })).toBeVisible();
    const dock = document.querySelector<HTMLElement>("[data-ui='inventory-detail-action-dock']");
    expect(dock).toBeNull();
    expect(screen.queryByRole("heading", { name: "录入设备检测" })).not.toBeInTheDocument();
  });

  it("does not expose cached lifecycle actions after a background read is rejected", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <InventoryProductDetailScreen id="product-1" />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: "录入设备检测" });
    apiMocks.readInventoryLifecycleSummary.mockRejectedValueOnce(new Error("forbidden"));
    await queryClient.refetchQueries({
      queryKey: inventoryLifecycleKeys.summary("product-1", "store-1"),
    });
    await screen.findByText("商品生命周期暂不可用");
    expect(screen.queryByRole("heading", { name: "当前业务" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "录入设备检测" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "补齐设备检测" })).not.toBeInTheDocument();
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
    inspection: {
      id: "inspection-1",
      battery_health: null,
      face_id_status: "not_tested",
      inspected_at: "2026-07-29T08:00:00.000Z",
    },
    created_at: "2026-07-29T08:00:00.000Z",
    version: 2,
    ...overrides,
  };
}

function lifecycleSummaryFixture(
  overrides: Partial<import("@/lib/repairdesk/types").InventoryLifecycleListSummary> = {},
) {
  return {
    item_id: "product-1",
    stock_unit_id: "unit-1",
    sku: "I001501",
    business_status: "in_stock" as const,
    unit_version: 3,
    allowed_actions: [] as const,
    after_sales: undefined,
    ...overrides,
  };
}
