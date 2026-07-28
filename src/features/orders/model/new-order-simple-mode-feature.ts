export function isNewOrderSimpleModeEnabled() {
  return process.env.NEXT_PUBLIC_REPAIRDESK_NEW_ORDER_SIMPLE_MODE_ENABLED === "1";
}

export function isNewOrderSessionStoreChanged(
  sessionStoreId: string | null,
  activeStoreId: string | undefined,
) {
  return sessionStoreId !== null && activeStoreId !== sessionStoreId;
}
