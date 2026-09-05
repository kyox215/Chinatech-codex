export function isOrderCostsEnabled() {
  return process.env.REPAIRDESK_ORDER_COSTS_ENABLED === "1";
}

function isOrderCostChildFeatureEnabled(value: string | undefined) {
  return isOrderCostsEnabled() && value === "1";
}

export function isProfitReportsEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED);
}

export function isPartsProcurementEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED);
}

export function isCostExportEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_COST_EXPORT_ENABLED);
}

export function isCostBackfillEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_COST_BACKFILL_ENABLED);
}

export function isCostMultiCurrencyEnabled() {
  return isOrderCostChildFeatureEnabled(process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED);
}
