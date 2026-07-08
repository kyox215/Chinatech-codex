import type { OrderListItem, OrderStats } from "@/lib/repairdesk/types";

export type DashboardInsightTone = "neutral" | "progress" | "warn" | "danger" | "success";

export interface DashboardWorkInsight {
  headline: string;
  description: string;
  tone: DashboardInsightTone;
  primaryLabel: string;
  primaryHref: string;
  reasons: string[];
}

type OrderSignal = Pick<
  OrderListItem,
  "id" | "public_no" | "approval_overdue" | "pickup_overdue" | "is_paid" | "customer_name"
>;

export function buildDashboardWorkInsight(
  stats: OrderStats,
  recentOrders: OrderSignal[] = [],
): DashboardWorkInsight {
  const focusOrder = findFocusOrder(recentOrders);

  if (stats.approvalOverdue > 0) {
    return {
      headline: `优先催 ${stats.approvalOverdue} 个报价确认`,
      description: focusOrder
        ? `${focusOrder.public_no} ${formatCustomerName(focusOrder)}需要先联系客户。`
        : "报价超期会拖慢后续维修和配件安排，建议先处理。",
      tone: "danger",
      primaryLabel: "处理报价",
      primaryHref: focusOrder ? `/orders/${focusOrder.id}` : "/orders",
      reasons: compactReasons([
        `${stats.approvalOverdue} 个报价超期`,
        stats.unpaid > 0 ? `${stats.unpaid} 个未结清` : "",
        stats.inProgress > 0 ? `${stats.inProgress} 个进行中` : "",
      ]),
    };
  }

  if (stats.pickupOverdue > 0) {
    return {
      headline: `提醒 ${stats.pickupOverdue} 个客户取机`,
      description: focusOrder
        ? `${focusOrder.public_no} ${formatCustomerName(focusOrder)}可以优先发取机提醒。`
        : "已完成但未取机的设备会占用柜台和仓位。",
      tone: "warn",
      primaryLabel: "查看取机",
      primaryHref: focusOrder ? `/orders/${focusOrder.id}` : "/orders",
      reasons: compactReasons([
        `${stats.pickupOverdue} 个取机超期`,
        stats.unpaid > 0 ? `${stats.unpaid} 个未结清` : "",
      ]),
    };
  }

  if (stats.unpaid > 0) {
    return {
      headline: `核对 ${stats.unpaid} 笔未结清`,
      description: focusOrder
        ? `${focusOrder.public_no} ${formatCustomerName(focusOrder)}仍需要核对收款。`
        : "先把未收款和尾款理清，避免结案后再回查。",
      tone: "warn",
      primaryLabel: "核对收款",
      primaryHref: focusOrder ? `/orders/${focusOrder.id}` : "/orders",
      reasons: compactReasons([
        `${stats.unpaid} 个未结清`,
        stats.today > 0 ? `今日新建 ${stats.today}` : "",
      ]),
    };
  }

  if (stats.inProgress > 0) {
    return {
      headline: `推进 ${stats.inProgress} 个进行中工单`,
      description: "没有明显超期事项，可以按检测、配件、维修顺序推进。",
      tone: "progress",
      primaryLabel: "进入工单",
      primaryHref: "/orders",
      reasons: compactReasons([
        `${stats.inProgress} 个进行中`,
        stats.today > 0 ? `今日新建 ${stats.today}` : "",
      ]),
    };
  }

  if (stats.total === 0) {
    return {
      headline: "今天还没有工单压力",
      description: "可以先整理客户、回收、库存和消息模板。",
      tone: "neutral",
      primaryLabel: "查看客户",
      primaryHref: "/customers",
      reasons: ["无待处理工单"],
    };
  }

  return {
    headline: "工单状态平稳",
    description: "暂无超期或未结清风险，可以检查客户、库存和回收记录。",
    tone: "success",
    primaryLabel: "查看概况",
    primaryHref: "/orders",
    reasons: compactReasons([
      `${stats.total} 个总工单`,
      stats.today > 0 ? `今日新建 ${stats.today}` : "",
    ]),
  };
}

function findFocusOrder(orders: OrderSignal[]) {
  return (
    orders.find((order) => order.approval_overdue) ??
    orders.find((order) => order.pickup_overdue) ??
    orders.find((order) => !order.is_paid)
  );
}

function formatCustomerName(order: OrderSignal) {
  return order.customer_name ? `· ${order.customer_name} ` : "";
}

function compactReasons(reasons: string[]) {
  return reasons.filter((reason) => reason.trim().length > 0);
}
