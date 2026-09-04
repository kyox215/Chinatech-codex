import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryLifecycleListSummary, InventoryProductDetail } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import { InventoryProductDetailWorkbench } from "./inventory-product-detail-workbench";

const productFixture = (): InventoryProductDetail => ({
  id: "story-workbench-test",
  sku: "CT-TEST-DETAIL-001",
  category: "phone",
  brand: "Apple",
  model: "iPhone 15 Pro",
  status: "in_stock",
  location: "A-03",
  list_price: 899,
  currency_code: "EUR",
  updated_at: "2026-08-11T07:42:00.000Z",
  specifications: { processor: "A17 Pro" },
  identifiers: [{ kind: "serial", masked_value: "··· TEST", primary: true }],
  created_at: "2026-08-08T09:10:00.000Z",
  version: 4,
});

const reserveSummary = (item: InventoryProductDetail): InventoryLifecycleListSummary => ({
  item_id: item.id,
  stock_unit_id: "stock-test",
  sku: item.sku,
  business_status: "in_stock",
  unit_version: item.version,
  allowed_actions: ["reservation.create"],
  projection: {
    mode: "exact",
    status: "in_stock",
    confidence: "high",
    needs_review: false,
    allowed_actions: ["reservation.create"],
  },
});

const baseProps = (
  overrides: Partial<React.ComponentProps<typeof InventoryProductDetailWorkbench>> = {},
) => {
  const item = productFixture();
  return {
    item,
    lifecycleSummary: reserveSummary(item),
    canEdit: true,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onNavigate: vi.fn(),
    ...overrides,
  };
};

function renderWorkbench(
  props: React.ComponentProps<typeof InventoryProductDetailWorkbench>,
  locale: AppLocale = "zh-CN",
) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <InventoryProductDetailWorkbench {...props} />
    </LocaleProvider>,
  );
}

function requireHTMLElement(element: Element | null): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected the inventory action dock to be an HTMLElement");
  }
  return element;
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

