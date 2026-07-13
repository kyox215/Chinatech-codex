import type { OrderListItem } from "@/lib/repairdesk/types";

export function isOrderArchivedForQueue<T extends Pick<OrderListItem, "status">>(order: T) {
  return order.status === "completed" || order.status === "cancelled";
}
