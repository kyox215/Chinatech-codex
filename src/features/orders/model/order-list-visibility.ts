import type { OrderListItem } from "@/lib/repairdesk/types";

export function isOrderArchivedForQueue<
  T extends Pick<OrderListItem, "status"> & Partial<Pick<OrderListItem, "exception_status">>,
>(order: T) {
  return (
    order.status === "completed" ||
    order.status === "cancelled" ||
    order.exception_status === "cancelled"
  );
}
