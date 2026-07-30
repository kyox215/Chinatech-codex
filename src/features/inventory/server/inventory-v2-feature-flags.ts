import { isStoreRolloutEnabled } from "@/shared/lib/store-rollout";

export type InventoryV2FeatureEnvironment = {
  INVENTORY_V2_SCHEMA_READY?: string;
  INVENTORY_V2_SHADOW_READ?: string;
  INVENTORY_V2_COMMANDS?: string;
  INVENTORY_V2_UI?: string;
  INVENTORY_PRODUCT_DEVICE_DATA_V2?: string;
  INVENTORY_V2_ALL_STORES_ENABLED?: string;
  INVENTORY_V2_STORE_ALLOWLIST?: string;
  INVENTORY_V2_STORE_DENYLIST?: string;
  INVENTORY_LEGACY_MUTATIONS_ENABLED?: string;
};

export function isInventoryV2SchemaReady(
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return env.INVENTORY_V2_SCHEMA_READY === "1";
}

export function isInventoryV2ShadowReadEnabled(
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2SchemaReady(env) && env.INVENTORY_V2_SHADOW_READ === "1";
}

export function isInventoryV2CommandsEnabled(
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2SchemaReady(env) && env.INVENTORY_V2_COMMANDS === "1";
}

export function isInventoryV2UiEnabled(
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2SchemaReady(env) && env.INVENTORY_V2_UI === "1";
}

export function isInventoryProductDeviceDataV2Enabled(
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2SchemaReady(env) && env.INVENTORY_PRODUCT_DEVICE_DATA_V2 === "1";
}

export function assertInventoryProductDeviceDataV2Enabled() {
  if (!isInventoryProductDeviceDataV2Enabled()) {
    throw new Error("商品设备资料功能尚未开放");
  }
}

export function isInventoryV2StoreEnabled(
  storeId: string | null | undefined,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isStoreRolloutEnabled({
    storeId,
    allStoresEnabled: env.INVENTORY_V2_ALL_STORES_ENABLED,
    allowlist: env.INVENTORY_V2_STORE_ALLOWLIST,
    denylist: env.INVENTORY_V2_STORE_DENYLIST,
  });
}

export function isInventoryV2StoreExplicitlyAllowlisted(
  storeId: string | null | undefined,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isStoreRolloutEnabled({
    storeId,
    allowlist: env.INVENTORY_V2_STORE_ALLOWLIST,
    denylist: env.INVENTORY_V2_STORE_DENYLIST,
  });
}

export function isInventoryV2CommandEnabledForStore(
  storeId: string | null | undefined,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2CommandsEnabled(env) && isInventoryV2StoreEnabled(storeId, env);
}

export function isInventoryV2ShadowReadEnabledForStore(
  storeId: string | null | undefined,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2ShadowReadEnabled(env) && isInventoryV2StoreEnabled(storeId, env);
}

export function isInventoryV2UiEnabledForStore(
  storeId: string | null | undefined,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return isInventoryV2UiEnabled(env) && isInventoryV2StoreEnabled(storeId, env);
}

export function areLegacyInventoryMutationsEnabled(
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  return env.INVENTORY_LEGACY_MUTATIONS_ENABLED !== "0";
}

export function assertInventoryV2CommandEnabled(storeId: string) {
  if (!isInventoryV2CommandEnabledForStore(storeId)) {
    throw new Error("库存 V2 正式命令尚未对当前门店开放");
  }
}

export function assertInventoryV2ShadowReadEnabled(storeId: string) {
  if (!isInventoryV2ShadowReadEnabledForStore(storeId)) {
    throw new Error("库存 V2 影子对账尚未对当前门店开放");
  }
}
