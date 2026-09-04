import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryProductDetail } from "@/lib/repairdesk/types";
import { inventoryLifecycleKeys } from "@/features/inventory/lifecycle/api/query-keys";
import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const apiMocks = vi.hoisted(() => ({
  getInventoryProduct: vi.fn(),
  readInventoryLifecycleSummary: vi.fn(),
  runInventoryLifecycleCommand: vi.fn(),
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
  runInventoryLifecycleCommand: apiMocks.runInventoryLifecycleCommand,
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
  apiMocks.runInventoryLifecycleCommand.mockResolvedValue({ ok: true, code: "confirmed" });
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
  it.each([
    ["zh-CN", "无法查看商品", "当前账号没有商品库存查看权限。"],
    [
      "it-IT",
      "Impossibile visualizzare il prodotto",
      "Questo account non può visualizzare l'inventario prodotti.",
    ],
    ["en", "Unable to view product", "This account cannot view product inventory."],
  ] as const)(
    "localizes the no-access state in %s without requesting product data",
    async (locale, title, body) => {
      shellMocks.value.permissions.canReadInventory = false;
      renderScreen(locale);

      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(screen.getByText(body)).toBeVisible();
      await waitFor(() => expect(apiMocks.getInventoryProduct).not.toHaveBeenCalled());
    },
  );

  it.each([
    ["zh-CN", "商品详情加载失败", "重试"],
    ["it-IT", "Impossibile caricare i dettagli del prodotto", "Riprova"],
    ["en", "Product details failed to load", "Retry"],
  ] as const)(
    "localizes safe load failure and refetch in %s",
    async (locale, title, retryLabel) => {
      apiMocks.getInventoryProduct
        .mockRejectedValueOnce(new Error("RAW-DETAIL-SENTINEL"))
        .mockRejectedValueOnce(new Error("RAW-DETAIL-SENTINEL"))
        .mockResolvedValue(productFixture());
      renderScreen(locale);

      expect(await screen.findByRole("heading", { name: title }, { timeout: 3_000 })).toBeVisible();
      expect(screen.queryByText(/RAW-DETAIL-SENTINEL/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: retryLabel }));
      expect(
        await screen.findByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" }),
      ).toBeVisible();
      expect(apiMocks.getInventoryProduct).toHaveBeenCalledTimes(3);
    },
  );

  it.each([
    ["zh-CN", "正在加载商品详情"],
    ["it-IT", "Caricamento dettagli prodotto"],
    ["en", "Loading product details"],
  ] as const)("localizes the loading status in %s", (locale, label) => {
    apiMocks.getInventoryProduct.mockReturnValue(new Promise(() => undefined));
    renderScreen(locale);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "mounts the flag-off Apple inspection health presentation in %s",
    async (locale) => {
      renderScreen(locale);

      const healthTitle = await screen.findByRole("heading", {
        name: translateMessage(locale, "inventory2b4.inspection.deviceInspection"),
      });
      const health = healthTitle.closest<HTMLElement>('[data-ui="inventory-device-health"]');
      expect(health).not.toBeNull();
      expect(within(health!).getByText("Face ID")).toBeVisible();
      expect(
        within(health!).getByText(
          translateMessage(locale, "inventory2b4.inspection.batteryHealth"),
        ),
      ).toBeVisible();
      expect(
        within(health!).getByText(translateMessage(locale, "inventory2b4.inspection.notYetTested")),
      ).toBeVisible();
      expect(
        within(health!).getByText(translateMessage(locale, "inventory2b4.inspection.notTested")),
      ).toBeVisible();
      expect(apiMocks.readInventoryLifecycleSummary).not.toHaveBeenCalled();
      expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
      expectNoUnexpectedInventoryHan(locale);
    },
  );

  it("changes presentation locale without refetching or changing dynamic product values", async () => {
    renderScreen("en", true);
    expect(await screen.findByRole("heading", { name: "Device workbench" })).toBeVisible();
    expect(screen.getAllByText("EU 双卡").length).toBeGreaterThan(0);
    await waitFor(() => expect(apiMocks.getInventoryProduct).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "switch-locale" }));
    expect(
      await screen.findByRole("heading", { name: "Area di lavoro dispositivo" }),
    ).toBeVisible();
    expect(screen.getAllByText("EU 双卡").length).toBeGreaterThan(0);
    expect(apiMocks.getInventoryProduct).toHaveBeenCalledTimes(1);
  });

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

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "renders the flag-on lifecycle loading state in %s",
    async (locale) => {
      shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
      apiMocks.readInventoryLifecycleSummary.mockReturnValue(new Promise(() => undefined));
      renderScreen(locale);

      expect(
        await screen.findByText(translateMessage(locale, "inventory2b4.lifecycle.loading")),
      ).toBeInTheDocument();
      expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    },
  );

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "renders the flag-on lifecycle unavailable state without raw errors in %s",
    async (locale) => {
      shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
      apiMocks.readInventoryLifecycleSummary.mockRejectedValue(
        new Error("RAW-LIFECYCLE-READ-SENTINEL"),
      );
      renderScreen(locale);

      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "inventory2b4.lifecycle.unavailable.title"),
        }),
      ).toBeVisible();
      expect(document.body).not.toHaveTextContent("RAW-LIFECYCLE-READ-SENTINEL");
      expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
    },
  );

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

  it("keeps the real inspection mutation input canonical across all employee locales", async () => {
    const normalizedInputs: unknown[] = [];
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
    );

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.runInventoryLifecycleCommand.mockClear();
      renderScreen(locale);
      const battery = await screen.findByRole("spinbutton", {
        name: translateMessage(locale, "inventory2b4.inspection.batteryHealthPercent"),
      });
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.inspection.deviceInspection"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.inspection.editorTitle"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.lifecycle.currentBusiness"),
        }),
      ).toBeVisible();
      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.timeline.title.milestones"),
        }),
      ).toBeVisible();
      expect(document.body).not.toHaveTextContent(/not_tested|inspection\.save/);
      if (locale !== "zh-CN") {
        const withoutRegisteredDynamicValues = (document.body.textContent ?? "")
          .replaceAll("展柜 A", "")
          .replaceAll("EU 双卡", "")
          .replaceAll("配件齐全", "");
        expect(withoutRegisteredDynamicValues).not.toMatch(/[\p{Script=Han}]/u);
      }
      fireEvent.change(battery, { target: { value: "87" } });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.inspection.save"),
        }),
      );

      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
      expect(input?.idempotency_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      normalizedInputs.push({ ...input, idempotency_key: "<uuid>" });
      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "inventory2b4.receipt.inspectionSave.title"),
        }),
      ).toBeVisible();
      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "inventory2b4.sync.recovered.title"),
        }),
      ).toBeVisible();
      expectNoUnexpectedInventoryHan(locale);
      cleanup();
    }

    const expected = {
      command: "inspection.save",
      idempotency_key: "<uuid>",
      payload: {
        stock_unit_id: "unit-1",
        expected_unit_version: 3,
        device_kind: "phone",
        battery_health: 87,
        face_id_status: "not_tested",
        touch_id_status: "not_tested",
        true_tone_status: "not_tested",
        activation_lock_status: "not_tested",
        data_wipe_status: "not_tested",
        imei_status: "not_tested",
      },
    };
    expect(normalizedInputs).toEqual([expected, expected, expected]);
  });

  it("keeps localized validation client-side in every employee locale", async () => {
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
    );

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.runInventoryLifecycleCommand.mockClear();
      renderScreen(locale);
      const battery = await screen.findByRole("spinbutton", {
        name: translateMessage(locale, "inventory2b4.inspection.batteryHealthPercent"),
      });
      fireEvent.change(battery, { target: { value: "101" } });
      fireEvent.click(
        screen.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.inspection.save"),
        }),
      );

      const validation = document.querySelector<HTMLElement>(
        '[data-ui="inventory-lifecycle-validation-summary"]',
      );
      expect(validation).not.toBeNull();
      expect(validation).toHaveTextContent(
        translateMessage(locale, "inventory2b4.validation.summary"),
      );
      expect(validation).toHaveTextContent(
        translateMessage(locale, "inventory2b4.inspection.batteryValidation"),
      );
      await waitFor(() => expect(validation).toHaveFocus());
      expect(apiMocks.runInventoryLifecycleCommand).not.toHaveBeenCalled();
      expectNoUnexpectedInventoryHan(locale);
      cleanup();
    }
  });

  it("locks a pending inspection and keeps its canonical input locale-invariant", async () => {
    const normalizedInputs: unknown[] = [];
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
    );

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      let resolveCommand!: (value: { ok: boolean; code: string }) => void;
      apiMocks.runInventoryLifecycleCommand.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCommand = resolve;
          }),
      );
      renderScreen(locale);
      fireEvent.click(
        await screen.findByRole("button", {
          name: translateMessage(locale, "inventory2b4.inspection.save"),
        }),
      );

      await waitFor(() => expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1));
      const pendingButton = screen.getByRole("button", {
        name: translateMessage(locale, "inventory2b4.inspection.saving"),
      });
      expect(pendingButton).toBeDisabled();
      expect(
        screen.getByText(translateMessage(locale, "inventory2b4.inspection.pending")),
      ).toBeVisible();
      normalizedInputs.push(normalizeInspectionCall());
      expectNoUnexpectedInventoryHan(locale);

      resolveCommand({ ok: true, code: "confirmed" });
      await screen.findByRole("heading", {
        name: translateMessage(locale, "inventory2b4.receipt.inspectionSave.title"),
      });
      cleanup();
      apiMocks.runInventoryLifecycleCommand.mockClear();
    }

    expect(normalizedInputs).toEqual([
      canonicalInspectionInput(),
      canonicalInspectionInput(),
      canonicalInspectionInput(),
    ]);
  });

  it("renders a localized generic safe error and preserves the attempted input", async () => {
    const normalizedInputs: unknown[] = [];
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
    );

    for (const locale of ["zh-CN", "it-IT", "en"] as const) {
      apiMocks.runInventoryLifecycleCommand.mockRejectedValueOnce(
        new Error("RAW-GENERIC-INSPECTION-SENTINEL"),
      );
      renderScreen(locale);
      fireEvent.click(
        await screen.findByRole("button", {
          name: translateMessage(locale, "inventory2b4.inspection.save"),
        }),
      );

      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "inventory2b4.operationError.unknown.title"),
        }),
      ).toBeVisible();
      expect(document.body).not.toHaveTextContent("RAW-GENERIC-INSPECTION-SENTINEL");
      expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
      normalizedInputs.push(normalizeInspectionCall());
      expectNoUnexpectedInventoryHan(locale);
      cleanup();
      apiMocks.runInventoryLifecycleCommand.mockClear();
    }

    expect(normalizedInputs).toEqual([
      canonicalInspectionInput(),
      canonicalInspectionInput(),
      canonicalInspectionInput(),
    ]);
  });

  it("renders post-commit sync failure safely in every employee locale", async () => {
    const normalizedInputs: unknown[] = [];
    const invalidateSpy = vi
      .spyOn(QueryClient.prototype, "invalidateQueries")
      .mockRejectedValue(new Error("RAW-SYNC-FAILURE-SENTINEL"));
    shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
    apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
      lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
    );

    try {
      for (const locale of ["zh-CN", "it-IT", "en"] as const) {
        renderScreen(locale);
        fireEvent.click(
          await screen.findByRole("button", {
            name: translateMessage(locale, "inventory2b4.inspection.save"),
          }),
        );

        expect(
          await screen.findByRole("heading", {
            name: translateMessage(locale, "inventory2b4.sync.failed.title"),
          }),
        ).toBeVisible();
        expect(
          screen.getByRole("heading", {
            name: translateMessage(locale, "inventory2b4.receipt.inspectionSave.title"),
          }),
        ).toBeVisible();
        expect(document.body).not.toHaveTextContent("RAW-SYNC-FAILURE-SENTINEL");
        expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
        normalizedInputs.push(normalizeInspectionCall());
        expectNoUnexpectedInventoryHan(locale);
        cleanup();
        apiMocks.runInventoryLifecycleCommand.mockClear();
      }
    } finally {
      invalidateSpy.mockRestore();
    }

    expect(normalizedInputs).toEqual([
      canonicalInspectionInput(),
      canonicalInspectionInput(),
      canonicalInspectionInput(),
    ]);
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "routes an inspection version conflict to localized safe UI in %s",
    async (locale) => {
      shellMocks.value.permissions.inventoryLifecycleUiEnabled = true;
      apiMocks.readInventoryLifecycleSummary.mockResolvedValue(
        lifecycleSummaryFixture({ allowed_actions: ["inspection.save"] }),
      );
      apiMocks.runInventoryLifecycleCommand.mockRejectedValue({
        status: 409,
        code: "stale_version",
        message: "RAW-CONFLICT-SENTINEL",
      });
      renderScreen(locale);

      fireEvent.click(
        await screen.findByRole("button", {
          name: translateMessage(locale, "inventory2b4.inspection.save"),
        }),
      );
      expect(
        await screen.findByRole("heading", {
          name: translateMessage(locale, "inventory2b4.conflict.version.title"),
        }),
      ).toBeVisible();
      expect(apiMocks.runInventoryLifecycleCommand).toHaveBeenCalledTimes(1);
      expect(normalizeInspectionCall()).toEqual(canonicalInspectionInput());
      expect(document.body).not.toHaveTextContent("RAW-CONFLICT-SENTINEL");
      expectNoUnexpectedInventoryHan(locale);
    },
  );

  it("does not request or render product data without read permission", async () => {
    shellMocks.value.permissions.canReadInventory = false;
    renderScreen();

    expect(screen.getByRole("heading", { name: "无法查看商品" })).toBeVisible();
    await waitFor(() => expect(apiMocks.getInventoryProduct).not.toHaveBeenCalled());
    expect(screen.queryByText("Apple iPhone 15 Pro")).not.toBeInTheDocument();
  });
});

