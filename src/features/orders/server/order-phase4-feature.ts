type OrderPhase4Environment = {
  NODE_ENV?: string;
  REPAIRDESK_E2E_BUSINESS_DESKTOP?: string;
  ORDER_STRUCTURED_FACTS_V2_ENABLED?: string;
  ORDER_STRUCTURED_FACTS_V2_STORE_ALLOWLIST?: string;
  ORDER_RELATED_ORDER_V2_ENABLED?: string;
  ORDER_RELATED_ORDER_V2_STORE_ALLOWLIST?: string;
  ORDER_DATA_WORKBOOK_V3_EXPORT_ENABLED?: string;
  ORDER_DATA_WORKBOOK_V3_IMPORT_ENABLED?: string;
  ORDER_DATA_WORKBOOK_V3_STORE_ALLOWLIST?: string;
};

function isStoreEnabled(
  storeId: string | undefined,
  flag: string | undefined,
  allowlist: string | undefined,
  env: OrderPhase4Environment,
) {
  if (flag !== "1") return false;
  if (!storeId && env.NODE_ENV !== "production" && env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1") {
    return true;
  }
  if (!storeId) return false;
  return new Set(
    (allowlist ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ).has(storeId);
}

export function isOrderStructuredFactsV2EnabledForStore(
  storeId: string | undefined,
  env: OrderPhase4Environment = process.env as OrderPhase4Environment,
) {
  return isStoreEnabled(
    storeId,
    env.ORDER_STRUCTURED_FACTS_V2_ENABLED,
    env.ORDER_STRUCTURED_FACTS_V2_STORE_ALLOWLIST,
    env,
  );
}

export function isOrderRelatedOrderV2EnabledForStore(
  storeId: string | undefined,
  env: OrderPhase4Environment = process.env as OrderPhase4Environment,
) {
  return isStoreEnabled(
    storeId,
    env.ORDER_RELATED_ORDER_V2_ENABLED,
    env.ORDER_RELATED_ORDER_V2_STORE_ALLOWLIST,
    env,
  );
}

export function isOrderDataWorkbookV3ExportEnabledForStore(
  storeId: string | undefined,
  env: OrderPhase4Environment = process.env as OrderPhase4Environment,
) {
  return isStoreEnabled(
    storeId,
    env.ORDER_DATA_WORKBOOK_V3_EXPORT_ENABLED,
    env.ORDER_DATA_WORKBOOK_V3_STORE_ALLOWLIST,
    env,
  );
}

export function isOrderDataWorkbookV3ImportEnabledForStore(
  storeId: string | undefined,
  env: OrderPhase4Environment = process.env as OrderPhase4Environment,
) {
  return isStoreEnabled(
    storeId,
    env.ORDER_DATA_WORKBOOK_V3_IMPORT_ENABLED,
    env.ORDER_DATA_WORKBOOK_V3_STORE_ALLOWLIST,
    env,
  );
}

export function assertOrderRelatedOrderV2EnabledForStore(storeId: string | undefined) {
  if (isOrderRelatedOrderV2EnabledForStore(storeId)) return;
  const error = new Error("关联售后复检尚未对当前门店开放") as Error & {
    status: number;
    code: string;
  };
  error.status = 403;
  error.code = "ORDER_RELATED_ORDER_V2_DISABLED";
  throw error;
}
