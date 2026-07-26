import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryPhoneCatalogFields } from "./inventory-phone-catalog-fields";

afterEach(cleanup);

function renderFields(
  overrides: Partial<React.ComponentProps<typeof InventoryPhoneCatalogFields>> = {},
) {
  const props: React.ComponentProps<typeof InventoryPhoneCatalogFields> = {
    brand: "Apple",
    model: "iPhone 15 Pro",
    ramCapacity: "",
    storageCapacity: "256 GB",
    color: "原色钛金属",
    onBrandSelect: vi.fn(),
    onModelSelect: vi.fn(),
    onRamChange: vi.fn(),
    onStorageChange: vi.fn(),
    onColorChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<InventoryPhoneCatalogFields {...props} />) };
}

describe("InventoryPhoneCatalogFields", () => {
  it("shows each color as an accessible name plus a visual swatch", () => {
    renderFields();

    const selectedColor = screen.getByRole("radio", { name: "颜色：原色钛金属，已选择" });
    expect(selectedColor).toHaveTextContent("原色钛金属");
    expect(selectedColor.querySelector('[aria-hidden="true"]')).toHaveAttribute("style");
    expect(screen.getByRole("radiogroup", { name: "颜色" })).toBeInTheDocument();
  });

  it("keeps Apple RAM optional and never presents guessed RAM choices", () => {
    renderFields();
    expect(screen.getByText(/Apple 未在产品页公开 RAM/)).toBeInTheDocument();
    expect(screen.getByLabelText("内存手动填写")).toBeInTheDocument();
  });

  it("sends the canonical color name instead of the CSS swatch value", () => {
    const { props } = renderFields({ color: "" });
    fireEvent.click(screen.getByRole("radio", { name: "颜色：蓝色钛金属" }));
    expect(props.onColorChange).toHaveBeenCalledWith("蓝色钛金属");
  });

  it("preserves catalog-external drafts and keeps manual configuration fields available", () => {
    renderFields({ brand: "Custom Brand", model: "Workshop Prototype", color: "Custom Pearl" });
    expect(screen.getByText(/当前品牌或型号不在标准目录中/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom Pearl")).toBeInTheDocument();
    expect(screen.getByLabelText("颜色")).toBeInTheDocument();
  });
});
