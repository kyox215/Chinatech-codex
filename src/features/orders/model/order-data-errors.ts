export const ORDER_DATA_APPLY_FAILURE_CODES = [
  "batch_not_found",
  "batch_not_applicable",
  "batch_has_invalid_rows",
  "batch_has_no_ready_rows",
] as const;

export type OrderDataApplyFailureCode = (typeof ORDER_DATA_APPLY_FAILURE_CODES)[number];

export class OrderDataApplyRepositoryError extends Error {
  readonly code: OrderDataApplyFailureCode;

  constructor(code: OrderDataApplyFailureCode) {
    super("应用工单导入失败");
    this.name = "OrderDataApplyRepositoryError";
    this.code = code;
  }
}

export function extractOrderDataApplyFailureCode(
  message: string | undefined,
): OrderDataApplyFailureCode | undefined {
  if (!message) return undefined;
  return ORDER_DATA_APPLY_FAILURE_CODES.find((code) => message.includes(code));
}
