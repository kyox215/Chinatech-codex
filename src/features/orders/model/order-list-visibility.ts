import type { OrderListItem } from "@/lib/repairdesk/types";
import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";

export function isOrderArchivedForQueue(
  order: Pick<
    OrderListItem,
    "status" | "workflow_status" | "is_paid" | "payment_status" | "balance_amount" | "delivered_at"
  >,
) {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const terminalStatus = order.status === "completed" || order.status === "cancelled";

  return (
    terminalStatus &&
    workflowStatus === "closed" &&
    Boolean(order.delivered_at) &&
    isOrderFinanciallySettled(order)
  );
}

export function isOrderFinanciallySettled(
  order: Pick<OrderListItem, "is_paid" | "payment_status" | "balance_amount">,
) {
  return (
    Number(order.balance_amount) === 0 && order.is_paid === true && order.payment_status === "paid"
  );
}
