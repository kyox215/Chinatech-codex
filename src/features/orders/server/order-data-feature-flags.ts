type OrderDataFeatureEnvironment = {
  ORDER_DATA_EXPORT_ENABLED?: string;
  ORDER_DATA_APPLY_ENABLED?: string;
  ORDER_DATA_APPLY_STORE_ALLOWLIST?: string;
};

export function isOrderDataExportEnabled(
  env: OrderDataFeatureEnvironment = process.env as OrderDataFeatureEnvironment,
) {
  return env.ORDER_DATA_EXPORT_ENABLED === "1";
}

export function isOrderDataApplyEnabled(
  storeId: string | undefined,
  env: OrderDataFeatureEnvironment = process.env as OrderDataFeatureEnvironment,
) {
  if (env.ORDER_DATA_APPLY_ENABLED !== "1" || !storeId) return false;
  return new Set(
    (env.ORDER_DATA_APPLY_STORE_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ).has(storeId);
}
