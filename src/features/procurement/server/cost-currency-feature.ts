import { isCostMultiCurrencyEnabled } from "@/features/orders/server/order-cost-feature";
import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

export function canReadCostCurrencies(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) {
    return isCostMultiCurrencyEnabled();
  }
  return (
    isCostMultiCurrencyEnabled() &&
    (can(actor, "finance:currency_manage") ||
      can(actor, "finance:cost_manage") ||
      can(actor, "inventory:cost_allocate"))
  );
}

export function canManageCostCurrencies(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) {
    return isCostMultiCurrencyEnabled();
  }
  return isCostMultiCurrencyEnabled() && can(actor, "finance:currency_manage");
}

export function assertCostCurrencyAccess(
  actor: AuditActor,
  expectedStoreId: string,
  mode: "read" | "manage",
) {
  const allowed = mode === "manage" ? canManageCostCurrencies(actor) : canReadCostCurrencies(actor);
  if (!allowed) {
    throw new ForbiddenError(
      mode === "manage" ? "只有店主可维护采购成本汇率" : "无权读取采购成本汇率",
    );
  }
  if (actor.isSystem && isRepairDeskE2eAuthBypassEnabled()) return expectedStoreId;
  if (!actor.storeId || actor.storeId !== expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请刷新后重试");
  }
  return actor.storeId;
}
