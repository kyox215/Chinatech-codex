import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  InventoryProductCategory,
  InventoryProductFaceIdStatus,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
} from "@/lib/repairdesk/types";

import { createInventoryProductFormDraft } from "../model/inventory-product-form";
import { InventoryProductFormWorkspace } from "./inventory-product-form-workspace";

function renderWorkspace(
  overrides: Partial<React.ComponentProps<typeof InventoryProductFormWorkspace>> = {},
) {
  const props: React.ComponentProps<typeof InventoryProductFormWorkspace> = {
    draft: createInventoryProductFormDraft("phone"),
    canEnterCost: false,
    showScanner: false,
    onCategoryChange: vi.fn<(category: InventoryProductCategory) => void>(),
    onBrandChange: vi.fn<(value: string) => void>(),
    onModelChange: vi.fn<(value: string) => void>(),
    onRamChange: vi.fn<(value: string) => void>(),
    onStorageChange: vi.fn<(value: string) => void>(),
    onColorChange: vi.fn<(value: string) => void>(),
    onIdentifierChange: vi.fn<(kind: InventoryProductIdentifierKind, value: string) => void>(),
    onIdentifierSource:
      vi.fn<
        (
          kind: InventoryProductIdentifierKind,
          source: Extract<InventoryProductIdentifierSource, "manual" | "scan">,
        ) => void
      >(),
    onConditionChange: vi.fn<(value: string) => void>(),
    onGtinChange: vi.fn<(value: string) => void>(),
    onSpecificationChange: vi.fn<(key: string, value: string) => void>(),
    onListPriceChange: vi.fn<(value: string) => void>(),
    onCostChange: vi.fn<(value: string) => void>(),
    onLocationChange: vi.fn<(value: string) => void>(),
    onWarrantyChange: vi.fn<(value: string) => void>(),
    onNotesChange: vi.fn<(value: string) => void>(),
    onInspectionBatteryHealthChange: vi.fn<(value: string) => void>(),
    onInspectionFaceIdStatusChange: vi.fn<(value: InventoryProductFaceIdStatus) => void>(),
    ...overrides,
  };
  return render(<InventoryProductFormWorkspace {...props} />);
}

describe("InventoryProductFormWorkspace", () => {
  it("keeps the shared form/details/identifier body and redacts cost when unavailable", () => {
    renderWorkspace();

    expect(screen.getByText("类别")).toBeInTheDocument();
    expect(screen.getByLabelText("计划售价")).toBeInTheDocument();
    expect(screen.getByText("设备标识")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /更多信息/ }));
    expect(screen.getByLabelText("成色")).toBeInTheDocument();
    expect(screen.queryByLabelText("入库成本")).not.toBeInTheDocument();
  });

  it("surfaces acquisition cost beside sale price only with the existing permission", () => {
    renderWorkspace({ canEnterCost: true });

    expect(screen.getByLabelText("计划售价")).toBeInTheDocument();
    expect(screen.getByLabelText("入库成本")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /更多信息/ }));
    expect(screen.getByLabelText("入库成本")).toBeInTheDocument();
  });

  it("renders exactly one explicit desktop workbench shell with primary details visible", () => {
    renderWorkspace({ layoutMode: "desktop" });

    const shell = document.querySelector('[data-inventory-product-form-shell="desktop-workbench"]');
    expect(shell).toBeInTheDocument();
    expect(document.querySelectorAll("[data-inventory-product-form-shell]")).toHaveLength(1);
    expect(shell).toHaveClass("lg:grid-cols-3");
    expect(shell).not.toHaveClass("min-[1440px]:grid-cols-4");
    expect(
      document.querySelector('[data-ui="inventory-product-form-primary-details"]'),
    ).toBeVisible();
    expect(screen.getByLabelText("成色")).toBeVisible();
    expect(screen.getByText("设备标识")).toBeVisible();
    expect(
      document.querySelector('[data-inventory-product-form-shell="mobile-compact"]'),
    ).toBeNull();
  });

  it("renders only the compact shell for mobile mode and keeps primary fields on-page", () => {
    renderWorkspace({ layoutMode: "compact" });

    expect(
      document.querySelector('[data-inventory-product-form-shell="mobile-compact"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-inventory-product-form-shell="desktop-workbench"]'),
    ).toBeNull();
    expect(screen.getByLabelText("成色")).toBeVisible();
    expect(screen.getByText("设备标识")).toBeVisible();
  });

  it("uses the shared disclosure field for Face ID status", () => {
    const draft = createInventoryProductFormDraft("phone");
    draft.brand = "Apple";
    draft.model = "iPhone 15 Pro";
    renderWorkspace({ draft, layoutMode: "desktop", inspectionEnabled: true });

    expect(screen.getByRole("combobox", { name: "Face ID 检测状态：未检测" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "正常" })).not.toBeInTheDocument();
  });

  it("marks only the configured identifier as required", () => {
    renderWorkspace({ requiredIdentifierKinds: { imei1: true } });

    expect(screen.getByLabelText("IMEI 1")).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText("IMEI 2")).not.toHaveAttribute("aria-required");
    expect(screen.getByText("IMEI 1").parentElement).toHaveTextContent("IMEI 1*");
  });
});
