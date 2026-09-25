import { NextResponse } from "next/server";
import { statusGroups } from "@/lib/mock/enums";
import type { OrderListItem, OrderListResult, OrderStats } from "@/lib/repairdesk/types";

export function ok(data: unknown) {
  return privateJson({ data });
}

export function binaryResponse(result: { bytes: Buffer; headers: Record<string, string> }) {
  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: { ...result.headers, "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function emptyOrderListResult(pageSize: number): OrderListResult {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    pageCount: 1,
    workflowCounts: { all: 0 } as OrderListResult["workflowCounts"],
    queueCounts: {
      all: 0,
      processing: 0,
      ordered: 0,
      arrived: 0,
      arrived_notified: 0,
      repaired: 0,
      repaired_notified: 0,
    },
    resultGroupCounts: {
      processing: 0,
      ordered: 0,
      arrived: 0,
      arrived_notified: 0,
      repaired: 0,
      repaired_notified: 0,
      completed: 0,
      cancelled: 0,
    },
  };
}

export function deriveDashboardStatsFromRecentOrders(
  items: OrderListItem[],
  total: number,
): OrderStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return {
    total,
    today: items.filter((order) => new Date(order.created_at).getTime() >= todayMs).length,
    inProgress: items.filter((order) =>
      order.workflow_status
        ? order.workflow_status !== "closed"
        : statusGroups.in_progress.includes(order.status),
    ).length,
    unpaid: items.filter((order) => !order.is_paid).length,
    approvalOverdue: items.filter((order) => order.approval_overdue).length,
    pickupOverdue: items.filter((order) => order.pickup_overdue).length,
  };
}
