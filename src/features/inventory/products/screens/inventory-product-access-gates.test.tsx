import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";
import { inventoryCatalogKeys, inventoryProductKeys } from "../api/query-keys";

const apiMocks = vi.hoisted(() => ({
  createInventoryProduct: vi.fn(),
  getInventoryProductEditData: vi.fn(),
  listInventoryProducts: vi.fn(),
  searchInventoryCatalog: vi.fn(),
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

function fillPhoneImei1(container: HTMLElement = document.body) {
  fireEvent.change(within(container).getByLabelText("IMEI 1"), {
    target: { value: "490154203237518" },
  });
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
  searchInventoryCatalog: apiMocks.searchInventoryCatalog,
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
  apiMocks.searchInventoryCatalog.mockResolvedValue({ items: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("inventory product UI access gates", () => {
  it("keeps create and edit mutation inputs canonical across employee locales", async () => {
    const createInputs: unknown[] = [];
    const updateInputs: unknown[] = [];

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      const onCreated = vi.fn();
      apiMocks.createInventoryProduct.mockResolvedValueOnce({
        id: `created-${locale}`,
        sku: "SKU-DYNAMIC-设备",
      });
      renderWithQuery(
        <InventoryProductIntakeScreen surface="dialog" onCreated={onCreated} />,
        locale,
      );

      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.quick.dialog.title"),
        }),
      ).toBeVisible();
      if (locale !== "zh-CN") {
        expect(document.body).not.toHaveTextContent("商品类别");
        expect(document.body).not.toHaveTextContent("保存并查看商品");
        expect(document.body).not.toHaveTextContent("计划售价");
        expect(document.body).not.toHaveTextContent("更多资料");
        expect(document.body).not.toHaveTextContent("保修（月）");
      }
      fireEvent.change(document.getElementById("product-brand")!, {
        target: { value: "Brand-DYNAMIC-品牌" },
      });
      fireEvent.change(document.getElementById("product-model")!, {
        target: { value: "Model-DYNAMIC-型号" },
      });
      fireEvent.change(document.getElementById("product-imei1")!, {
        target: { value: "490154203237518" },
      });
      fireEvent.change(document.getElementById("product-spec-network_variant")!, {
        target: { value: "Network-DYNAMIC-网络" },
      });
      fireEvent.change(document.getElementById("product-warranty")!, {
        target: { value: "12" },
      });
      fireEvent.change(document.getElementById("product-notes")!, {
        target: { value: "Notes-DYNAMIC-备注" },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.quick.screen.saveAndView"),
        }),
      );
      await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(`created-${locale}`));
      createInputs.push(normalizeIdempotency(apiMocks.createInventoryProduct.mock.calls[0]![0]));
      expect(JSON.stringify(apiMocks.createInventoryProduct.mock.calls[0]![0])).toContain(
        "DYNAMIC",
      );

      cleanup();
      vi.clearAllMocks();
      apiMocks.searchInventoryCatalog.mockResolvedValue({ items: [] });
      apiMocks.getInventoryProductEditData.mockResolvedValue({
        ...product({
          id: "product-dynamic",
          brand: "Brand-DYNAMIC-品牌",
          model: "Model-DYNAMIC-型号",
          created_at: "2026-08-07T10:00:00.000Z",
          version: 7,
        }),
        identifiers: [],
        specifications: { network_variant: "Network-DYNAMIC-网络" },
        notes: "Notes-DYNAMIC-备注",
        warranty_months: 12,
      });
      apiMocks.updateInventoryProduct.mockResolvedValue({
        ok: true,
        code: "updated",
        id: "product-dynamic",
        version: 8,
      });
      renderWithQuery(<InventoryProductEditScreen id="product-dynamic" />, locale);
      await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
      fireEvent.change(document.getElementById("product-model")!, {
        target: { value: "Model-DYNAMIC-型号-v2" },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.quick.edit.save"),
        }),
      );
      await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(routerMocks.push).toHaveBeenCalledWith("/inventory/product-dynamic"),
      );
      updateInputs.push(normalizeIdempotency(apiMocks.updateInventoryProduct.mock.calls[0]![1]));
      expect(apiMocks.updateInventoryProduct.mock.calls[0]![1].expected_version).toBe(7);

      cleanup();
      vi.clearAllMocks();
      apiMocks.searchInventoryCatalog.mockResolvedValue({ items: [] });
    }

    expect(createInputs[1]).toEqual(createInputs[0]);
    expect(createInputs[2]).toEqual(createInputs[0]);
    expect(updateInputs[1]).toEqual(updateInputs[0]);
    expect(updateInputs[2]).toEqual(updateInputs[0]);
  });

  it("preserves offline drafts and sends zero writes across employee locales", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />, locale);
      fireEvent.change(document.getElementById("product-brand")!, {
        target: { value: "Brand-OFFLINE-品牌" },
      });
      fireEvent.change(document.getElementById("product-model")!, {
        target: { value: "Model-OFFLINE-型号" },
      });
      fireEvent.change(document.getElementById("product-imei1")!, {
        target: { value: "490154203237518" },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.quick.screen.saveAndView"),
        }),
      );

      expect(
        await screen.findByText(translateMessage(locale, "inventory2b4.quick.screen.offline")),
      ).toBeVisible();
      expect(apiMocks.createInventoryProduct).not.toHaveBeenCalled();
      expect(document.getElementById("product-brand")).toHaveValue("Brand-OFFLINE-品牌");
      expect(document.getElementById("product-model")).toHaveValue("Model-OFFLINE-型号");

      cleanup();
      vi.clearAllMocks();
      apiMocks.searchInventoryCatalog.mockResolvedValue({ items: [] });
    }
  });

  it("omits cost and inspection fields when their existing capabilities are absent", async () => {
    shellMocks.value = shellContext({
      canAllocateInventoryCosts: false,
      canInspectInventory: false,
      inventoryProductInspectionEnabled: false,
    });
    apiMocks.createInventoryProduct.mockResolvedValue({
      id: "created-limited",
      sku: "SKU-LIMITED",
    });
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />, "en");

    expect(document.getElementById("product-cost")).toBeNull();
    expect(document.getElementById("product-battery-health")).toBeNull();
    fireEvent.change(document.getElementById("product-brand")!, {
      target: { value: "Brand-LIMITED-品牌" },
    });
    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-LIMITED-型号" },
    });
    fireEvent.change(document.getElementById("product-imei1")!, {
      target: { value: "490154203237518" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and view product" }));

    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));
    const input = apiMocks.createInventoryProduct.mock.calls[0]![0];
    expect(input).not.toHaveProperty("cost_amount");
    expect(input).not.toHaveProperty("inspection");
  });

  it("keeps conflict recovery localized and command inputs canonical across locales", async () => {
    const updateInputs: unknown[] = [];

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.getInventoryProductEditData.mockResolvedValue({
        ...product({
          id: "product-conflict",
          brand: "Brand-CONFLICT-品牌",
          model: "Model-CONFLICT-型号",
          created_at: "2026-08-07T10:00:00.000Z",
          version: 7,
        }),
        identifiers: [],
      });
      apiMocks.updateInventoryProduct.mockRejectedValueOnce({
        status: 409,
        code: "version_conflict",
        message: "SECRET-SENTINEL-客户号",
      });
      renderWithQuery(<InventoryProductEditScreen id="product-conflict" />, locale);
      await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
      fireEvent.change(document.getElementById("product-model")!, {
        target: { value: "Model-CONFLICT-型号-v2" },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.quick.edit.save"),
        }),
      );

      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "inventory2b4.conflict.version.title"),
        }),
      ).toBeVisible();
      expect(document.body).not.toHaveTextContent("SECRET-SENTINEL-客户号");
      expect(document.getElementById("product-model")).toHaveValue("Model-CONFLICT-型号-v2");
      expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1);
      updateInputs.push(normalizeIdempotency(apiMocks.updateInventoryProduct.mock.calls[0]![1]));

      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.conflict.refreshPreserve"),
        }),
      );
      expect(
        await screen.findByText(translateMessage(locale, "inventory2b4.quick.edit.recovered")),
      ).toBeVisible();
      expect(document.getElementById("product-model")).toHaveValue("Model-CONFLICT-型号-v2");
      expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1);

      cleanup();
      vi.clearAllMocks();
      apiMocks.searchInventoryCatalog.mockResolvedValue({ items: [] });
    }

    expect(updateInputs[1]).toEqual(updateInputs[0]);
    expect(updateInputs[2]).toEqual(updateInputs[0]);
  });

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

  it("marks IMEI 1 required only for phone intake", () => {
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);

    expect(screen.getByLabelText("IMEI 1")).toHaveAttribute("aria-required", "true");
    fireEvent.click(screen.getByRole("radio", { name: "电脑" }));
    expect(screen.getByLabelText("IMEI 1")).not.toHaveAttribute("aria-required");
  });

  it("blocks phone intake without IMEI 1 and focuses the required field", async () => {
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);

    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));

    expect(apiMocks.createInventoryProduct).not.toHaveBeenCalled();
    expect(await screen.findByText("手机商品必须填写 IMEI 1")).toBeVisible();
    const imei1 = screen.getByLabelText("IMEI 1");
    expect(imei1).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(imei1).toHaveFocus());
  });

  it("keeps runtime intake and edit screens free of Apple overlay injection", () => {
    const intakeSource = readFileSync(
      resolve(
        process.cwd(),
        "src/features/inventory/products/screens/inventory-product-intake-screen.tsx",
      ),
      "utf8",
    );
    const editSource = readFileSync(
      resolve(
        process.cwd(),
        "src/features/inventory/products/screens/inventory-product-edit-screen.tsx",
      ),
      "utf8",
    );

    expect(intakeSource).not.toContain("approvedAppleColorOverlay=");
    expect(editSource).not.toContain("approvedAppleColorOverlay=");
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
    fillPhoneImei1(dialog);
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
    fillPhoneImei1(dialog);
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
    fillPhoneImei1();
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));
    expect(await screen.findByText("商品保存失败，请重试")).toBeVisible();
    expect(screen.queryByText("controlled failure")).not.toBeInTheDocument();
    const firstKey = apiMocks.createInventoryProduct.mock.calls[0][0].idempotency_key;

    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("product-created"));
    expect(apiMocks.createInventoryProduct.mock.calls[1][0].idempotency_key).toBe(firstKey);
    expect(routerMocks.push).not.toHaveBeenCalledWith("/inventory/product-created");
  });

  it("keeps a committed create safe when parent completion fails and retry only re-runs completion", async () => {
    const onCreated = vi
      .fn()
      .mockRejectedValueOnce(new Error("parent sync unavailable"))
      .mockResolvedValueOnce(undefined);
    apiMocks.createInventoryProduct.mockResolvedValue({ id: "product-created", sku: "SKU-NEW" });
    renderWithQuery(
      <InventoryProductIntakeScreen surface="dialog" onCreated={onCreated} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fillPhoneImei1();
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "保存并查看商品" })).toBeDisabled();

    await fireEvent.click(screen.getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/当前页面已恢复可用/)).toBeVisible();
    expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1);
  });

  it("keeps the real route-intent dialog mounted when post-commit navigation fails", async () => {
    routerMocks.searchParams = new URLSearchParams("workspace=new-product");
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      facets: { brands: [], locations: [] },
    });
    apiMocks.createInventoryProduct.mockResolvedValue({
      id: "product-route-created",
      sku: "SKU-ROUTE-NEW",
    });
    routerMocks.push
      .mockRejectedValueOnce(new Error("SECRET-ROUTER-SENTINEL"))
      .mockResolvedValueOnce(undefined);
    const view = renderWithQuery(<InventoryProductListScreen />);
    const invalidatedKeys: unknown[][] = [];
    vi.spyOn(view.queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      invalidatedKeys.push([...(filters?.queryKey ?? [])]);
    });

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/品牌/), {
      target: { value: "Brand-ROUTE-品牌" },
    });
    fireEvent.change(within(dialog).getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "Model-ROUTE-型号" },
    });
    fillPhoneImei1(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "保存并查看商品" }));

    expect(await within(dialog).findByText("写入已完成，但同步最新状态失败")).toBeVisible();
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(document.body).not.toHaveTextContent("SECRET-ROUTER-SENTINEL");
    expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).toHaveBeenCalledTimes(1);
    expect(
      invalidatedKeys.filter(
        (key) =>
          JSON.stringify(key) === JSON.stringify(inventoryProductKeys.listsForStore("store-1")),
      ),
    ).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "重试同步" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).toHaveBeenNthCalledWith(2, "/inventory/product-route-created");
    expect(
      invalidatedKeys.filter(
        (key) =>
          JSON.stringify(key) === JSON.stringify(inventoryProductKeys.listsForStore("store-1")),
      ),
    ).toHaveLength(2);
    expect(routerMocks.replace).toHaveBeenCalledWith("/inventory", { scroll: false });
  });

  it("redacts a committed create when store authority changes before completion sync", async () => {
    let resolveCreate: ((value: { id: string; sku: string }) => void) | undefined;
    apiMocks.createInventoryProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const view = renderWithQuery(
      <InventoryProductIntakeScreen surface="dialog" onCreated={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fillPhoneImei1();
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));
    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));

    shellMocks.value = {
      ...shellContext(),
      activeStore: { id: "store-2" },
      authorityFingerprint: "store-2:owner",
    };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <InventoryProductIntakeScreen surface="dialog" onCreated={vi.fn()} />
      </QueryClientProvider>,
    );
    await act(async () => resolveCreate?.({ id: "stale-product", sku: "SKU-STALE" }));

    expect(await screen.findByText("写入已完成，但当前门店上下文已变化")).toBeVisible();
    expect(screen.getByText(/为保护隐私/)).toBeVisible();
    expect(screen.queryByText("stale-product")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试同步" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开已完成记录" })).not.toBeInTheDocument();
    expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1);
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
    fillPhoneImei1();
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
    fireEvent.change(brand, { target: { value: "Samsung" } });
    fireEvent.change(model, { target: { value: "Galaxy S24" } });
    fireEvent.change(screen.getByLabelText("内存（RAM）手动补充"), {
      target: { value: "8 GB" },
    });
    fireEvent.change(screen.getByLabelText("存储容量手动补充"), {
      target: { value: "256 GB" },
    });
    fireEvent.change(screen.getByLabelText("设备颜色手动补充"), {
      target: { value: "自定义色" },
    });
    fireEvent.change(screen.getByLabelText("IMEI 1"), { target: { value: "356789012345678" } });
    fireEvent.change(screen.getByLabelText("计划售价"), { target: { value: "699" } });
    fireEvent.change(screen.getByLabelText("库位"), { target: { value: "A-02" } });
    fireEvent.change(screen.getByLabelText("保修（月）"), { target: { value: "12" } });

    fireEvent.change(brand, { target: { value: "Xiaomi" } });
    expect(screen.getByRole("status")).toHaveTextContent(/更换品牌会清除/);
    expect(model).toHaveValue("Galaxy S24");
    fireEvent.click(screen.getByRole("button", { name: "保留原资料" }));
    expect(brand).toHaveValue("Samsung");
    expect(model).toHaveValue("Galaxy S24");

    fireEvent.change(brand, { target: { value: "Xiaomi" } });
    fireEvent.click(screen.getByRole("button", { name: "清理并切换" }));
    expect(brand).toHaveValue("Xiaomi");
    expect(model).toHaveValue("");
    expect(screen.getByLabelText("内存（RAM）手动补充")).toHaveValue("");
    expect(screen.getByLabelText("存储容量手动补充")).toHaveValue("");
    expect(screen.getByLabelText("设备颜色手动补充")).toHaveValue("");
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

    fireEvent.change(screen.getByLabelText("存储容量手动补充"), { target: { value: "825 GB" } });
    fireEvent.change(model, { target: { value: "PlayStation 5" } });
    expect(
      document.querySelector('[data-ui="inventory-product-catalog-transition-confirm"]'),
    ).toHaveTextContent(/更换型号会清除/);
    expect(model).toHaveValue("PlayStation 5");
    fireEvent.click(screen.getByRole("button", { name: "清理并切换" }));
    expect(model).toHaveValue("PlayStation 5");
    expect(screen.getByLabelText("存储容量手动补充")).toHaveValue("");
    expect(screen.getByLabelText(/品牌/)).toHaveValue("Sony / PlayStation");
  });

  it("fails closed when a catalog transition is pending and keeps save from calling the API", () => {
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" />);
    const brand = screen.getByLabelText(/品牌/);
    const model = screen.getByLabelText(/型号 \/ 商品名称/);
    fireEvent.change(brand, { target: { value: "Apple" } });
    fireEvent.change(model, { target: { value: "iPhone 15" } });
    fireEvent.change(screen.getByLabelText("存储容量手动补充"), { target: { value: "256 GB" } });
    fireEvent.change(model, { target: { value: "iPhone 16" } });

    const saveButton = screen.getByRole("button", { name: "保存并查看商品" });
    expect(saveButton).toBeDisabled();
    expect(brand).toBeDisabled();
    expect(screen.getByLabelText("存储容量")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "平板" })).toBeDisabled();
    expect(
      document.querySelector('[data-ui="inventory-product-catalog-transition-confirm"]'),
    ).toHaveTextContent(/更换型号会清除/);
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
    expect(await screen.findByAltText("Apple iPhone 13 商品参考图")).toHaveAttribute(
      "src",
      "/inventory-reference/iphone-standard.webp",
    );
    expect(screen.getByText("参考图")).toBeVisible();

    const reference = screen.getByAltText("Apple iPhone 13 商品参考图");
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

    expect(await screen.findByAltText("Apple iPhone 13 商品参考图")).toBeVisible();
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

    const reference = await screen.findByAltText("Apple iPhone 13 商品参考图");
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
    expect(screen.getByRole("img", { name: "颜色 Blue" })).toBeVisible();
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

  it("keeps the default compatibility view fail-closed for pipeline statuses", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [product({ legacy_status: "ready_for_sale" })],
      total: 1,
      facets: { brands: [], locations: [] },
      lifecycle_projection: {
        mode: "compatible",
        counts: { processing: 1 },
      },
    });
    renderWithQuery(<InventoryProductListScreen />);

    expect(await screen.findByText("待处理")).toBeVisible();
    expect(screen.queryByRole("group", { name: "生命周期工作入口" })).not.toBeInTheDocument();
    expect(screen.queryByText("尾款")).not.toBeInTheDocument();
  });

  it("renders exact lifecycle shortcuts, filters cards, and exposes no card mutations", async () => {
    const items = [
      product({
        id: "listed",
        model: "Listed",
        legacy_status: "listed",
        lifecycle: {
          mode: "exact",
          status: "in_stock",
          confidence: "high",
          needs_review: false,
          allowed_actions: ["reservation.create"],
        },
      }),
      product({
        id: "reserved",
        model: "Reserved",
        status: "reserved",
        legacy_status: "reserved",
        lifecycle: {
          mode: "exact",
          status: "reserved",
          confidence: "high",
          needs_review: false,
          balance: 120,
          allowed_actions: [],
        },
      }),
      product({
        id: "pickup",
        model: "Pickup",
        status: "sold",
        legacy_status: "sold",
        lifecycle: {
          mode: "exact",
          status: "sold_pending_pickup",
          confidence: "high",
          needs_review: false,
          expected_pickup_at: "2026-08-11T10:00:00.000Z",
          allowed_actions: [],
        },
      }),
      product({
        id: "processing",
        model: "Processing",
        legacy_status: "evaluating",
        lifecycle: {
          mode: "exact",
          status: "processing",
          confidence: "low",
          needs_review: true,
          allowed_actions: [],
        },
      }),
      product({
        id: "after-sales",
        model: "After Sales",
        status: "sold",
        legacy_status: "sold",
        lifecycle: {
          mode: "exact",
          status: "after_sales",
          confidence: "high",
          needs_review: false,
          after_sales_status: "in_progress",
          allowed_actions: [],
        },
      }),
    ];
    apiMocks.listInventoryProducts.mockResolvedValue({
      items,
      total: items.length,
      facets: { brands: [], locations: [] },
      lifecycle_projection: {
        mode: "exact",
        counts: { in_stock: 1, reserved: 1, sold_pending_pickup: 1, processing: 1, after_sales: 1 },
      },
    });
    renderWithQuery(<InventoryProductListScreen />);

    const shortcutGroup = await screen.findByRole("group", { name: "生命周期工作入口" });
    expect(within(shortcutGroup).getAllByRole("button")).toHaveLength(4);
    expect(shortcutGroup).toHaveClass("grid-cols-2", "min-[360px]:grid-cols-4");
    expect(screen.getByText("尾款")).toBeVisible();
    expect(screen.getByText("售后处理中")).toBeVisible();
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/inventory/"]')) {
      expect(link.querySelector("button")).toBeNull();
    }

    const reservedShortcut = Array.from(within(shortcutGroup).getAllByRole("button")).find(
      (button) => button.querySelector(".truncate")?.textContent === "预订",
    );
    expect(reservedShortcut).toBeDefined();
    fireEvent.click(reservedShortcut!);
    await waitFor(() =>
      expect(document.querySelectorAll('a[href^="/inventory/"]')).toHaveLength(1),
    );
    expect(apiMocks.createInventoryProduct).not.toHaveBeenCalled();
    expect(apiMocks.updateInventoryProduct).not.toHaveBeenCalled();
  });

  it("does not invent zero counts for exact shortcuts", async () => {
    apiMocks.listInventoryProducts.mockResolvedValue({
      items: [
        product({
          legacy_status: "listed",
          lifecycle: {
            mode: "exact",
            status: "in_stock",
            confidence: "high",
            needs_review: false,
            allowed_actions: [],
          },
        }),
      ],
      total: 1,
      facets: { brands: [], locations: [] },
      lifecycle_projection: { mode: "exact", counts: { in_stock: 1 } },
    });
    renderWithQuery(<InventoryProductListScreen />);

    const shortcuts = await screen.findByRole("group", { name: "生命周期工作入口" });
    const shortcutButtons = Array.from(within(shortcuts).getAllByRole("button"));
    const reservedShortcut = shortcutButtons.find(
      (button) => button.querySelector(".truncate")?.textContent === "预订",
    );
    const pickupShortcut = shortcutButtons.find(
      (button) => button.querySelector(".truncate")?.textContent === "待取",
    );
    expect(reservedShortcut).toBeDefined();
    expect(pickupShortcut).toBeDefined();
    expect(reservedShortcut).not.toHaveTextContent("0");
    expect(pickupShortcut).not.toHaveTextContent("0");
  });

  it("invalidates only the active store catalog after a committed intake", async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    apiMocks.createInventoryProduct.mockResolvedValue({ id: "created-1", sku: "SKU-NEW" });
    const { queryClient } = renderWithQuery(
      <InventoryProductIntakeScreen surface="dialog" onCreated={onCreated} />,
    );
    const invalidatedKeys: unknown[][] = [];
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      invalidatedKeys.push([...(filters?.queryKey ?? [])]);
    });

    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fillPhoneImei1();
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("created-1"));
    expect(invalidatedKeys).toContainEqual([...inventoryCatalogKeys.catalogsForStore("store-1")]);
    expect(invalidatedKeys).not.toContainEqual([
      ...inventoryCatalogKeys.catalogsForStore("store-2"),
    ]);
  });

  it("keeps a committed intake successful when catalog refresh fails", async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    apiMocks.createInventoryProduct.mockResolvedValue({ id: "created-2", sku: "SKU-NEW" });
    const { queryClient } = renderWithQuery(
      <InventoryProductIntakeScreen surface="dialog" onCreated={onCreated} />,
    );
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      const queryKey = filters?.queryKey;
      if (
        JSON.stringify(queryKey) ===
        JSON.stringify(inventoryCatalogKeys.catalogsForStore("store-1"))
      ) {
        throw new Error("catalog refresh unavailable");
      }
    });

    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15" },
    });
    fillPhoneImei1();
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));

    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText("商品保存失败，请重试")).not.toBeInTheDocument();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
  });

  it("omits unapproved Apple color from the intake mutation payload", async () => {
    apiMocks.createInventoryProduct.mockResolvedValue({ id: "created-color", sku: "SKU-NEW" });
    renderWithQuery(<InventoryProductIntakeScreen surface="dialog" onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/品牌/), { target: { value: "Apple" } });
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "Unreviewed iPhone" },
    });
    fillPhoneImei1();
    fireEvent.click(screen.getByRole("button", { name: "保存并查看商品" }));

    await waitFor(() => expect(apiMocks.createInventoryProduct).toHaveBeenCalledTimes(1));
    expect(apiMocks.createInventoryProduct.mock.calls[0][0]).not.toHaveProperty("color");
  });

  it("preserves the persisted Apple color in an edit mutation while mapping is pending", async () => {
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({
        id: "product-color",
        color: "红色",
        created_at: "2026-08-07T10:00:00.000Z",
        version: 1,
      }),
      identifiers: [],
    });
    apiMocks.updateInventoryProduct.mockResolvedValue({
      ok: true,
      code: "updated",
      id: "product-color",
      version: 2,
    });
    renderWithQuery(<InventoryProductEditScreen id="product-color" />);

    await screen.findByLabelText(/品牌/);
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateInventoryProduct.mock.calls[0][1].color).toBe("红色");
  });

  it("invalidates only the active store catalog after a committed edit", async () => {
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({ id: "product-1", created_at: "2026-08-07T10:00:00.000Z", version: 1 }),
      identifiers: [],
    });
    apiMocks.updateInventoryProduct.mockResolvedValue({
      ok: true,
      code: "updated",
      id: "product-1",
      version: 2,
    });
    const { queryClient } = renderWithQuery(<InventoryProductEditScreen id="product-1" />);
    const invalidatedKeys: unknown[][] = [];
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      invalidatedKeys.push([...(filters?.queryKey ?? [])]);
    });

    await screen.findByLabelText(/品牌/);
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15 Pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
    expect(invalidatedKeys).toContainEqual([...inventoryCatalogKeys.catalogsForStore("store-1")]);
    expect(invalidatedKeys).not.toContainEqual([
      ...inventoryCatalogKeys.catalogsForStore("store-2"),
    ]);
  });

  it("keeps a committed edit successful when catalog refresh fails", async () => {
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({ id: "product-1", created_at: "2026-08-07T10:00:00.000Z", version: 1 }),
      identifiers: [],
    });
    apiMocks.updateInventoryProduct.mockResolvedValue({
      ok: true,
      code: "updated",
      id: "product-1",
      version: 2,
    });
    const { queryClient } = renderWithQuery(<InventoryProductEditScreen id="product-1" />);
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      const queryKey = filters?.queryKey;
      if (
        JSON.stringify(queryKey) ===
        JSON.stringify(inventoryCatalogKeys.catalogsForStore("store-1"))
      ) {
        throw new Error("catalog refresh unavailable");
      }
    });

    await screen.findByLabelText(/品牌/);
    fireEvent.change(screen.getByLabelText(/型号 \/ 商品名称/), {
      target: { value: "iPhone 15 Pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("商品更新失败，请重试")).not.toBeInTheDocument();
    expect(await screen.findByText("写入已完成，但同步最新状态失败")).toBeVisible();
  });

  it("uses a synchronous edit submit lock for same-tick duplicate submits", async () => {
    let resolveUpdate:
      | ((value: { ok: true; code: "updated"; id: string; version: number }) => void)
      | undefined;
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({
        id: "product-edit-lock",
        created_at: "2026-08-07T10:00:00.000Z",
        version: 7,
      }),
      identifiers: [],
    });
    apiMocks.updateInventoryProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    renderWithQuery(<InventoryProductEditScreen id="product-edit-lock" />);
    await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-LOCK-型号" },
    });
    const form = screen.getByRole("button", { name: "保存修改" }).closest("form")!;

    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateInventoryProduct.mock.calls[0]![1].expected_version).toBe(7);
    normalizeIdempotency(apiMocks.updateInventoryProduct.mock.calls[0]![1]);

    await act(async () =>
      resolveUpdate?.({ ok: true, code: "updated", id: "product-edit-lock", version: 8 }),
    );
    await waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith("/inventory/product-edit-lock"),
    );
    expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1);
  });

  it("reuses the edit idempotency key only while the failed command stays unchanged", async () => {
    const rawError = "EDIT-RETRY-RAW-SENTINEL";
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({
        id: "product-edit-retry-key",
        created_at: "2026-08-07T10:00:00.000Z",
        version: 7,
      }),
      identifiers: [],
    });
    apiMocks.updateInventoryProduct.mockRejectedValue(new Error(rawError));
    renderWithQuery(<InventoryProductEditScreen id="product-edit-retry-key" />, "en");
    await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-RETRY-A-型号" },
    });
    const save = screen.getByRole("button", { name: "Save changes" });

    fireEvent.click(save);
    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(translateMessage("en", "inventory2b4.quick.edit.updateFailed")),
    ).toBeVisible();
    const firstInput = apiMocks.updateInventoryProduct.mock.calls[0]![1];
    normalizeIdempotency(firstInput);

    fireEvent.click(save);
    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(2));
    const unchangedRetryInput = apiMocks.updateInventoryProduct.mock.calls[1]![1];
    expect(unchangedRetryInput.idempotency_key).toBe(firstInput.idempotency_key);

    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-RETRY-B-型号" },
    });
    fireEvent.click(save);
    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(3));
    const changedCommandInput = apiMocks.updateInventoryProduct.mock.calls[2]![1];
    normalizeIdempotency(changedCommandInput);
    expect(changedCommandInput.idempotency_key).not.toBe(firstInput.idempotency_key);
    expect(changedCommandInput.expected_version).toBe(7);
    expect(changedCommandInput.model).toBe("Model-RETRY-B-型号");
    expect(document.body).not.toHaveTextContent(rawError);
  });

  it.each([
    ["it-IT", new DOMException("ABORT-RAW-SENTINEL", "AbortError"), "connectivity"],
    ["en", { status: 503, message: "SERVER-RAW-SENTINEL" }, "server"],
  ] satisfies ReadonlyArray<[AppLocale, unknown, "connectivity" | "server"]>)(
    "shows a localized safe outcome-unknown edit state for %s",
    async (locale, failure, subtype) => {
      apiMocks.getInventoryProductEditData.mockResolvedValue({
        ...product({
          id: `product-edit-${subtype}`,
          created_at: "2026-08-07T10:00:00.000Z",
          version: 7,
        }),
        identifiers: [],
      });
      apiMocks.updateInventoryProduct.mockRejectedValue(failure);
      renderWithQuery(<InventoryProductEditScreen id={`product-edit-${subtype}`} />, locale);
      await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
      fireEvent.change(document.getElementById("product-model")!, {
        target: { value: `Model-${subtype}-DYNAMIC-型号` },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.quick.edit.save"),
        }),
      );

      expect(
        await screen.findByText(translateMessage(locale, `inventory2b4.error.${subtype}`)),
      ).toBeVisible();
      expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1);
      expect(document.body).not.toHaveTextContent("ABORT-RAW-SENTINEL");
      expect(document.body).not.toHaveTextContent("SERVER-RAW-SENTINEL");
      expect(document.getElementById("product-model")).toHaveValue(`Model-${subtype}-DYNAMIC-型号`);
    },
  );

  it("retries only post-commit synchronization and never repeats the edit mutation", async () => {
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({
        id: "product-edit-post-commit",
        created_at: "2026-08-07T10:00:00.000Z",
        version: 7,
      }),
      identifiers: [],
    });
    apiMocks.updateInventoryProduct.mockResolvedValue({
      ok: true,
      code: "updated",
      id: "product-edit-post-commit",
      version: 8,
    });
    const { queryClient } = renderWithQuery(
      <InventoryProductEditScreen id="product-edit-post-commit" />,
      "it-IT",
    );
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockRejectedValueOnce(new Error("POST-COMMIT-SYNC-RAW-SENTINEL"))
      .mockResolvedValue(undefined);
    await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-COMMITTED-DYNAMIC-型号" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(
      await screen.findByText(translateMessage("it-IT", "inventory2b4.sync.failed.title")),
    ).toBeVisible();
    expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1);
    expect(document.body).not.toHaveTextContent("POST-COMMIT-SYNC-RAW-SENTINEL");

    fireEvent.click(
      screen.getByRole("button", { name: translateMessage("it-IT", "inventory2b4.sync.retry") }),
    );
    await waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith("/inventory/product-edit-post-commit"),
    );
    expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it("loads the latest conflict version, preserves the draft, and starts a new confirmed command", async () => {
    const initial = {
      ...product({
        id: "product-edit-conflict-lifecycle",
        model: "Model-BASE-型号",
        created_at: "2026-08-07T10:00:00.000Z",
        version: 7,
      }),
      identifiers: [],
    };
    const latest = {
      ...initial,
      location: "LOCATION-LATEST-库位",
      version: 11,
    };
    apiMocks.getInventoryProductEditData.mockResolvedValueOnce(initial).mockResolvedValue(latest);
    apiMocks.updateInventoryProduct
      .mockRejectedValueOnce({ status: 409, code: "version_conflict" })
      .mockResolvedValueOnce({
        ok: true,
        code: "updated",
        id: "product-edit-conflict-lifecycle",
        version: 12,
      });
    renderWithQuery(<InventoryProductEditScreen id="product-edit-conflict-lifecycle" />, "en");
    await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-DRAFT-PRESERVED-型号" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(1));
    const firstInput = apiMocks.updateInventoryProduct.mock.calls[0]![1];
    normalizeIdempotency(firstInput);
    expect(firstInput.expected_version).toBe(7);

    fireEvent.click(
      await screen.findByRole("button", {
        name: translateMessage("en", "inventory2b4.conflict.refreshPreserve"),
      }),
    );
    expect(
      await screen.findByText(translateMessage("en", "inventory2b4.quick.edit.recovered")),
    ).toBeVisible();
    expect(document.getElementById("product-model")).toHaveValue("Model-DRAFT-PRESERVED-型号");
    expect(document.getElementById("product-location")).toHaveValue("LOCATION-LATEST-库位");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(2));
    const confirmedInput = apiMocks.updateInventoryProduct.mock.calls[1]![1];
    normalizeIdempotency(confirmedInput);
    expect(confirmedInput.expected_version).toBe(11);
    expect(confirmedInput.model).toBe("Model-DRAFT-PRESERVED-型号");
    expect(confirmedInput.location).toBe("LOCATION-LATEST-库位");
    expect(confirmedInput.idempotency_key).not.toBe(firstInput.idempotency_key);
    await waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith("/inventory/product-edit-conflict-lifecycle"),
    );
    expect(apiMocks.updateInventoryProduct).toHaveBeenCalledTimes(2);
  });

  it("keeps an offline edit draft and sends zero writes", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    apiMocks.getInventoryProductEditData.mockResolvedValue({
      ...product({
        id: "product-edit-offline",
        created_at: "2026-08-07T10:00:00.000Z",
        version: 7,
      }),
      identifiers: [],
    });
    renderWithQuery(<InventoryProductEditScreen id="product-edit-offline" />, "it-IT");
    await waitFor(() => expect(document.getElementById("product-model")).not.toBeNull());
    fireEvent.change(document.getElementById("product-model")!, {
      target: { value: "Model-OFFLINE-型号" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(
      await screen.findByText(translateMessage("it-IT", "inventory2b4.quick.screen.offline")),
    ).toBeVisible();
    expect(document.getElementById("product-model")).toHaveValue("Model-OFFLINE-型号");
    expect(apiMocks.updateInventoryProduct).not.toHaveBeenCalled();
  });

  it("preserves the Quick Entry draft, disclosure, focus, scroll, and reads on locale switch", async () => {
    renderWithQuery(
      <>
        <InventoryProductIntakeScreen surface="dialog" onCreated={vi.fn()} />
        <QuickEntryLocaleSwitch />
      </>,
      "en",
    );
    const brand = document.getElementById("product-brand")!;
    const model = document.getElementById("product-model")!;
    const network = document.getElementById("product-spec-network_variant")!;
    const disclosure = document.getElementById("product-spec-network_variant-preset")!;
    await waitFor(() => expect(brand).toHaveFocus());
    fireEvent.change(brand, { target: { value: "Brand-DYNAMIC-品牌" } });
    fireEvent.change(model, { target: { value: "Model-DYNAMIC-型号" } });
    fireEvent.change(network, { target: { value: "Network-DYNAMIC-网络" } });
    fireEvent.click(disclosure);
    await waitFor(() => expect(disclosure).toHaveAttribute("aria-expanded", "true"));
    await waitFor(() => expect(screen.getByRole("option", { name: "EU" })).toHaveFocus());
    const readsBeforeSwitch = apiMocks.searchInventoryCatalog.mock.calls.length;
    Object.defineProperty(window, "scrollY", { configurable: true, value: 240 });

    fireEvent.click(screen.getByRole("button", { name: "switch-quick-entry-locale" }));

    await waitFor(() => {
      expect(document.getElementById("product-brand")).toHaveValue("Brand-DYNAMIC-品牌");
      expect(document.getElementById("product-model")).toHaveValue("Model-DYNAMIC-型号");
      expect(document.getElementById("product-spec-network_variant")).toHaveValue(
        "Network-DYNAMIC-网络",
      );
      expect(disclosure).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox")).toHaveAccessibleName(
        translateMessage("it-IT", "inventory2b4.quick.select.optionsAria", {
          label: translateMessage("it-IT", "inventory2b4.quick.form.presets", {
            label: translateMessage("it-IT", "inventory2b4.quick.spec.networkVariant"),
          }),
        }),
      );
      expect(screen.getByRole("option", { name: "EU" })).toHaveFocus();
      expect(window.scrollY).toBe(240);
      expect(apiMocks.searchInventoryCatalog).toHaveBeenCalledTimes(readsBeforeSwitch);
    });
    expect(apiMocks.createInventoryProduct).not.toHaveBeenCalled();
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

function renderWithQuery(node: React.ReactNode, locale?: AppLocale) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const content = <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
  return {
    ...render(locale ? <LocaleProvider initialLocale={locale}>{content}</LocaleProvider> : content),
    queryClient,
  };
}

function normalizeIdempotency<T extends Record<string, unknown>>(input: T) {
  expect(input.idempotency_key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return { ...input, idempotency_key: "<uuid>" };
}

function QuickEntryLocaleSwitch() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("it-IT")}>
      switch-quick-entry-locale
    </button>
  );
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
