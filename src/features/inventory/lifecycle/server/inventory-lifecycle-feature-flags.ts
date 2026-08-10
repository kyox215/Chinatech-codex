import { isStoreRolloutEnabled } from "@/shared/lib/store-rollout";
import type { InventoryLifecycleProjectionMode } from "@/lib/repairdesk/types";

export type InventoryLifecycleFeatureEnvironment = {
  INVENTORY_LIFECYCLE_SCHEMA_READY?: string;
  INVENTORY_LIFECYCLE_COMMANDS?: string;
  INVENTORY_LIFECYCLE_UI?: string;
  INVENTORY_LIFECYCLE_ALL_STORES_ENABLED?: string;
  INVENTORY_LIFECYCLE_STORE_ALLOWLIST?: string;
  INVENTORY_LIFECYCLE_STORE_DENYLIST?: string;
};

export class InventoryLifecycleFeatureDisabledError extends Error {
  readonly status = 503;
  readonly code = "feature_disabled";

  constructor() {
    super("商品生命周期功能尚未对当前门店开放");
    this.name = "InventoryLifecycleFeatureDisabledError";
  }
}

export function isInventoryLifecycleSchemaReady(
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
) {
  return env.INVENTORY_LIFECYCLE_SCHEMA_READY === "1";
}

export function isInventoryLifecycleCommandsEnabled(
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
) {
  return isInventoryLifecycleSchemaReady(env) && env.INVENTORY_LIFECYCLE_COMMANDS === "1";
}

export function isInventoryLifecycleUiEnabled(
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
) {
  return isInventoryLifecycleSchemaReady(env) && env.INVENTORY_LIFECYCLE_UI === "1";
}

export function isInventoryLifecycleStoreEnabled(
  storeId: string | null | undefined,
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
) {
  return isStoreRolloutEnabled({
    storeId,
    allStoresEnabled: env.INVENTORY_LIFECYCLE_ALL_STORES_ENABLED,
    allowlist: env.INVENTORY_LIFECYCLE_STORE_ALLOWLIST,
    denylist: env.INVENTORY_LIFECYCLE_STORE_DENYLIST,
  });
}

export function isInventoryLifecycleCommandEnabledForStore(
  storeId: string | null | undefined,
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
) {
  return isInventoryLifecycleCommandsEnabled(env) && isInventoryLifecycleStoreEnabled(storeId, env);
}

export function isInventoryLifecycleReadEnabledForStore(
  storeId: string | null | undefined,
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
) {
  return isInventoryLifecycleUiEnabled(env) && isInventoryLifecycleStoreEnabled(storeId, env);
}

/**
 * Resolves the list/detail read mode without throwing. Dormant stores stay on
 * the compatibility projection; an explicitly requested UI whose schema is
 * not ready is unavailable and must not silently fall back to an in-sale
 * label.
 */
export function resolveInventoryLifecycleProjectionMode(
  storeId: string | null | undefined,
  env: InventoryLifecycleFeatureEnvironment = process.env as InventoryLifecycleFeatureEnvironment,
): InventoryLifecycleProjectionMode {
  if (isInventoryLifecycleReadEnabledForStore(storeId, env)) return "exact";
  const rolloutRequested =
    env.INVENTORY_LIFECYCLE_UI === "1" && isInventoryLifecycleStoreEnabled(storeId, env);
  return rolloutRequested && !isInventoryLifecycleSchemaReady(env) ? "unavailable" : "compatible";
}

export function assertInventoryLifecycleCommandEnabled(storeId: string) {
  if (!isInventoryLifecycleCommandEnabledForStore(storeId)) {
    throw new InventoryLifecycleFeatureDisabledError();
  }
}

export function assertInventoryLifecycleReadEnabled(storeId: string) {
  if (!isInventoryLifecycleReadEnabledForStore(storeId)) {
    throw new InventoryLifecycleFeatureDisabledError();
  }
}
