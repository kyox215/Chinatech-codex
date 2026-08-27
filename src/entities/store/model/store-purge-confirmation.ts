export type StorePurgeConfirmationOperation = "request_purge" | "confirm_purge";

export const STORE_PURGE_CONFIRMATION_MAX_LENGTH = 80;

/**
 * Build the confirmation phrase from the server-authoritative store UUID.
 * The phrase is intentionally operation-specific so an application request
 * cannot be replayed as the final destructive confirmation.
 */
export function getStorePurgeConfirmationPhrase(
  storeId: string,
  operation: StorePurgeConfirmationOperation,
) {
  const suffix = getStorePurgeStoreIdSuffix(storeId).toUpperCase();
  return operation === "request_purge" ? `申请永久删除 ${suffix}` : `最终确认永久删除 ${suffix}`;
}

export function getStorePurgeStoreIdSuffix(storeId: string) {
  return storeId.replaceAll("-", "").slice(-8);
}

export function matchesStorePurgeConfirmationPhrase(
  value: string,
  storeId: string,
  operation: StorePurgeConfirmationOperation,
) {
  return value === getStorePurgeConfirmationPhrase(storeId, operation);
}
