import { buildDashboardPrioritySummary } from "@/features/dashboard/model/dashboard-priority";
import type {
  AuditActor,
  DashboardSummary,
  OrderListFilters,
  OrderListItem,
} from "@/lib/repairdesk/types";

type ListOrders = (filters: OrderListFilters, actor: AuditActor) => Promise<OrderListItem[]>;

export async function getDashboardPrioritySummary({
  actor,
  limit,
  listOrders,
  now,
}: {
  actor: AuditActor;
  limit?: number;
  listOrders: ListOrders;
  now?: Date;
}): Promise<DashboardSummary> {
  let orders: OrderListItem[];
  try {
    orders = await listOrders({ view: "active" }, actor);
  } catch {
    throw new Error("优先队列暂时不可用");
  }
  const coverage = (actor.storeRole ?? actor.role) === "technician" ? "assigned" : "store";

  return buildDashboardPrioritySummary(orders, {
    coverage,
    currentMembershipId: actor.activeMembershipId,
    limit,
    now,
  });
}
