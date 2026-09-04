import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";

import {
  InventoryLifecycleShortcutBar,
  InventoryProductCard,
  InventoryProductCategoryTabs,
  InventoryProductViewToggle,
} from "./inventory-product-queue-components";

afterEach(cleanup);

describe("InventoryProductCategoryTabs", () => {
  it("uses wrapped semantic category controls with 44px minimum targets", () => {
    const onChange = vi.fn();
    render(<InventoryProductCategoryTabs filters={{ categories: [] }} onChange={onChange} />);

    const group = screen.getByRole("group", { name: "商品分类" });
    expect(group).toHaveClass("grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))]");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);
    for (const button of buttons) {
      expect(button).toHaveClass("min-h-11", "min-w-11", "text-xs");
    }

    fireEvent.click(screen.getByRole("button", { name: /手机/ }));
    expect(onChange).toHaveBeenCalledWith(["phone"]);
  });

  it.each([
    ["zh-CN", "Apple 客制 iPhone 15 Pro 商品参考图", "颜色 蓝色钛金属", "颜色：蓝色钛金属"],
    [
      "it-IT",
      "Immagine di riferimento di Apple 客制 iPhone 15 Pro",
      "Colore prodotto: 蓝色钛金属",
      "Colore: 蓝色钛金属",
    ],
    [
      "en",
      "Apple 客制 iPhone 15 Pro product reference image",
      "Product color: 蓝色钛金属",
      "Color: 蓝色钛金属",
    ],
  ] as const)(
    "localizes reference-image chrome but preserves inferred color values in %s",
    (locale, referenceAlt, colorAria, colorTitle) => {
      render(
        <LocaleProvider initialLocale={locale as AppLocale}>
          <InventoryProductCard
            view="shelf"
            item={{
              id: "product-reference",
              sku: "SKU-动态-REF",
              category: "phone",
              brand: "Apple 客制",
              model: "iPhone 15 Pro",
              color: "蓝色钛金属",
              specification: "256 GB · 蓝色钛金属",
              masked_identifier: "•••• 2233",
              status: "in_stock",
              location: "展柜 动态",
              list_price: 999,
              currency_code: "EUR",
              updated_at: "2026-10-25T01:30:00.000Z",
            }}
          />
        </LocaleProvider>,
      );

      expect(screen.getByRole("img", { name: referenceAlt })).toHaveAttribute(
        "src",
        "/inventory-reference/iphone-modern.webp",
      );
      expect(screen.getByRole("img", { name: colorAria })).toHaveTextContent("蓝色钛金属");
      expect(screen.getByRole("img", { name: colorAria })).toHaveAttribute("title", colorTitle);
      expect(screen.getByText("Apple 客制 iPhone 15 Pro")).toBeVisible();
    },
  );

  it.each([
    ["zh-CN", "暂无图片", "生命周期工作入口", "商品列表视图"],
    [
      "it-IT",
      "Nessuna immagine di riferimento",
      "Filtri rapidi del ciclo inventario",
      "Cambia vista inventario",
    ],
    ["en", "No reference image", "Inventory lifecycle quick filters", "Change inventory view"],
  ] as const)(
    "localizes no-image, shortcut and view semantics while keeping callbacks canonical in %s",
    (locale, noImage, shortcutAria, viewAria) => {
      const onShortcut = vi.fn();
      const onView = vi.fn();
      render(
        <LocaleProvider initialLocale={locale as AppLocale}>
          <InventoryProductCard
            view="list"
            item={{
              id: "product-no-reference",
              sku: "SKU-DYNAMIC-NO-IMAGE",
              category: "other",
              brand: "Brand 动态",
              model: "Model Custom",
              status: "in_stock",
              currency_code: "EUR",
              updated_at: "2026-10-25T01:30:00.000Z",
            }}
          />
          <InventoryLifecycleShortcutBar value="all" onChange={onShortcut} />
          <InventoryProductViewToggle value="shelf" onChange={onView} />
        </LocaleProvider>,
      );

      expect(screen.getByText(noImage)).toBeVisible();
      fireEvent.click(screen.getByRole("group", { name: shortcutAria }).querySelector("button")!);
      expect(onShortcut).toHaveBeenCalledWith("in_stock");
      const viewGroup = screen.getByRole("group", { name: viewAria });
      fireEvent.click(viewGroup.querySelectorAll("button")[1]!);
      expect(onView).toHaveBeenCalledWith("list");
      expect(screen.getByText("Brand 动态 Model Custom")).toBeVisible();
      expect(screen.getByText("SKU SKU-DYNAMIC-NO-IMAGE")).toBeVisible();
    },
  );
});
