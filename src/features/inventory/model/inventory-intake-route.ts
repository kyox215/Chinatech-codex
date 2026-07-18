export type InventoryIntakeRouteDecision = "ignore" | "wait" | "legacy" | "v2";

export function resolveInventoryIntakeRoute({
  requested,
  authorityReady,
  inventoryV2Available,
}: {
  requested: boolean;
  authorityReady: boolean;
  inventoryV2Available: boolean;
}): InventoryIntakeRouteDecision {
  if (!requested) return "ignore";
  if (!authorityReady) return "wait";
  return inventoryV2Available ? "v2" : "legacy";
}
