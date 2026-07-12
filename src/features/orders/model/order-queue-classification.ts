import { workflowStatusFromLegacyStatus } from "@/features/orders/model/canonical-order-status";
import {
  isOrderArchivedForQueue,
  isOrderFinanciallySettled,
} from "@/features/orders/model/order-list-visibility";
import type { OrderListItem, OrderQueueGroup } from "@/lib/repairdesk/types";
import type { StatusTone } from "@/lib/mock/enums";

export const orderQueueGroups = ["processing", "handover", "settlement", "review"] as const;

export const orderQueueGroupMeta: Record<
  OrderQueueGroup,
  { label: string; shortLabel: string; hint: string; sortOrder: number; tone: StatusTone }
> = {
  processing: {
    label: "处理中",
    shortLabel: "处理",
    hint: "接单、报价、配件、寄修与维修",
    sortOrder: 0,
    tone: "progress",
  },
  handover: {
    label: "待交付",
    shortLabel: "交付",
    hint: "已修好、已通知或等待客户取机",
    sortOrder: 1,
    tone: "warn",
  },
  settlement: {
    label: "待结算",
    shortLabel: "结算",
    hint: "设备已交付，但财务尚未结清",
    sortOrder: 2,
    tone: "warn",
  },
  review: {
    label: "需核对",
    shortLabel: "核对",
    hint: "交付、流程或付款证据存在矛盾",
    sortOrder: 3,
    tone: "danger",
  },
};

type QueueOrder = Pick<
  OrderListItem,
  "status" | "workflow_status" | "is_paid" | "payment_status" | "balance_amount" | "delivered_at"
>;

const handoverStatuses = new Set(["repaired", "notified", "waiting_pickup", "unfixed_pickup"]);

export function getOrderQueueGroup(order: QueueOrder): OrderQueueGroup {
  const workflowStatus = order.workflow_status ?? workflowStatusFromLegacyStatus(order.status);
  const hasDelivery = Boolean(order.delivered_at);
  const balance = Number(order.balance_amount);
  const terminalStatus = order.status === "completed" || order.status === "cancelled";

  if (isOrderArchivedForQueue(order)) return "review";
  if (!Number.isFinite(balance) || balance < 0) return "review";
  if (terminalStatus && workflowStatus !== "closed") return "review";
  if (hasDelivery && workflowStatus !== "closed") return "review";
  if (workflowStatus === "closed" && !hasDelivery) return "review";

  if (workflowStatus === "closed" && hasDelivery) {
    if (isOrderFinanciallySettled(order)) return "review";
    const validOutstandingBalance =
      balance > 0 &&
      order.is_paid === false &&
      (order.payment_status === "unpaid" || order.payment_status === "partial");
    return validOutstandingBalance ? "settlement" : "review";
  }

  if (handoverStatuses.has(order.status) || workflowStatus === "pickup") return "handover";
  return "processing";
}

export function createOrderQueueCounts(): Record<OrderQueueGroup | "all", number> {
  return { all: 0, processing: 0, handover: 0, settlement: 0, review: 0 };
}

export function countOrderQueueGroups(rows: QueueOrder[]) {
  const counts = createOrderQueueCounts();
  for (const row of rows) {
    counts.all += 1;
    if (!isOrderArchivedForQueue(row)) counts[getOrderQueueGroup(row)] += 1;
  }
  return counts;
}
