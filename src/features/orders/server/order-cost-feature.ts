import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";

export function isOrderCostsEnabled() {
  return process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1";
}

function isOrderCostChildFeatureEnabled(value: string | undefined) {
  return isOrderCostsEnabled() && value === "1";
}

export function isProfitReportsEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED);
}

export function isPartsProcurementEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED);
}

export function isCostExportEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_COST_EXPORT_ENABLED);
}

export function isCostBackfillEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_COST_BACKFILL_ENABLED);
}

export function isCostMultiCurrencyEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED);
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
