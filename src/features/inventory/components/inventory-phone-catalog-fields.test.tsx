import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryPhoneCatalogFields } from "./inventory-phone-catalog-fields";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  setViewportWidth(1024);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width") ? width < 768 : width >= 768,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
  it("uses a fixed mobile drawer with an isolated touch scroll surface", async () => {
    setViewportWidth(390);
    renderFields({ brand: "", model: "", storageCapacity: "", color: "" });

    fireEvent.click(screen.getByRole("combobox", { name: "品牌 *" }));

    expect(await screen.findByRole("dialog", { name: "品牌" })).toHaveAttribute(
      "data-inventory-catalog-picker",
      "mobile",
    );
    expect(screen.getByRole("button", { name: "关闭品牌选择" })).toBeInTheDocument();
    expect(document.querySelector("[data-inventory-catalog-list]")).toHaveClass(
      "overscroll-contain",
      "[touch-action:pan-y]",
    );
  });

  it("keeps the anchored catalog popover on desktop", async () => {
    renderFields({ brand: "", model: "", storageCapacity: "", color: "" });

    fireEvent.click(screen.getByRole("combobox", { name: "品牌 *" }));

    expect(
      document.querySelector('[data-inventory-catalog-command="desktop"]'),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-inventory-catalog-picker="mobile"]')).toBeNull();
  });

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
