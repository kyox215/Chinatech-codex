import { isCostBackfillEnabled } from "@/features/orders/server/order-cost-feature";
import type { AuditActor } from "@/lib/repairdesk/types";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

export function canPreviewCostBackfill(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) return isCostBackfillEnabled();
  return isCostBackfillEnabled() && can(actor, "finance:cost_backfill_preview");
}

export function canApplyCostBackfill(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) return isCostBackfillEnabled();
  return isCostBackfillEnabled() && can(actor, "finance:cost_backfill_apply");
}

export function assertCostBackfillAccess(
  actor: AuditActor,
  expectedStoreId: string,
  mode: "preview" | "apply",
) {
  const allowed = mode === "apply" ? canApplyCostBackfill(actor) : canPreviewCostBackfill(actor);
  if (!allowed)
    throw new ForbiddenError(
      mode === "apply" ? "仅店主可应用或撤销历史成本" : "无权预览历史成本回填",
    );
  if (actor.isSystem && isRepairDeskE2eAuthBypassEnabled()) return expectedStoreId;
  if (!actor.storeId || actor.storeId !== expectedStoreId) {
    throw new ForbiddenError("店铺上下文已经变化，请刷新后重试");
  }
  return actor.storeId;
}
