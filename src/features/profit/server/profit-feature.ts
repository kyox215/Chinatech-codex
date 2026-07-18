import type { AuditActor } from "@/lib/repairdesk/types";
import { isProfitReportsEnabled } from "@/features/orders/server/order-cost-feature";
import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import { ForbiddenError } from "@/server/auth-context";
import { can } from "@/server/permissions";

export function canReadProfitCenter(actor?: AuditActor) {
  if (actor?.isSystem && isRepairDeskE2eAuthBypassEnabled()) {
    return isProfitReportsEnabled();
  }
  return isProfitReportsEnabled() && can(actor, "finance:profit_read");
}

export function assertCanReadProfitCenter(actor?: AuditActor) {
  if (!canReadProfitCenter(actor)) throw new ForbiddenError("无权查看维修毛利中心");
}
