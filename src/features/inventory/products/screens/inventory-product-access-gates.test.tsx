import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

const apiMocks = vi.hoisted(() => ({
  createInventoryProduct: vi.fn(),
  getInventoryProductEditData: vi.fn(),
  listInventoryProducts: vi.fn(),
  updateInventoryProduct: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));
const shellMocks = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
  useSearchParams: () => routerMocks.searchParams,
}));
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
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
  setViewport(1024);
  routerMocks.searchParams = new URLSearchParams();
  window.localStorage.clear();
  shellMocks.value = shellContext();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("inventory product UI access gates", () => {
  it("keeps focus off form controls when the create dialog opens on mobile", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(
      <SidebarProvider>
        <InventoryProductListScreen />
      </SidebarProvider>,
    );

    await screen.findByText("SKU SKU-001");
    setViewport(390);
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);

    const dialog = await screen.findByRole("dialog");
    const brand = await within(dialog).findByLabelText(/品牌/);
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(brand).not.toHaveFocus();
    expect(dialog.querySelector("input:focus, textarea:focus, select:focus")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭商品录入弹窗" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("retains brand autofocus on desktop and restores the visible create trigger on close", async () => {
    setViewport(1280);
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(
      <SidebarProvider>
        <InventoryProductListScreen />
      </SidebarProvider>,
    );

    await screen.findByText("SKU SKU-001");
    const trigger = screen.getAllByRole("button", { name: "快速录入商品" })[0];
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 44,
      height: 40,
      left: 4,
      right: 44,
      top: 4,
      width: 40,
      x: 4,
      y: 4,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    const brand = await within(dialog).findByLabelText(/品牌/);
    await waitFor(() => expect(brand).toHaveFocus());

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭商品录入弹窗" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

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

  it("opens product intake in one controlled dialog and protects a dirty draft", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(<InventoryProductListScreen />);

    await screen.findByText("SKU SKU-001");
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);

    const dialog = await screen.findByRole("dialog");
    const brand = await within(dialog).findByLabelText(/品牌/);
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      within(dialog).queryByRole("button", { name: "摄像头扫码录入 IMEI 1" }),
    ).not.toBeInTheDocument();

    fireEvent.change(brand, { target: { value: "Apple" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭商品录入弹窗" }));
    expect(screen.getByRole("heading", { name: "放弃本次未保存商品？" })).toBeVisible();
    expect(brand.closest("[inert]")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("dialog")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "继续填写" }));
    expect(within(dialog).getByLabelText(/品牌/)).toHaveValue("Apple");
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭商品录入弹窗" }));
    fireEvent.click(screen.getByRole("button", { name: "放弃并关闭" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens the same dialog from the route intent and fails closed without create capability", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    routerMocks.searchParams = new URLSearchParams("workspace=new-product");
    const firstRender = renderWithQuery(<InventoryProductListScreen />);
    expect(await screen.findByRole("dialog")).toBeVisible();
    firstRender.unmount();

    routerMocks.searchParams = new URLSearchParams("workspace=new-product");
    shellMocks.value = shellContext({ canCreateInventory: false });
    renderWithQuery(<InventoryProductListScreen />);
    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/inventory", { scroll: false }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "快速录入商品" })).not.toBeInTheDocument();
  });

  it("keeps the dialog open while a create result is pending", async () => {
    let resolveCreate: ((value: { id: string; sku: string }) => void) | undefined;
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    apiMocks.createInventoryProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderWithQuery(<InventoryProductListScreen />);
    await screen.findByText("SKU SKU-001");
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(within(dialog).getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存并查看商品" }));
    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭商品录入弹窗" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("正在保存商品，请等待结果后再关闭。")).toBeInTheDocument();

    resolveCreate?.({ id: "product-created", sku: "SKU-NEW" });
    await waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith("/inventory/product-created"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the stale dialog and clears its draft when store authority changes", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    const view = renderWithQuery(<InventoryProductListScreen />);
    await screen.findByText("SKU SKU-001");
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/品牌/), { target: { value: "Apple" } });

    shellMocks.value = {
      ...shellContext(),
      activeStore: { id: "store-2" },
      authorityFingerprint: "store-2:owner",
    };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <InventoryProductListScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);
    const freshDialog = await screen.findByRole("dialog");
    expect(within(freshDialog).getByLabelText(/品牌/)).toHaveValue("");
  });

  it("ignores a stale create result after authority changes while saving", async () => {
    let resolveCreate: ((value: { id: string; sku: string }) => void) | undefined;
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    apiMocks.createInventoryProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const view = renderWithQuery(<InventoryProductListScreen />);
    await screen.findByText("SKU SKU-001");
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(within(dialog).getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存并查看商品" }));
    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));

    shellMocks.value = {
      ...shellContext(),
      activeStore: { id: "store-2" },
      authorityFingerprint: "store-2:owner",
    };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <InventoryProductListScreen />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await act(async () => resolveCreate?.({ id: "stale-product", sku: "SKU-STALE" }));
    expect(routerMocks.push).not.toHaveBeenCalledWith("/inventory/stale-product");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the idempotency key across a failed retry and delegates final navigation", async () => {
    const onCreated = vi.fn();
    apiMocks.createInventoryProduct
      .mockRejectedValueOnce(new Error("controlled failure"))
      .mockResolvedValueOnce({ id: "product-created", sku: "SKU-NEW" });
    renderWithQuery(
      <InventoryProductIntakeScreen surface="dialog" onCreated={onCreated} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));
    expect(await screen.findByText("controlled failure")).toBeVisible();
    const firstKey = apiMocks.createInventoryProduct.mock.calls[0][0].idempotency_key;

    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("product-created"));
    expect(apiMocks.createInventoryProduct.mock.calls[1][0].idempotency_key).toBe(firstKey);
    expect(routerMocks.push).not.toHaveBeenCalledWith("/inventory/product-created");
  });

  it("uses a synchronous submit lock before React can disable the buttons", async () => {
    let resolveCreate: ((value: { id: string; sku: string }) => void) | undefined;
    apiMocks.createInventoryProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Sony" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "PlayStation 5" },
    });
    const form = screen.getByRole("button", { name: "保存并查看商品" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));
    resolveCreate?.({ id: "product-created", sku: "SKU-NEW" });
    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));
  });

  it("confirms destructive category changes inside the current work surface", () => {
    const nativeConfirm = vi.spyOn(window, "confirm");
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);
    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.click(screen.getByRole("radio", { name: "平板" }));

    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/会清除当前品牌、型号、规格和设备标识/)).toBeVisible();
    expect(screen.getByLabelText(/品牌/)).toHaveValue("Apple");
    const saveButton = screen.getByRole("button", { name: "保存并查看商品" });
    expect(saveButton).toBeDisabled();
    fireEvent.submit(saveButton.closest("form")!);
    expect(apiMocks.createInventoryProduct).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "清空并切换" }));
    expect(screen.getByRole("radio", { name: "平板" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText(/品牌/)).toHaveValue("");
  });

  it("confirms brand changes, clears incompatible specs, and preserves custody and finance fields", () => {
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);
    const brand = screen.getByLabelText(/品牌/);
    const model = screen.getByLabelText(/型号 \/ 商品名称/);
    fireEvent.change(brand, { target: { value: "Apple" } });
    fireEvent.change(model, { target: { value: "iPhone 15" } });
    fireEvent.change(screen.getByLabelText("内存（RAM）"), { target: { value: "8 GB" } });
    fireEvent.change(screen.getByLabelText("存储容量"), { target: { value: "256 GB" } });
    fireEvent.change(screen.getByLabelText("设备颜色"), { target: { value: "自定义色" } });
    fireEvent.change(screen.getByLabelText("IMEI 1"), { target: { value: "356789012345678" } });
    fireEvent.click(screen.getByText("更多信息", { exact: true }));
    fireEvent.change(screen.getByLabelText("计划售价"), { target: { value: "699" } });
    fireEvent.change(screen.getByLabelText("库位"), { target: { value: "A-02" } });
    fireEvent.change(screen.getByLabelText("保修（月）"), { target: { value: "12" } });

    fireEvent.change(brand, { target: { value: "Samsung" } });
    expect(screen.getByRole("status")).toHaveTextContent(/更换品牌会清除/);
    expect(model).toHaveValue("iPhone 15");
    fireEvent.click(screen.getByRole("button", { name: "保留原资料" }));
    expect(brand).toHaveValue("Apple");
    expect(model).toHaveValue("iPhone 15");

    fireEvent.change(brand, { target: { value: "Samsung" } });
    fireEvent.click(screen.getByRole("button", { name: "清理并切换" }));
    expect(brand).toHaveValue("Samsung");
    expect(model).toHaveValue("");
    expect(screen.getByLabelText("内存（RAM）")).toHaveValue("");
    expect(screen.getByLabelText("存储容量")).toHaveValue("");
    expect(screen.getByLabelText("设备颜色")).toHaveValue("");
    expect(screen.getByLabelText("IMEI 1")).toHaveValue("356789012345678");
    expect(screen.getByLabelText("计划售价")).toHaveValue("699");
    expect(screen.getByLabelText("库位")).toHaveValue("A-02");
    expect(screen.getByLabelText("保修（月）")).toHaveValue("12");
  });

  it("allows manual model entry without confirmation until derived values exist", () => {
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);
    const brand = screen.getByLabelText(/品牌/);
    const model = screen.getByLabelText(/型号 \/ 商品名称/);
    fireEvent.change(brand, { target: { value: "Sony / PlayStation" } });
    fireEvent.change(model, { target: { value: "Workshop Prototype" } });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(model).toHaveValue("Workshop Prototype");

    fireEvent.change(screen.getByLabelText("存储容量"), { target: { value: "825 GB" } });
    fireEvent.change(model, { target: { value: "PlayStation 5" } });
    expect(screen.getByRole("status")).toHaveTextContent(/更换型号会清除/);
    expect(model).toHaveValue("PlayStation 5");
    fireEvent.click(screen.getByRole("button", { name: "清理并切换" }));
    expect(model).toHaveValue("PlayStation 5");
    expect(screen.getByLabelText("存储容量")).toHaveValue("");
    expect(screen.getByLabelText(/品牌/)).toHaveValue("Sony / PlayStation");
  });

  it("fails closed when a catalog transition is pending and keeps save from calling the API", () => {
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);
    const brand = screen.getByLabelText(/品牌/);
    const model = screen.getByLabelText(/型号 \/ 商品名称/);
    fireEvent.change(brand, { target: { value: "Apple" } });
    fireEvent.change(model, { target: { value: "iPhone 15" } });
    fireEvent.change(screen.getByLabelText("存储容量"), { target: { value: "256 GB" } });
    fireEvent.change(model, { target: { value: "iPhone 16" } });

    const saveButton = screen.getByRole("button", { name: "保存并查看商品" });
    expect(saveButton).toBeDisabled();
    expect(brand).toBeDisabled();
    expect(screen.getByLabelText("存储容量")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "平板" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/更换型号会清除/);
    fireEvent.click(saveButton);
    fireEvent.submit(saveButton.closest("form")!);
    expect(apiMocks.createInventoryProduct).not.toHaveBeenCalled();
  });

  it("keeps the dialog open when Escape closes only the inline catalog selector", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: ["Apple"], locations: ["A-02"] },
    });
    renderWithQuery(
      <SidebarProvider>
        <InventoryProductListScreen />
      </SidebarProvider>,
    );
    await screen.findByText("SKU SKU-001");
    setViewport(390);
    fireEvent.click(screen.getAllByRole("button", { name: "快速录入商品" })[0]);
    const dialog = await screen.findByRole("dialog");
    const brandTrigger = within(dialog).getByLabelText(/品牌/);
    fireEvent.click(brandTrigger);
    const picker = await waitFor(() => {
      const node = document.querySelector<HTMLElement>('[data-inventory-catalog-picker="inline"]');
      expect(node).toBeTruthy();
      return node!;
    });
    const closeButton = within(picker).getByRole("button", { name: "关闭品牌选择" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(document.activeElement?.matches("input, textarea, select")).toBe(false);
    fireEvent.keyDown(picker.querySelector("section")!, { key: "Escape" });
    await waitFor(() =>
      expect(document.querySelector('[data-inventory-catalog-picker="inline"]')).toBeNull(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "放弃本次未保存商品？" })).not.toBeInTheDocument();
    expect(brandTrigger).toHaveFocus();
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
