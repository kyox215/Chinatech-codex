import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryProductCategoryTabs } from "./inventory-product-queue-components";

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
});
