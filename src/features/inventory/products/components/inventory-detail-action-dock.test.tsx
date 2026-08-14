import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InventoryDetailActionDock } from "./inventory-detail-action-dock";

describe("InventoryDetailActionDock", () => {
  it("renders one accessible mobile primary action with a 44px target", () => {
    render(
      <InventoryDetailActionDock
        action={{
          kind: "action",
          id: "sale-pickup",
          label: "确认客户取走",
          href: "/inventory/sales/sale-1",
          command: "pickup.confirm",
        }}
        onAction={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "确认客户取走" });
    expect(button).toHaveClass("min-h-11", "w-full");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "确认客户取走" })).toBeVisible();
  });

  it("renders a non-guessing loading status instead of edit", () => {
    render(
      <InventoryDetailActionDock
        action={{ kind: "loading", label: "正在读取下一动作", reason: "lifecycle-loading" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("正在读取下一动作")).toBeVisible();
    expect(screen.queryByRole("button", { name: "编辑商品" })).not.toBeInTheDocument();
  });

  it("does not render a dock for a server-confirmed no-action state", () => {
    const { container } = render(
      <InventoryDetailActionDock action={{ kind: "none", reason: "no-server-action" }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
