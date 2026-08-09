import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryDeviceCatalogFields } from "./inventory-device-catalog-fields";

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
  overrides: Partial<React.ComponentProps<typeof InventoryDeviceCatalogFields>> = {},
) {
  const props: React.ComponentProps<typeof InventoryDeviceCatalogFields> = {
    category: "phone",
    brand: "",
    model: "",
    ramCapacity: "",
    storageCapacity: "",
    color: "",
    onBrandChange: vi.fn(),
    onModelChange: vi.fn(),
    onRamChange: vi.fn(),
    onStorageChange: vi.fn(),
    onColorChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<InventoryDeviceCatalogFields {...props} />) };
}

describe("InventoryDeviceCatalogFields", () => {
  it("opens the mobile picker without auto-focusing its search input", async () => {
    setViewportWidth(390);
    renderFields();

    fireEvent.click(screen.getByRole("combobox", { name: "品牌 *" }));

    expect(await screen.findByRole("dialog", { name: "品牌" })).toHaveAttribute(
      "data-inventory-catalog-picker",
      "mobile",
    );
    expect(document.querySelector("[data-inventory-catalog-search]")).not.toHaveFocus();
  });

  it("opens the desktop picker with ArrowDown or Alt+ArrowDown without hijacking Enter", async () => {
    renderFields();
    const trigger = screen.getByRole("combobox", { name: "品牌 *" });

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(
      document.querySelector('[data-inventory-catalog-command="desktop"]'),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "ArrowDown", altKey: true });
    await waitFor(() =>
      expect(
        document.querySelector('[data-inventory-catalog-command="desktop"]'),
      ).toBeInTheDocument(),
    );
  });

  it("shows grouped PS models and preserves a manual model path", async () => {
    renderFields({ category: "game_console", brand: "Sony / PlayStation" });
    fireEvent.click(screen.getByTitle("型号 / 商品名称"));
    expect(await screen.findByText("PS5 光驱版")).toBeInTheDocument();
    expect(screen.getByText(/PlayStation 5 ·/)).toBeInTheDocument();

    cleanup();
    const { props } = renderFields({ brand: "Custom" });
    fireEvent.change(screen.getByRole("combobox", { name: "型号 / 商品名称 *" }), {
      target: { value: "Workshop Prototype" },
    });
    expect(props.onModelChange).toHaveBeenCalledWith("Workshop Prototype");
  });

  it("searches PS3 as its canonical model instead of returning the Slim alias", async () => {
    renderFields({ category: "game_console", brand: "Sony / PlayStation" });
    fireEvent.click(screen.getByTitle("型号 / 商品名称"));

    await waitFor(() =>
      expect(document.querySelector("[data-inventory-catalog-search]")).toBeInTheDocument(),
    );
    const search = document.querySelector<HTMLInputElement>("[data-inventory-catalog-search]");
    if (!search) throw new Error("catalog search input did not open");
    fireEvent.input(search, { target: { value: "PS3" } });

    expect(await screen.findByText("PS3", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("PS3 Slim", { exact: true })).not.toBeInTheDocument();
  });

  it.each([
    { width: 1024, close: "select" as const },
    { width: 390, close: "dismiss" as const },
  ])(
    "returns focus to the $close trigger after picker closes ($width px)",
    async ({ width, close }) => {
      setViewportWidth(width);
      const { props } = renderFields({ category: "game_console", brand: "Sony / PlayStation" });
      const trigger = screen.getByRole("combobox", { name: "型号 / 商品名称 *" });
      fireEvent.click(trigger);

      if (close === "select") {
        await waitFor(() =>
          expect(document.querySelector("[data-inventory-catalog-search]")).toBeInTheDocument(),
        );
        const search = document.querySelector<HTMLInputElement>("[data-inventory-catalog-search]");
        if (!search) throw new Error("catalog search input did not open");
        fireEvent.input(search, { target: { value: "PS5" } });
        fireEvent.click(await screen.findByText("PS5 光驱版", { exact: true }));
        expect(props.onModelChange).toHaveBeenCalledWith("PS5 光驱版");
      } else {
        fireEvent.click(await screen.findByRole("button", { name: "关闭型号 / 商品名称选择" }));
      }

      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );

  it("renders storage, RAM and color suggestions without overwriting manual values", () => {
    const { props } = renderFields({
      brand: "Apple",
      model: "iPhone 15 Pro",
      ramCapacity: "12 GB manual",
      storageCapacity: "512 GB",
      color: "Custom Pearl",
    });
    expect(screen.getByDisplayValue("12 GB manual")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom Pearl")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "颜色：原色钛金属" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "颜色：蓝色钛金属" }));
    expect(props.onColorChange).toHaveBeenCalledWith("蓝色钛金属");
  });
});
