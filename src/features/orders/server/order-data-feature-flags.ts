export function isOrderDataExportEnabled() {
  return process.env.ORDER_DATA_EXPORT_ENABLED !== "0";
}

export function isOrderDataApplyEnabled() {
  return process.env.ORDER_DATA_APPLY_ENABLED !== "0";
}
