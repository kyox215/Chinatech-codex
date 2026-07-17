import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";

export function isOrderCostsEnabled() {
  return process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1";
}

export function canManageOrderCosts(actor?: AuditActor) {
  return isOrderCostsEnabled() && can(actor, "finance:cost_manage");
}

export function canReadOrderCosts(actor?: AuditActor) {
  return (
    isOrderCostsEnabled() &&
    (can(actor, "finance:cost_manage") || can(actor, "finance:profit_read"))
  );
}

export function assertCanManageOrderCosts(actor?: AuditActor) {
  if (!canManageOrderCosts(actor)) throw new ForbiddenError("无权管理内部成本");
}

export function assertCanReadOrderCosts(actor?: AuditActor) {
  if (!canReadOrderCosts(actor)) throw new ForbiddenError("无权查看内部成本");
}
