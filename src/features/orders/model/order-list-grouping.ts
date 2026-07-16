import { isOrderArchivedForQueue } from "@/features/orders/model/order-list-visibility";
import {
  getOrderQueueGroup,
  orderQueueGroupMeta,
  orderQueueGroups,
} from "@/features/orders/model/order-queue-classification";
import type { OrderListItem, OrderResultGroup, RepairOrder } from "@/lib/repairdesk/types";
import type { StatusTone } from "@/lib/mock/enums";

export const orderResultGroups: OrderResultGroup[] = [
  ...orderQueueGroups,
  "completed",
  "cancelled",
];

export const orderResultGroupMeta: Record<
  OrderResultGroup,
  { label: string; hint: string; sortOrder: number; tone: StatusTone }
> = {
  ...orderQueueGroupMeta,
  completed: {
    label: "完成",
    hint: "已经交付并完成的历史订单",
    sortOrder: 6,
    tone: "neutral",
  },
  cancelled: {
    label: "作废",
    hint: "已经取消或作废的历史订单",
    sortOrder: 7,
    tone: "danger",
  },
};

type GroupableOrder = Pick<
  RepairOrder,
  | "id"
  | "public_no"
  | "status"
  | "workflow_status"
  | "workflow_bucket"
  | "parts_status"
  | "notify_status"
  | "exception_status"
  | "record_state"
  | "deleted_at"
  | "created_at"
>;

export function getOrderResultGroup(order: GroupableOrder): OrderResultGroup {
  if (isOrderArchivedForQueue(order)) {
    return order.status === "cancelled" ||
      order.workflow_bucket === "cancelled" ||
      order.exception_status === "cancelled" ||
      order.record_state === "voided" ||
      Boolean(order.deleted_at)
      ? "cancelled"
      : "completed";
  }
  return getOrderQueueGroup(order);
}

function dateSortValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

export function compareOrdersForQueue(a: GroupableOrder, b: GroupableOrder) {
  const groupSort =
    orderResultGroupMeta[getOrderResultGroup(a)].sortOrder -
    orderResultGroupMeta[getOrderResultGroup(b)].sortOrder;
  if (groupSort !== 0) return groupSort;

  const createdSort = dateSortValue(a.created_at) - dateSortValue(b.created_at);
  if (createdSort !== 0) return createdSort;

  const publicNoSort = a.public_no.localeCompare(b.public_no, "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
  if (publicNoSort !== 0) return publicNoSort;
  return a.id.localeCompare(b.id);
}

export function createOrderResultGroupCounts(): Record<OrderResultGroup, number> {
  return {
    processing: 0,
    ordered: 0,
    arrived: 0,
    arrived_notified: 0,
    repaired: 0,
    repaired_notified: 0,
    completed: 0,
    cancelled: 0,
  };
}

export function countOrderResultGroups(rows: GroupableOrder[]) {
  const counts = createOrderResultGroupCounts();
  for (const row of rows) counts[getOrderResultGroup(row)] += 1;
  return counts;
}

export function groupOrderListItems(items: OrderListItem[]) {
  const grouped = new Map<OrderResultGroup, OrderListItem[]>();
  for (const item of items) {
    const group = getOrderResultGroup(item);
    const rows = grouped.get(group) ?? [];
    rows.push(item);
    grouped.set(group, rows);
  }

  return orderResultGroups.flatMap((group) => {
    const rows = grouped.get(group);
    if (!rows?.length) return [];
    return [{ group, items: rows.sort(compareOrdersForQueue) }];
  });
}
