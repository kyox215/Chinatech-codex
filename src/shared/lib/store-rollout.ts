export type StoreRolloutConfig = {
  storeId: string | null | undefined;
  allStoresEnabled?: string;
  allowlist?: string;
  denylist?: string;
};

export function parseStoreRolloutList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Resolves a server-side store rollout with an explicit global switch.
 * The denylist always wins so one store can be rolled back without disabling
 * the feature for every other tenant.
 */
export function isStoreRolloutEnabled({
  storeId,
  allStoresEnabled,
  allowlist,
  denylist,
}: StoreRolloutConfig) {
  if (!storeId || storeId.trim() !== storeId) return false;
  if (parseStoreRolloutList(denylist).includes(storeId)) return false;
  if (allStoresEnabled === "1") return true;
  return parseStoreRolloutList(allowlist).includes(storeId);
}
