export function isRepairDeskOfflineSyncEnabled(
  value = process.env.NEXT_PUBLIC_REPAIRDESK_OFFLINE_SYNC_ENABLED,
) {
  return value === "1";
}
