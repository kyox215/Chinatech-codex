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
  it("opens the mobile picker with a non-editable trigger and explicit search", async () => {
    setViewportWidth(390);
    renderFields();

    fireEvent.click(screen.getByRole("combobox", { name: "品牌 *" }));

    expect(await screen.findByRole("dialog", { name: "品牌" })).toHaveAttribute(
      "data-inventory-catalog-picker",
      "mobile",
    );
    expect(document.querySelector("[data-inventory-catalog-search]")).toBeNull();
    expect(screen.getByRole("button", { name: "搜索目录或手动输入" })).toBeVisible();
    await screen.getByRole("button", { name: "搜索目录或手动输入" }).click();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("搜索手机品牌或手动输入")).toHaveFocus(),
    );
  });

  it.each([
    {
      category: "phone" as const,
      helper: "常见品牌：Apple、Samsung、小米",
      search: "搜索手机品牌或手动输入",
    },
    {
      category: "tablet" as const,
      helper: "常见品牌：Apple、Samsung、Lenovo",
      search: "搜索平板品牌或手动输入",
    },
    {
      category: "computer" as const,
      helper: "常见品牌：Apple、Dell、Lenovo、HP",
      search: "搜索电脑品牌或手动输入",
    },
    {
      category: "game_console" as const,
      helper: "常见品牌：PlayStation、Nintendo、Xbox",
      search: "搜索游戏机品牌或手动输入",
    },
    {
      category: "other" as const,
      helper: "目录外品牌可直接手动填写。",
      search: "搜索品牌或手动输入",
    },
  ])("keeps compact copy category-specific for $category", async ({ category, helper, search }) => {
    setViewportWidth(390);
    renderFields({ category });
    const trigger = screen.getByRole("combobox", { name: "品牌 *" });
    expect(trigger).toHaveTextContent("选择品牌");
    expect(screen.getByText(helper)).toBeVisible();
    fireEvent.click(trigger);
    expect(screen.queryByText("例如 Apple、Samsung")).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "搜索目录或手动输入" }).click();
    await waitFor(() => expect(screen.getByPlaceholderText(search)).toHaveFocus());
  });

  it("uses an inline selector inside the create dialog without a second dialog root", async () => {
    setViewportWidth(390);
    renderFields({ category: "game_console", surface: "dialog" });

    const trigger = screen.getByRole("combobox", { name: "品牌 *" });
    expect(trigger.tagName).toBe("BUTTON");
    fireEvent.click(trigger);

    expect(await screen.findByRole("region", { name: "品牌选择" })).toBeVisible();
    const closeButton = screen.getByRole("button", { name: "关闭品牌选择" });
    expect(closeButton).toHaveClass("size-11", "h-11", "w-11", "min-h-11", "min-w-11");
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(screen.getAllByText("常见品牌：PlayStation、Nintendo、Xbox").length).toBeGreaterThan(0);
    expect(screen.queryByText("例如 Apple、Samsung")).not.toBeInTheDocument();
    expect(document.querySelector("[data-inventory-catalog-search]")).toBeNull();

    await screen.getByRole("button", { name: "搜索目录或手动输入" }).click();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("搜索游戏机品牌或手动输入")).toHaveFocus(),
    );
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
        if (width < 1024) {
          await screen.getByRole("button", { name: "搜索目录或手动输入" }).click();
        }
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

  it("gives console storage a full row and keeps long model options to two lines", async () => {
    setViewportWidth(390);
    renderFields({ category: "game_console", brand: "Nintendo" });

    const storageField = document.querySelector("#product-storage")?.closest("fieldset");
    expect(storageField).toHaveClass("col-span-2");

    fireEvent.click(screen.getByRole("combobox", { name: "型号 / 商品名称 *" }));
    const modelOption = await screen.findByText("Nintendo Switch OLED Model", { exact: true });
    expect(modelOption).toHaveClass("line-clamp-2", "whitespace-normal", "break-words");
  });

  it.each([360, 390, 430])("keeps compact device triggers at 14px and 44px at %dpx", (width) => {
    setViewportWidth(width);
    renderFields({ category: "game_console" });

    const trigger = screen.getByRole("combobox", { name: "品牌 *" });
    expect(trigger).toHaveClass("text-sm", "min-h-11");
    expect(trigger).not.toHaveClass("text-base");
    expect(trigger).toHaveTextContent("选择品牌");
  });

  it.each([320, 359, 360])(
    "declares a single-column fallback below 360px and a paired selector breakpoint at %dpx",
    (width) => {
      setViewportWidth(width);
      renderFields({ category: "game_console" });

      const selectorGrid = screen.getByRole("combobox", { name: "品牌 *" }).closest("div.grid");
      expect(selectorGrid).not.toBeNull();
      expect(selectorGrid).toHaveClass(
        "grid-cols-1",
        "min-[360px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]",
      );
    },
  );
});
