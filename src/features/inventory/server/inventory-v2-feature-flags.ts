export type InventoryV2FeatureEnvironment = {
  INVENTORY_V2_SCHEMA_READY?: string;
  INVENTORY_V2_SHADOW_READ?: string;
  INVENTORY_V2_COMMANDS?: string;
  INVENTORY_V2_UI?: string;
  INVENTORY_V2_STORE_ALLOWLIST?: string;
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

export function isInventoryV2StoreEnabled(
  storeId: string | null | undefined,
  env: InventoryV2FeatureEnvironment = process.env as InventoryV2FeatureEnvironment,
) {
  if (!storeId) return false;
  return (env.INVENTORY_V2_STORE_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(storeId);
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
