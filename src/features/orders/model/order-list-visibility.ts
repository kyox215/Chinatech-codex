import type { OrderListItem } from "@/lib/repairdesk/types";
import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";

export function isOrderArchivedForQueue(
  order: Pick<
    OrderListItem,
    "status" | "workflow_status" | "is_paid" | "payment_status" | "balance_amount"
  >,
) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const financiallyPaid =
    Number(order.balance_amount) <= 0 && (order.is_paid || order.payment_status === "paid");
  return order.status === "cancelled" || (workflowStatus === "closed" && financiallyPaid);
}
