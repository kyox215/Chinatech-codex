import type { AuditActor } from "@/lib/repairdesk/types";

export function isRepairDeskE2eAuthBypassEnabled() {
  return (
    process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1"
  );
}

export function isRepairDeskE2eSystemActor(actor: AuditActor | undefined | null) {
  return (
    actor?.isSystem === true &&
    process.env.NODE_ENV !== "production" &&
    isRepairDeskE2eAuthBypassEnabled()
  );
}
