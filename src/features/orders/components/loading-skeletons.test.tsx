import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerListSkeleton } from "@/features/customers/components/customer-list-skeleton";

import { OrderDetailSkeleton } from "./order-detail-skeleton";
import { OrderListSkeleton } from "./order-list-skeleton";

afterEach(cleanup);

describe("RepairOS loading skeletons", () => {
  it("renders complete order and customer loading frames without the old visible text", () => {
    const { container, rerender } = render(<OrderListSkeleton />);
    expect(container.querySelector('[data-ui="order-list-skeleton"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText("正在加载工单...")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在准备订单管理");

    rerender(<CustomerListSkeleton />);
    expect(container.querySelector('[data-ui="customer-list-skeleton"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText("正在加载客户...")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在准备客户管理");
  });

  it("keeps a visible close action in the dialog detail skeleton", () => {
    const onClose = vi.fn();
    render(<OrderDetailSkeleton surface="dialog" onClose={onClose} />);

    screen.getByRole("button", { name: "关闭工单详情" }).click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("正在准备工单详情");
  });
});
