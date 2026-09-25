export function isRepairDeskToolkitEnabled(
  value = process.env.NEXT_PUBLIC_REPAIRDESK_TOOLKIT_ENABLED,
) {
  return value === "1";
}
