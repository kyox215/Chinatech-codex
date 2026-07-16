import type { OrderListItem } from "@/lib/repairdesk/types";

type OrderPaymentStateInput = Pick<OrderListItem, "status" | "balance_amount" | "is_paid"> &
  Partial<Pick<OrderListItem, "exception_status">>;

export function isOrderCancelledForPayment(order: OrderPaymentStateInput) {
  return order.status === "cancelled" || order.exception_status === "cancelled";
}

export function isOrderPaymentCollectible(order: OrderPaymentStateInput) {
  return !isOrderCancelledForPayment(order) && !order.is_paid && order.balance_amount > 0;
}

export function getOrderLiveOutstandingAmount(order: OrderPaymentStateInput) {
  return isOrderCancelledForPayment(order) ? 0 : Math.max(0, order.balance_amount);
}