function renderScreen(locale: AppLocale = "zh-CN", withSwitcher = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        {withSwitcher ? <LocaleTestSwitcher /> : null}
        <InventoryProductDetailScreen id="product-1" />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

function LocaleTestSwitcher() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("it-IT")}>
      switch-locale
    </button>
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

function normalizeInspectionCall() {
  const input = apiMocks.runInventoryLifecycleCommand.mock.calls[0]?.[0];
  expect(input?.idempotency_key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return { ...input, idempotency_key: "<uuid>" };
}

function canonicalInspectionInput() {
  return {
    command: "inspection.save",
    idempotency_key: "<uuid>",
    payload: {
      stock_unit_id: "unit-1",
      expected_unit_version: 3,
      device_kind: "phone",
      battery_health: null,
      face_id_status: "not_tested",
      touch_id_status: "not_tested",
      true_tone_status: "not_tested",
      activation_lock_status: "not_tested",
      data_wipe_status: "not_tested",
      imei_status: "not_tested",
    },
  };
}

function expectNoUnexpectedInventoryHan(locale: AppLocale) {
  if (locale === "zh-CN") return;
  const withoutRegisteredDynamicValues = (document.body.textContent ?? "")
    .replaceAll("展柜 A", "")
    .replaceAll("EU 双卡", "")
    .replaceAll("配件齐全", "");
  expect(withoutRegisteredDynamicValues).not.toMatch(/[\p{Script=Han}]/u);
}
