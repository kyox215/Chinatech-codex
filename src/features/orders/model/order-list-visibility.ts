import type { OrderListItem } from "@/lib/repairdesk/types";

export function isOrderArchivedForQueue<
  T extends Pick<OrderListItem, "status"> &
    Partial<
      Pick<
        OrderListItem,
        "workflow_status" | "workflow_bucket" | "exception_status" | "record_state" | "deleted_at"
      >
    >,
>(order: T) {
  return (
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.workflow_bucket === "done" ||
    order.workflow_bucket === "cancelled" ||
    order.exception_status === "cancelled" ||
    order.record_state === "voided" ||
    Boolean(order.deleted_at)
  );
}
