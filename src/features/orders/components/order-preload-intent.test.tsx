import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/api";

import { DesktopOrderQueueRow } from "./order-list-desktop-row";
import { OrderMobileCard } from "./order-list-items";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("order detail preload intent", () => {
  it("delays desktop hover but starts immediately on focus and primary pointer down", () => {
    vi.useFakeTimers();
    const onPrefetch = vi.fn();
    const onCancelPrefetch = vi.fn();

    render(
      <DesktopOrderQueueRow
        order={makeOrder()}
        checked={false}
        onOpen={vi.fn()}
        onPrefetch={onPrefetch}
        onCancelPrefetch={onCancelPrefetch}
        onCheckedChange={vi.fn()}
        onPrint={vi.fn()}
        onStopInteraction={(event) => event.stopPropagation()}
        suppliers={[]}
      />,
    );

    const row = screen.getByRole("button", { name: "查看工单详情 R2026001" });
    fireEvent.pointerEnter(row, { pointerType: "mouse" });
    vi.advanceTimersByTime(99);
    expect(onPrefetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onPrefetch).toHaveBeenCalledTimes(1);

    fireEvent.focus(row);
    fireEvent.pointerDown(row, { button: 0, pointerType: "mouse" });
    expect(onPrefetch).toHaveBeenCalledTimes(3);

    fireEvent.pointerLeave(row, { pointerType: "mouse" });
    fireEvent.blur(row);
    expect(onCancelPrefetch).toHaveBeenCalledTimes(2);
  });

  it("prefetches a mobile order link on focus and pointer down, then cancels on focus out", () => {
    const onPrefetch = vi.fn();
    const onCancelPrefetch = vi.fn();
    render(
      <OrderMobileCard
        order={makeOrder()}
        onPrefetch={onPrefetch}
        onCancelPrefetch={onCancelPrefetch}
      />,
    );

    const links = screen.getAllByRole("link");
    fireEvent.focus(links[0]);
    fireEvent.pointerDown(links[0], { button: 0, pointerType: "touch" });
    fireEvent.blur(links[0]);

    expect(onPrefetch).toHaveBeenCalledTimes(2);
    expect(onCancelPrefetch).toHaveBeenCalledTimes(1);
  });
});

function makeOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order-1",
    public_no: "R2026001",
    status: "new",
    order_type: "quick_repair",
    payment_status: "unpaid",
    approval_status: "pending",
    customer_id: "customer-1",
    device_id: "device-1",
    customer_name: "Cliente Test",
    customer_phone: "+390000000",
    device_label: "Apple iPhone",
    device_imei: "350100000000000",
    issue_description: "Display",
    quotation_amount: 100,
    deposit_amount: 0,
    balance_amount: 100,
    currency_code: "EUR",
    is_paid: false,
    technician_name: "Tecnico",
    contact_phones: [],
    fault_prices: [],
    approval_overdue: false,
    pickup_overdue: false,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}
