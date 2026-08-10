import { isStoreRolloutEnabled } from "@/shared/lib/store-rollout";

export type InventoryProductInspectionFeatureEnvironment = {
  INVENTORY_PRODUCT_INSPECTION_SCHEMA_READY?: string;
  INVENTORY_PRODUCT_INSPECTION_ENABLED?: string;
  INVENTORY_PRODUCT_INSPECTION_ALL_STORES?: string;
  /** @deprecated Use INVENTORY_PRODUCT_INSPECTION_ALL_STORES. */
  INVENTORY_PRODUCT_INSPECTION_ALL_STORES_ENABLED?: string;
  INVENTORY_PRODUCT_INSPECTION_ALLOWLIST?: string;
  INVENTORY_PRODUCT_INSPECTION_DENYLIST?: string;
};

export class InventoryProductInspectionFeatureDisabledError extends Error {
  readonly status = 503;
  readonly code = "feature_disabled";

  constructor() {
    super("商品检测功能尚未对当前门店开放");
    this.name = "InventoryProductInspectionFeatureDisabledError";
  }
}

export function isInventoryProductInspectionSchemaReady(
  env: InventoryProductInspectionFeatureEnvironment = process.env as InventoryProductInspectionFeatureEnvironment,
) {
  return env.INVENTORY_PRODUCT_INSPECTION_SCHEMA_READY === "1";
}

export function isInventoryProductInspectionStoreEnabled(
  storeId: string | null | undefined,
  env: InventoryProductInspectionFeatureEnvironment = process.env as InventoryProductInspectionFeatureEnvironment,
) {
  return isStoreRolloutEnabled({
    storeId,
    allStoresEnabled:
      env.INVENTORY_PRODUCT_INSPECTION_ALL_STORES ??
      env.INVENTORY_PRODUCT_INSPECTION_ALL_STORES_ENABLED,
    allowlist: env.INVENTORY_PRODUCT_INSPECTION_ALLOWLIST,
    denylist: env.INVENTORY_PRODUCT_INSPECTION_DENYLIST,
  });
}

export function isInventoryProductInspectionEnabledForStore(
  storeId: string | null | undefined,
  env: InventoryProductInspectionFeatureEnvironment = process.env as InventoryProductInspectionFeatureEnvironment,
) {
  return (
    isInventoryProductInspectionSchemaReady(env) &&
    env.INVENTORY_PRODUCT_INSPECTION_ENABLED === "1" &&
    isInventoryProductInspectionStoreEnabled(storeId, env)
  );
}

export function assertInventoryProductInspectionEnabled(storeId: string) {
  if (!isInventoryProductInspectionEnabledForStore(storeId)) {
    throw new InventoryProductInspectionFeatureDisabledError();
  }
}
