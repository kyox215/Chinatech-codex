import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InventoryAvailabilityStateCard } from "./inventory-availability-state-card";
import type {
  InventoryAvailabilityResolution,
  InventoryAvailabilityState,
} from "../model/inventory-availability";

function availability(state: InventoryAvailabilityState): InventoryAvailabilityResolution {
  return { state, retryable: state === "service-unavailable" };
}

describe("InventoryAvailabilityStateCard", () => {
  it("does not render an availability card for an already available read", () => {
    const { container } = render(
      <InventoryAvailabilityStateCard availability={availability("available")} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps access-denied states private and does not offer retry", () => {
    const { rerender } = render(
      <InventoryAvailabilityStateCard availability={availability("no-permission")} />,
    );
    expect(screen.getByRole("heading", { name: "当前账号没有访问权限" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "只读重试" })).not.toBeInTheDocument();
    expect(screen.queryByText(/SKU|sale-|IMEI|€|\bI\d/)).not.toBeInTheDocument();
    rerender(<InventoryAvailabilityStateCard availability={availability("feature-off")} />);
    expect(screen.getByRole("heading", { name: "生命周期工作流未启用" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "只读重试" })).not.toBeInTheDocument();
  });

  it("renders loading and retrying as busy status with hidden skeleton", () => {
    const { rerender } = render(
      <InventoryAvailabilityStateCard availability={availability("loading")} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status").querySelector("[aria-hidden='true']")).toBeTruthy();
    rerender(<InventoryAvailabilityStateCard availability={availability("retrying")} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("offers only read retry for service unavailable", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <InventoryAvailabilityStateCard
        availability={availability("service-unavailable")}
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole("button", { name: "只读重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("没有执行写入");
  });

  it("does not leak details for hidden records", () => {
    render(<InventoryAvailabilityStateCard availability={availability("not-found-or-hidden")} />);
    expect(screen.getByRole("heading", { name: "记录不存在或当前不可访问" })).toBeVisible();
    expect(screen.queryByText(/商品名称|客户姓名|IMEI|sale-|SKU|€|\bI\d/)).not.toBeInTheDocument();
  });
});
