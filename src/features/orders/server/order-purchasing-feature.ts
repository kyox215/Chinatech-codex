export function isOrderPurchasingEnabled() {
  return process.env.REPAIRDESK_ORDER_PURCHASING_ENABLED === "1";
}

export function assertOrderPurchasingEnabled() {
  if (!isOrderPurchasingEnabled()) {
    const error = new Error("工单采购功能尚未开放") as Error & { status?: number; code?: string };
    error.status = 503;
    error.code = "ORDER_PURCHASING_DISABLED";
    throw error;
  }
}
