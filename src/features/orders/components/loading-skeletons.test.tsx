import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomerListSkeleton } from "@/features/customers/components/customer-list-skeleton";

import { OrderDetailSkeleton } from "./order-detail-skeleton";
import { OrderListSkeleton } from "./order-list-skeleton";

afterEach(cleanup);

describe("RepairOS loading skeletons", () => {
  it("renders complete order and customer loading frames without the old visible text", () => {
    const { container, rerender } = render(
      <SidebarProvider>
        <OrderListSkeleton />
      </SidebarProvider>,
    );
    const orderListSkeleton = container.querySelector('[data-ui="order-list-skeleton"]');
    expect(orderListSkeleton).toHaveAttribute("aria-busy", "true");
    expect(orderListSkeleton).toHaveAttribute("data-ui-viewport", "responsive");
    expect(orderListSkeleton).toHaveClass(
      "[--orders-mobile-header-offset:calc(env(safe-area-inset-top)+10.5rem)]",
    );
    expect(screen.queryByText("正在加载工单...")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在准备维修工单");

    rerender(
      <SidebarProvider>
        <CustomerListSkeleton />
      </SidebarProvider>,
    );
    expect(container.querySelector('[data-ui="customer-list-skeleton"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText("正在加载客户...")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在准备客户管理");
  });

  it("keeps list skeleton geometry aligned with the responsive production layouts", () => {
    const { container, rerender } = render(
      <SidebarProvider>
        <OrderListSkeleton />
      </SidebarProvider>,
    );

    expect(screen.getByRole("button", { name: /导航|侧边栏/ })).toBeEnabled();
    expect(
      container.querySelector('[data-order-mobile-skeleton-card="true"]')?.parentElement,
    ).toHaveClass("grid", "md:grid-cols-2");
    expect(container.querySelector('[data-order-desktop-skeleton-row="true"]')).toHaveClass(
      "min-h-[5.5rem]",
    );
    expect(container.querySelector('[data-order-skeleton-desktop-toolbar="true"]')).toBeTruthy();

    rerender(
      <SidebarProvider>
        <CustomerListSkeleton />
      </SidebarProvider>,
    );

    expect(
      container.querySelector('[data-ui="customer-list-skeleton-desktop-header"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-customer-desktop-skeleton-list="true"] table'),
    ).toHaveClass("table-fixed");
    expect(container.innerHTML).not.toContain("min-w-[840px]");
    expect(container.querySelectorAll("thead th")).toHaveLength(5);
  });

  it("uses the real order-detail workspace boundaries and named information regions", () => {
    const { container } = render(<OrderDetailSkeleton surface="page" renderMode="pending" />);
    const detail = container.querySelector('[data-ui="order-detail-skeleton"]');

    expect(detail).toHaveClass("md:max-w-[1200px]");
    expect(container.querySelector('[data-order-detail-skeleton-workbench="true"]')).toHaveClass(
      "max-w-[1320px]",
    );
    expect(container.querySelector('[data-order-detail-skeleton-section="customer"]')).toBeTruthy();
    expect(container.querySelector('[data-order-detail-skeleton-section="device"]')).toBeTruthy();
    expect(container.querySelector('[data-order-detail-skeleton-section="money"]')).toBeTruthy();
    expect(
      container.querySelector('[data-order-detail-skeleton-section="fault-quote"]'),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "返回工单列表" })).toHaveAttribute("href", "/orders");
  });

  it("keeps a visible close action in the dialog detail skeleton", () => {
    const onClose = vi.fn();
    render(<OrderDetailSkeleton surface="dialog" onClose={onClose} />);

    screen.getByRole("button", { name: "关闭工单详情" }).click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("正在准备工单详情");
  });
});
