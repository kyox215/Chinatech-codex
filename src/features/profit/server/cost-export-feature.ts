import { isCostExportEnabled } from "@/features/orders/server/order-cost-feature";
import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

export function canExportCosts(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) return isCostExportEnabled();
  return isCostExportEnabled() && can(actor, "finance:cost_export");
}

export function assertCanExportCosts(actor?: AuditActor) {
  if (!canExportCosts(actor)) throw new ForbiddenError("无权导出维修成本与毛利");
}

export function assertCostExportStore(actor: AuditActor, expectedStoreId: string) {
  assertCanExportCosts(actor);
  if (actor.isSystem && isRepairDeskE2eAuthBypassEnabled()) return expectedStoreId;
  if (!actor.storeId || actor.storeId !== expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请刷新后重试");
  }
  return actor.storeId;
}
