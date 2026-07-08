export function isRepairDeskE2eAuthBypassEnabled() {
  return (
    process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1"
  );
}
