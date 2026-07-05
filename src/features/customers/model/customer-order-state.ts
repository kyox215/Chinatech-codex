import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";
import type { OrderListItem, OrderWorkflowStatusCode } from "@/lib/repairdesk/types";

type CustomerOrderStateInput = Pick<OrderListItem, "status"> &
  Partial<Pick<OrderListItem, "workflow_status" | "exception_status">>;

export function getCustomerOrderWorkflowStatus(
  order: CustomerOrderStateInput,
): OrderWorkflowStatusCode {
  return order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
}

export function isCustomerOrderCancelled(order: CustomerOrderStateInput) {
  return order.status === "cancelled" || order.exception_status === "cancelled";
}

export function isCustomerOrderClosed(order: CustomerOrderStateInput) {
  if (isCustomerOrderCancelled(order)) return true;
  return getCustomerOrderWorkflowStatus(order) === "closed";
}

export function isCustomerOrderBillable(order: CustomerOrderStateInput) {
  return !isCustomerOrderCancelled(order);
}
