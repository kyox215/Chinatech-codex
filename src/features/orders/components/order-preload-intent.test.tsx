import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/api";
import type { OrderWorkflow } from "@/lib/repairdesk/types";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

import { DesktopOrderQueueRow } from "./order-list-desktop-row";
import { OrderMobileCard } from "./order-list-items";

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

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
    const onOpenIntent = vi.fn();
    render(
      <OrderMobileCard
        order={makeOrder()}
        onPrefetch={onPrefetch}
        onCancelPrefetch={onCancelPrefetch}
        onOpenIntent={onOpenIntent}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(/工单 R2026001.*Cliente Test.*Apple iPhone/);
    fireEvent.focus(links[0]);
    fireEvent.pointerDown(links[0], { button: 0, pointerType: "touch" });
    fireEvent.blur(links[0]);

    expect(onPrefetch).toHaveBeenCalledTimes(2);
    expect(onCancelPrefetch).toHaveBeenCalledTimes(1);
    expect(onOpenIntent).toHaveBeenCalledTimes(1);
  });

  it("renders the mobile card as a compact scan-first summary", () => {
    const { container } = render(<OrderMobileCard order={makeOrder()} />);

    const card = container.querySelector('[data-order-mobile-card="true"]');
    expect(card).toHaveAttribute("data-order-mobile-card-risk", "false");
    expect(card).toHaveTextContent("Cliente Test");
    expect(card).toHaveTextContent("R2026001");
    expect(card).toHaveTextContent("Apple iPhone");
    expect(card).toHaveTextContent("待确认维修项目 · Display");
    expect(card?.querySelector('[title*="Tecnico"]')).toHaveAttribute(
      "title",
      expect.stringContaining("2026/07/07"),
    );
    expect(card?.querySelectorAll("[data-order-mini-progress-segment]")).toHaveLength(5);
    expect(
      card?.querySelector("[data-order-mobile-identity]")?.firstElementChild,
    ).toHaveTextContent(makeOrder().customer_phone);
    expect(card).toHaveTextContent("待审批");
    expect(card).toHaveTextContent("待收");
    expect(card).not.toHaveTextContent("定金");
    expect(card).not.toHaveTextContent("门店保管");
  });

  it("keeps custody, overdue and finance redaction visible without leaking amounts", () => {
    const { container } = render(
      <OrderMobileCard
        order={makeOrder({
          approval_overdue: true,
          device_custody_status: "with_customer",
          finance_redacted: true,
        })}
      />,
    );

    const card = container.querySelector('[data-order-mobile-card="true"]');
    expect(card).toHaveAttribute("data-order-mobile-card-risk", "true");
    expect(card).toHaveTextContent("客户持有");
    expect(card).toHaveTextContent("当前工单超期，请优先跟进");
    expect(card).toHaveTextContent("金额受限");
    expect(card?.textContent).not.toMatch(/€\s*100/);
  });

  it("renders mobile guidance in English without fixed Chinese labels", () => {
    render(
      <LocaleProvider initialLocale="en">
        <OrderMobileCard
          order={makeOrder({
            approval_overdue: true,
            finance_redacted: true,
            device_custody_status: "with_customer",
            exception_status: "paused",
          })}
        />
      </LocaleProvider>,
    );
    const card = document.querySelector('[data-order-mobile-card="true"]');
    expect(card).toHaveTextContent("Review pause reason");
    expect(card).toHaveTextContent("With customer");
    expect(card).toHaveTextContent("Amount restricted");
    expect(card).not.toHaveTextContent("报价超期");
    expect(card).not.toHaveTextContent("客户持有");
  });

  it("labels a cancelled mobile balance as a record amount instead of money due", () => {
    render(<OrderMobileCard order={makeOrder({ status: "cancelled" })} />);
    const payment = document.querySelector('[data-order-mobile-card-payment="true"]');
    expect(payment).toHaveTextContent("记录");
    expect(payment).not.toHaveTextContent("待收");
    expect(payment).toHaveTextContent("100.00");
  });

  it("does not revive stale overdue or custody tasks on a completed mobile record", () => {
    render(
      <OrderMobileCard
        order={makeOrder({
          status: "completed",
          workflow_status: "closed",
          device_custody_status: "with_customer",
          pickup_overdue: true,
          approval_overdue: true,
        })}
      />,
    );
    const card = document.querySelector('[data-order-mobile-card="true"]');
    expect(card).toHaveAttribute("data-order-mobile-card-risk", "false");
    expect(card).toHaveTextContent("完成");
    expect(card).toHaveTextContent("查看记录");
    expect(card).not.toHaveTextContent("当前工单超期");
    expect(card).not.toHaveTextContent("确认收机");
    expect(screen.getByRole("img")).toHaveAccessibleName(expect.stringContaining("已结束"));
  });

  it.each(["row", "card"] as const)(
    "opens the original details once from the %s next-task button",
    async (layout) => {
      const onOpen = vi.fn();
      const onCheckedChange = vi.fn();
      render(
        <DesktopOrderQueueRow
          layout={layout}
          order={makeOrder()}
          checked={false}
          onOpen={onOpen}
          onCheckedChange={onCheckedChange}
          onPrint={vi.fn()}
          onStopInteraction={(event) => event.stopPropagation()}
          suppliers={[]}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "开始检测" }));
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onCheckedChange).not.toHaveBeenCalled();
    },
  );

  it.each<{ label: string; order: Partial<OrderListItem> }>([
    { label: "待审批", order: { approval_status: "pending" } },
    { label: "报价已拒绝", order: { approval_status: "rejected" } },
    {
      label: "报价已拒绝 · 款项待核对",
      order: { approval_status: "rejected", deposit_amount: 20, balance_amount: 80 },
    },
    {
      label: "已付押金",
      order: {
        approval_status: "approved",
        payment_status: "partial",
        deposit_amount: 20,
        balance_amount: 80,
      },
    },
    { label: "已取消", order: { status: "cancelled" } },
    { label: "金额受限", order: { finance_redacted: true } },
  ])("visually exposes the mobile financial state: $label", ({ label, order }) => {
    render(<OrderMobileCard order={makeOrder(order)} />);
    const state = document.querySelector('[data-order-financial-label="true"]');
    expect(state).toBeVisible();
    expect(state).toHaveTextContent(label);
    expect(state?.closest('.sr-only, [hidden], [aria-hidden="true"]')).toBeNull();
    if (order.finance_redacted) {
      const card = document.querySelector('[data-order-mobile-card="true"]');
      expect(card).not.toHaveTextContent("€");
      expect(card).not.toHaveTextContent("Display");
    }
  });

  it("does not duplicate a same-phone customer name in the compact identity", () => {
    render(
      <OrderMobileCard
        order={makeOrder({ customer_name: "+39 000 0000", customer_phone: "+390000000" })}
      />,
    );
    const identity = document.querySelector("[data-order-mobile-identity]");
    expect(identity).toHaveTextContent("+390000000");
    expect(identity).not.toHaveTextContent("+39 000 0000");
  });

  it("prioritizes a paused order's current Italian label over an unrelated next transition", async () => {
    const workflow: OrderWorkflow = {
      statuses: [
        {
          id: "intake",
          store_id: "store",
          code: "new",
          label: "Nuovo",
          short_label: "Nuovo",
          tone: "info",
          bucket: "intake",
          sort_order: 1,
          enabled: true,
          show_in_order_filters: true,
          allowed_for_create: true,
          is_default_create_status: true,
          is_system: true,
          created_at: "",
          updated_at: "",
        },
        {
          id: "custom",
          store_id: "store",
          code: "diagnosing",
          label: "Stato negozio",
          short_label: "Stato",
          tone: "progress",
          bucket: "diagnosing",
          sort_order: 2,
          enabled: true,
          show_in_order_filters: true,
          allowed_for_create: false,
          is_default_create_status: false,
          is_system: false,
          created_at: "",
          updated_at: "",
        },
      ],
      transitions: [
        {
          id: "tr",
          store_id: "store",
          from_status_code: "new",
          to_status_code: "diagnosing",
          is_primary: true,
          sort_order: 1,
          enabled: true,
          created_at: "",
          updated_at: "",
        },
      ],
    };
    render(
      <LocaleProvider initialLocale="it-IT">
        <DesktopOrderQueueRow
          order={makeOrder({ exception_status: "paused", device_unlock_method: "pin" })}
          workflow={workflow}
          checked={false}
          onOpen={vi.fn()}
          onCheckedChange={vi.fn()}
          onPrint={vi.fn()}
          onStopInteraction={(event) => event.stopPropagation()}
          suppliers={[]}
        />
      </LocaleProvider>,
    );
    expect(document.body).toHaveTextContent("In pausa");
    expect(document.body).toHaveTextContent("Riparazione rapida");
    expect(document.body).toHaveTextContent("In negozio");
    expect(document.body).toHaveTextContent("PIN");
    expect(document.body).toHaveTextContent("Controlla la pausa");
    expect(document.body).not.toHaveTextContent("Stato negozio");
  });

  it("exposes a native detail link from the desktop row action menu", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <DesktopOrderQueueRow
        order={makeOrder()}
        checked={false}
        onOpen={onOpen}
        onCheckedChange={vi.fn()}
        onPrint={vi.fn()}
        onStopInteraction={(event) => event.stopPropagation()}
        suppliers={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "更多工单操作" }));
    const directLink = await screen.findByRole("menuitem", { name: "在新页打开" });

    expect(directLink).toHaveAttribute("href", "/orders/order-1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("explains a disabled single print action and offers the recovery entry", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    const onOpenPrintRecovery = vi.fn();
    render(
      <DesktopOrderQueueRow
        order={makeOrder()}
        checked={false}
        onOpen={vi.fn()}
        onCheckedChange={vi.fn()}
        onPrint={onPrint}
        canPrint
        printDisabledReason="请先补齐当前店铺资料后再打印"
        onOpenPrintRecovery={onOpenPrintRecovery}
        onStopInteraction={(event) => event.stopPropagation()}
        suppliers={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "更多工单操作" }));
    expect(await screen.findByRole("menuitem", { name: "打印" })).toHaveAttribute(
      "title",
      "请先补齐当前店铺资料后再打印",
    );
    await user.click(screen.getByRole("menuitem", { name: "查看打印设置" }));

    expect(onPrint).not.toHaveBeenCalled();
    expect(onOpenPrintRecovery).toHaveBeenCalledOnce();
  });
});

