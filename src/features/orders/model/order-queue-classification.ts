import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";
import { isOrderArchivedForQueue } from "@/features/orders/model/order-list-visibility";
import type { OrderListItem, OrderQueueGroup } from "@/lib/repairdesk/types";
import type { StatusTone } from "@/lib/mock/enums";

export const orderQueueGroups = [
  "processing",
  "ordered",
  "arrived",
  "arrived_notified",
  "repaired",
  "repaired_notified",
] as const;

export const orderQueueGroupMeta: Record<
  OrderQueueGroup,
  { label: string; shortLabel: string; hint: string; sortOrder: number; tone: StatusTone }
> = {
  processing: {
    label: "处理中",
    shortLabel: "处理中",
    hint: "接单、检测、报价、寄修与维修处理中",
    sortOrder: 0,
    tone: "neutral",
  },
  ordered: {
    label: "下单",
    shortLabel: "下单",
    hint: "配件已经订购，等待到货",
    sortOrder: 1,
    tone: "info",
  },
  arrived: {
    label: "到货",
    shortLabel: "到货",
    hint: "配件已经到货，尚未通知",
    sortOrder: 2,
    tone: "warn",
  },
  arrived_notified: {
    label: "到货已通知",
    shortLabel: "到货已通知",
    hint: "配件到货且客户已经收到通知",
    sortOrder: 3,
    tone: "warn",
  },
  repaired: {
    label: "修好",
    shortLabel: "修好",
    hint: "设备已经修好，仍待通知或取机",
    sortOrder: 4,
    tone: "success",
  },
  repaired_notified: {
    label: "修好已通知",
    shortLabel: "修好已通知",
    hint: "设备修好且客户已经收到通知",
    sortOrder: 5,
    tone: "success",
  },
};

type QueueOrder = Pick<
  OrderListItem,
  "status" | "workflow_status" | "parts_status" | "notify_status" | "exception_status"
> &
  Partial<Pick<OrderListItem, "device_custody_status">>;

const repairedStatuses = new Set(["repaired", "notified", "waiting_pickup"]);
const notifiedStatuses = new Set(["notified", "waiting_pickup"]);
const explicitNonRepairedStatuses = new Set([
  "new",
  "rework",
  "mail_in_progress",
  "diagnosing",
  "quoted",
  "waiting_approval",
  "parts_ordered",
  "parts_arrived",
  "repairing",
  "unfixed_pickup",
  "completed",
  "cancelled",
]);

function isNotified(order: QueueOrder) {
  return (
    order.notify_status === "sent" ||
    order.notify_status === "contacted" ||
    notifiedStatuses.has(order.status)
  );
}

function isRepairedWork(order: QueueOrder, workflowStatus: string) {
  if (order.device_custody_status === "with_customer") return false;
  if (order.exception_status === "returned_unfixed" || order.exception_status === "unrepairable") {
    return false;
  }
  if (repairedStatuses.has(order.status)) return true;
  return workflowStatus === "pickup" && !explicitNonRepairedStatuses.has(order.status);
}

export function getOrderQueueGroup(order: QueueOrder): OrderQueueGroup {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);

  if (isRepairedWork(order, workflowStatus)) {
    return isNotified(order) ? "repaired_notified" : "repaired";
  }
  if (
    order.status === "parts_arrived" ||
    (workflowStatus === "parts" && order.parts_status === "arrived")
  ) {
    return isNotified(order) ? "arrived_notified" : "arrived";
  }
  if (
    order.status === "parts_ordered" ||
    (workflowStatus === "parts" && order.parts_status === "ordered")
  ) {
    return "ordered";
  }
  return "processing";
}

export function createOrderQueueCounts(): Record<OrderQueueGroup | "all", number> {
  return {
    all: 0,
    processing: 0,
    ordered: 0,
    arrived: 0,
    arrived_notified: 0,
    repaired: 0,
    repaired_notified: 0,
  };
}

export function countOrderQueueGroups(rows: QueueOrder[]) {
  const counts = createOrderQueueCounts();
  for (const row of rows) {
    if (isOrderArchivedForQueue(row)) continue;
    counts.all += 1;
    counts[getOrderQueueGroup(row)] += 1;
  }
  return counts;
}
