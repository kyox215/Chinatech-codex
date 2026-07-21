type OrderPresetReasonFeatureEnvironment = {
  NODE_ENV?: string;
  REPAIRDESK_E2E_BUSINESS_DESKTOP?: string;
  ORDER_PRESET_REASON_WORKFLOW_ENABLED?: string;
  ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST?: string;
  ORDER_REASON_PERSISTENCE_V2_ENABLED?: string;
};

export function isOrderPresetReasonWorkflowEnabledForStore(
  storeId: string | undefined,
  env: OrderPresetReasonFeatureEnvironment = process.env as OrderPresetReasonFeatureEnvironment,
) {
  if (env.ORDER_PRESET_REASON_WORKFLOW_ENABLED !== "1") return false;
  if (!storeId && env.NODE_ENV !== "production" && env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1") {
    return true;
  }
  if (!storeId) return false;
  const allowedStoreIds = new Set(
    (env.ORDER_PRESET_REASON_WORKFLOW_STORE_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowedStoreIds.has(storeId);
}

export function assertOrderPresetReasonWorkflowEnabledForStore(storeId: string | undefined) {
  if (isOrderPresetReasonWorkflowEnabledForStore(storeId)) return;
  const error = new Error("原因点选流程尚未对当前门店开放") as Error & {
    status: number;
    code: string;
  };
  error.status = 403;
  error.code = "ORDER_PRESET_REASON_WORKFLOW_DISABLED";
  throw error;
}

export function isOrderReasonPersistenceV2EnabledForStore(
  storeId: string | undefined,
  env: OrderPresetReasonFeatureEnvironment = process.env as OrderPresetReasonFeatureEnvironment,
) {
  return (
    env.ORDER_REASON_PERSISTENCE_V2_ENABLED === "1" &&
    isOrderPresetReasonWorkflowEnabledForStore(storeId, env)
  );
}