describe("InventoryProductDetailWorkbench Storybook composition contract", () => {
  it.each([
    [
      "zh-CN",
      "商品详情",
      "设备工作台",
      "经营信息",
      "设备身份",
      "编辑商品",
      "2026年8月11日 09:42",
      "€899.00",
    ],
    [
      "it-IT",
      "Dettagli prodotto",
      "Area di lavoro dispositivo",
      "Informazioni commerciali",
      "Identità dispositivo",
      "Modifica prodotto",
      "11 ago 2026, 09:42",
      "€899,00",
    ],
    [
      "en",
      "Product details",
      "Device workbench",
      "Business information",
      "Device identity",
      "Edit product",
      "Aug 11, 2026, 9:42 AM",
      "€899.00",
    ],
  ] as const)(
    "localizes owned detail chrome in %s while preserving custom values",
    (locale, title, workbench, business, identity, action, date, money) => {
      const item = productFixture();
      item.brand = "动态品牌 Ω";
      item.model = "Modello 客制";
      item.location = "展柜 Z-9";
      item.notes = "保留 note Ω";
      item.color = "Custom 朱红";
      item.specifications = { custom_spec_原值: "Spec 值 Ω" };

      const { container } = renderWorkbench(
        baseProps({ item, lifecycleSummary: undefined, lifecycleSummaryState: "dormant" }),
        locale,
      );

      expect(screen.getByRole("heading", { level: 1, name: title })).toBeVisible();
      expect(screen.getByRole("heading", { name: workbench })).toBeVisible();
      expect(screen.getByRole("heading", { name: business })).toBeVisible();
      expect(screen.getByRole("heading", { name: identity })).toBeVisible();
      expect(screen.getAllByRole("button", { name: action }).length).toBeGreaterThan(0);
      expect(screen.getAllByText(date).length).toBeGreaterThan(0);
      expect(screen.getAllByText(money).length).toBeGreaterThan(0);
      for (const value of [
        "动态品牌 Ω Modello 客制",
        "展柜 Z-9",
        "保留 note Ω",
        "Custom 朱红",
        "custom_spec_原值",
        "Spec 值 Ω",
      ]) {
        expect(container.textContent).toContain(value);
      }
    },
  );

  it("passes the merged inspection summary to the production render slot", () => {
    const item = productFixture();
    item.inspection = {
      id: "item-inspection",
      battery_health: 91,
      face_id_status: "normal",
      inspected_at: "2026-08-12T08:00:00.000Z",
    };
    const summary = reserveSummary(item);
    summary.inspection = {
      battery_health: 97,
      face_id_status: "not_tested",
      touch_id_status: "not_tested",
      true_tone_status: "not_tested",
      activation_lock_status: "not_tested",
      data_wipe_status: "not_tested",
      imei_status: "not_tested",
      inspected_at: "2026-08-11T08:00:00.000Z",
    };
    const renderInspectionEditor = vi.fn((merged) => (
      <output data-testid="inspection-slot-summary">
        {`${merged.inspection?.battery_health}:${merged.inspection?.face_id_status}:${merged.inspection?.inspected_at}`}
      </output>
    ));

    renderWorkbench({ ...baseProps({ item, lifecycleSummary: summary }), renderInspectionEditor });

    expect(renderInspectionEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        inspection: expect.objectContaining({
          battery_health: 91,
          face_id_status: "normal",
          inspected_at: "2026-08-12T08:00:00.000Z",
        }),
      }),
    );
    expect(screen.getByTestId("inspection-slot-summary")).toHaveTextContent(
      "91:normal:2026-08-12T08:00:00.000Z",
    );
  });

  it.each([
    ["lifecycle-only", undefined, "97:not_tested"],
    [
      "product-only",
      { battery_health: 91, face_id_status: "normal", inspected_at: "2026-08-12" },
      "91:normal",
    ],
  ])("keeps the %s inspection source available to the slot", (_label, itemInspection, expected) => {
    const item = productFixture();
    item.inspection = itemInspection as InventoryProductDetail["inspection"];
    const renderInspectionEditor = vi.fn((merged) => (
      <output data-testid="inspection-slot-source">
        {`${merged.inspection?.battery_health}:${merged.inspection?.face_id_status}`}
      </output>
    ));
    const summary = reserveSummary(item);
    if (_label === "lifecycle-only") {
      summary.inspection = {
        battery_health: 97,
        face_id_status: "not_tested",
        touch_id_status: "not_tested",
        true_tone_status: "not_tested",
        activation_lock_status: "not_tested",
        data_wipe_status: "not_tested",
        imei_status: "not_tested",
        inspected_at: "2026-08-11",
      };
      item.inspection = undefined;
    }
    renderWorkbench({ ...baseProps({ item, lifecycleSummary: summary }), renderInspectionEditor });
    expect(screen.getByTestId("inspection-slot-source")).toHaveTextContent(expected);
  });

  it("does not invoke the render slot for product-only fallback without lifecycle data", () => {
    const renderInspectionEditor = vi.fn(() => <div data-testid="inspection-slot" />);
    renderWorkbench(
      baseProps({
        lifecycleSummary: undefined,
        lifecycleSummaryState: "dormant",
        renderInspectionEditor,
      }),
    );
    expect(renderInspectionEditor).not.toHaveBeenCalled();
    expect(screen.queryByTestId("inspection-slot")).not.toBeInTheDocument();
  });

  it("keeps the ready reserve action local and exposes one mobile dock action", () => {
    const onNavigate = vi.fn();
    renderWorkbench(baseProps({ onNavigate }));

    const dock = requireHTMLElement(
      screen
        .getByRole("button", { name: "开始预订" })
        .closest('[data-ui="inventory-detail-action-dock"]'),
    );
    fireEvent.click(within(dock).getByRole("button", { name: "开始预订" }));

    expect(onNavigate).toHaveBeenCalledWith("/inventory/story-workbench-test/reserve");
    expect(screen.getByText("当前业务")).toBeVisible();
  });

  it("keeps lifecycle loading non-guessing and aria-busy", () => {
    renderWorkbench(baseProps({ lifecycleSummary: undefined, lifecycleSummaryState: "loading" }));

    const loading = screen
      .getAllByRole("status")
      .find((element) => element.getAttribute("data-ui") !== "inventory-detail-action-dock");
    expect(loading).toBeTruthy();
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "开始预订" })).not.toBeInTheDocument();
  });

  it("keeps unavailable lifecycle with canEdit fallback in the synthetic boundary", () => {
    const onNavigate = vi.fn();
    const { container } = renderWorkbench(
      baseProps({
        lifecycleSummary: undefined,
        lifecycleSummaryState: "unavailable",
        onNavigate,
      }),
    );

    const unavailable = container.querySelector('[data-ui="inventory-lifecycle-unavailable"]');
    expect(unavailable).toHaveAttribute("role", "status");
    const dock = requireHTMLElement(
      container.querySelector('[data-ui="inventory-detail-action-dock"]'),
    );
    fireEvent.click(within(dock).getByRole("button", { name: "编辑商品" }));
    expect(onNavigate).toHaveBeenCalledWith("/inventory/story-workbench-test/edit");
  });

  it("keeps the desktop two-column contract while hiding the fixed dock at lg", () => {
    const { container } = renderWorkbench(baseProps());

    expect(container.querySelector('[class*="lg:grid-cols-"]')).not.toBeNull();
    expect(container.querySelector('[data-ui="inventory-detail-action-dock"]')).toHaveClass(
      "lg:hidden",
    );
    expect(container.querySelector('[data-ui="inventory-lifecycle-summary"] a')).toHaveClass(
      "max-lg:hidden",
    );
    const desktopEdit = container.querySelector('header[class*="lg:flex"] button');
    expect(desktopEdit).toHaveClass("min-h-11");
  });
});
