export const ORDER_PRESET_REASON_WORKFLOW_ENABLED_VALUE = "1";

export function isOrderPresetReasonUiEnabled(
  value = process.env.NEXT_PUBLIC_ORDER_PRESET_REASON_WORKFLOW_ENABLED,
  nodeEnv = process.env.NODE_ENV,
) {
  if (nodeEnv === "test") return true;
  return value === ORDER_PRESET_REASON_WORKFLOW_ENABLED_VALUE;
}
