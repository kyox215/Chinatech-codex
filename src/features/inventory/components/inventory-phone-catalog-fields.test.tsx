import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogCombobox, InventoryPhoneCatalogFields } from "./inventory-phone-catalog-fields";

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
    value: vi.fn((query: string) => {
      const maxWidth = Number(query.match(/max-width:\s*(\d+)px/)?.[1]);
      return {
        matches: Number.isFinite(maxWidth) ? width <= maxWidth : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
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

function renderCatalogCombobox(
  overrides: Partial<React.ComponentProps<typeof CatalogCombobox>> = {},
) {
  const props: React.ComponentProps<typeof CatalogCombobox> = {
    id: "catalog-test",
    label: "品牌",
    value: "",
    placeholder: "选择品牌",
    options: [
      { value: "Apple", keywords: "iphone" },
      { value: "Samsung", keywords: "galaxy" },
    ],
    onSelect: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<CatalogCombobox {...props} />) };
}

async function expectOpenListboxFor(trigger: HTMLElement) {
  fireEvent.click(trigger);
  await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
  await waitFor(() => {
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const listbox = controls ? document.getElementById(controls) : null;
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute("role", "listbox");
    expect(listbox).toBeVisible();
  });
  return document.getElementById(trigger.getAttribute("aria-controls") ?? "");
}

describe("InventoryPhoneCatalogFields", () => {
  it("opens the fixed mobile picker with a button trigger and explicit search", async () => {
    setViewportWidth(390);
    renderFields({ brand: "", model: "", storageCapacity: "", color: "" });

    const trigger = screen.getByRole("combobox", { name: "品牌 *" });
    expect(trigger).toHaveAttribute("data-ui", "inventory-catalog-combobox-trigger");
    expect(trigger).toHaveAttribute("data-inventory-catalog-trigger-id", "inventory-brand");
    expect(trigger).toHaveClass("h-11", "min-h-11");
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog", { name: "品牌" })).toHaveAttribute(
      "data-inventory-catalog-picker",
      "mobile",
    );
    const closeButton = screen.getByRole("button", { name: "关闭品牌选择" });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveClass("size-11", "h-11", "w-11", "min-h-11", "min-w-11");
    expect(document.querySelector("[data-inventory-catalog-list]")).toHaveClass(
      "overscroll-contain",
      "[touch-action:pan-y]",
    );
    expect(screen.queryByPlaceholderText("搜索手机品牌或手动输入")).not.toBeInTheDocument();
    const searchAction = screen.getByRole("button", { name: "搜索目录或手动输入" });
    expect(searchAction).toBeVisible();
    expect(searchAction).toHaveClass("h-11", "min-h-11");
    await searchAction.click();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("搜索手机品牌或手动输入")).toHaveFocus(),
    );
    fireEvent.change(screen.getByPlaceholderText("搜索手机品牌或手动输入"), {
      target: { value: "Unknown mobile brand" },
    });
    expect(screen.getByRole("option", { name: "使用“Unknown mobile brand”" })).toHaveClass(
      "min-h-11",
    );
  });

  it("uses the fixed picker on touch-first tablet widths", async () => {
    setViewportWidth(820);
    renderFields({ brand: "", model: "", storageCapacity: "", color: "" });

    fireEvent.click(screen.getByRole("combobox", { name: "品牌 *" }));

    expect(await screen.findByRole("dialog", { name: "品牌" })).toHaveAttribute(
      "data-inventory-catalog-picker",
      "mobile",
    );
    expect(screen.queryByPlaceholderText("搜索手机品牌或手动输入")).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "搜索目录或手动输入" }).click();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("搜索手机品牌或手动输入")).toHaveFocus(),
    );
  });

  it.each([360, 390, 430])(
    "keeps compact selector triggers readable and touch-safe at %dpx",
    (width) => {
      setViewportWidth(width);
      renderFields({ brand: "", model: "", storageCapacity: "", color: "" });

      const trigger = screen.getByRole("combobox", { name: "品牌 *" });
      expect(trigger).toHaveClass("text-sm", "min-h-11");
      expect(trigger).not.toHaveClass("text-base");
      expect(trigger).toHaveTextContent("选择品牌");
    },
  );

  it("keeps the anchored catalog popover on desktop", async () => {
    renderFields({ brand: "", model: "", storageCapacity: "", color: "" });

    const trigger = screen.getByRole("combobox", { name: "品牌 *" });
    expect(trigger).not.toHaveAttribute("aria-controls");
    fireEvent.click(trigger);

    expect(
      document.querySelector('[data-inventory-catalog-command="desktop"]'),
    ).toBeInTheDocument();
    await waitFor(() => {
      const controls = trigger.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(controls).not.toBe("inventory-brand-catalog-list");
      expect(controls ? document.getElementById(controls) : null).toHaveAttribute(
        "data-inventory-catalog-list",
        "true",
      );
    });
    expect(document.querySelector('[data-inventory-catalog-picker="mobile"]')).toBeNull();

    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => {
      expect(trigger).not.toHaveAttribute("aria-controls");
      expect(trigger).toHaveFocus();
    });
  });

  it.each([
    ["desktop button", 1024, false],
    ["desktop editable input", 1024, true],
    ["compact button", 390, false],
  ] as const)(
    "captures the mounted listbox id for the %s branch and clears it on Escape",
    async (_name, width, editable) => {
      setViewportWidth(width);
      const { props } = renderCatalogCombobox({ editable });
      const trigger = screen.getByRole("combobox", { name: "品牌" });

      expect(trigger).not.toHaveAttribute("aria-controls");
      await expectOpenListboxFor(trigger);
      const controls = trigger.getAttribute("aria-controls");
      expect(controls).not.toBe("catalog-test-catalog-list");

      fireEvent.keyDown(trigger, { key: "Escape" });
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute("aria-controls");
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(trigger).toHaveFocus();
      });
      expect(props.onSelect).not.toHaveBeenCalled();
    },
  );

  it("clears the resolved listbox id and restores focus after selecting an option", async () => {
    setViewportWidth(1024);
    const { props } = renderCatalogCombobox();
    const trigger = screen.getByRole("combobox", { name: "品牌" });

    await expectOpenListboxFor(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Apple" }));

    await waitFor(() => {
      expect(props.onSelect).toHaveBeenCalledWith({ value: "Apple", fromCatalog: true });
      expect(trigger).not.toHaveAttribute("aria-controls");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });
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