describe("desktop order customer identity", () => {
  it("shows the customer phone and name without rendering the public order number", () => {
    render(
      <DesktopOrderQueueRow
        order={makeOrder()}
        checked={false}
        onOpen={vi.fn()}
        onCheckedChange={vi.fn()}
        onPrint={vi.fn()}
        onStopInteraction={(event) => event.stopPropagation()}
        suppliers={[]}
      />,
    );

    const identity = document.querySelector('[data-order-customer-identity="true"]');
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("+390000000");
    expect(identity).toHaveTextContent("Cliente Test");
    expect(identity).not.toHaveTextContent("R2026001");
  });

  it("does not repeat a phone number stored as the customer name", () => {
    render(
      <DesktopOrderQueueRow
        order={makeOrder({
          customer_name: "389 027 2038",
          customer_phone: "3890272038",
        })}
        checked={false}
        onOpen={vi.fn()}
        onCheckedChange={vi.fn()}
        onPrint={vi.fn()}
        onStopInteraction={(event) => event.stopPropagation()}
        suppliers={[]}
      />,
    );

    const identity = document.querySelector('[data-order-customer-identity="true"]');
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("3890272038");
    expect(identity).toHaveTextContent("未填写姓名");
    expect(identity).not.toHaveTextContent("389 027 2038");
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
    device_custody_status: overrides.device_custody_status ?? "with_shop",
  };
}
