import type { AuditActor } from "@/lib/repairdesk/types";
import { isPartsProcurementEnabled } from "@/features/orders/server/order-cost-feature";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";

export function canAllocatePartsCosts(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) {
    return isPartsProcurementEnabled();
  }
  return isPartsProcurementEnabled() && can(actor, "inventory:cost_allocate");
}

export function assertCanAllocatePartsCosts(actor?: AuditActor) {
  if (!canAllocatePartsCosts(actor)) throw new ForbiddenError("无权管理配件采购成本");
}
