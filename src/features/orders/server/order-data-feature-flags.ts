type OrderDataFeatureEnvironment = {
  ORDER_DATA_EXPORT_ENABLED?: string;
  ORDER_DATA_APPLY_ENABLED?: string;
};

export function isOrderDataExportEnabled(
  env: OrderDataFeatureEnvironment = process.env as OrderDataFeatureEnvironment,
) {
  return env.ORDER_DATA_EXPORT_ENABLED === "1";
}

export function isOrderDataApplyEnabled(
  env: OrderDataFeatureEnvironment = process.env as OrderDataFeatureEnvironment,
) {
  return env.ORDER_DATA_APPLY_ENABLED === "1";
}
