import type { OrderListItem } from "@/lib/repairdesk/types";

type OrderCancellationInput = { status: string; exception_status?: string | null };

type OrderPaymentStateInput = Pick<OrderListItem, "status" | "balance_amount" | "is_paid"> &
  Partial<
    Pick<OrderListItem, "workflow_bucket" | "exception_status" | "record_state" | "deleted_at">
  >;

export function isOrderCancelled(order: OrderCancellationInput) {
  return order.status === "cancelled" || order.exception_status === "cancelled";
}

export function isOrderCancelledForPayment(order: OrderPaymentStateInput) {
  return (
    isOrderCancelled(order) ||
    order.workflow_bucket === "cancelled" ||
    order.exception_status === "cancelled" ||
    order.record_state === "voided" ||
    Boolean(order.deleted_at)
  );
}

export function isOrderPaymentCollectible(order: OrderPaymentStateInput) {
  return !isOrderCancelledForPayment(order) && !order.is_paid && order.balance_amount > 0;
}

export function getOrderLiveOutstandingAmount(order: OrderPaymentStateInput) {
  return isOrderCancelledForPayment(order) ? 0 : Math.max(0, order.balance_amount);
}
