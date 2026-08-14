export type InventoryOperationErrorKind = "rejected" | "authorization" | "outcome-unknown";

export type InventoryOperationErrorSubtype =
  | "validation"
  | "authorization"
  | "connectivity"
  | "server"
  | "generic";

export type InventoryOperationErrorDetails = {
  kind: InventoryOperationErrorKind;
  subtype: InventoryOperationErrorSubtype;
  status?: number;
  code?: string;
};

type ErrorLike = {
  name?: unknown;
  status?: unknown;
  code?: unknown;
};

const authorizationCodes = new Set([
  "forbidden",
  "unauthorized",
  "permission_denied",
  "not_allowed",
  "insufficient_permissions",
]);

const validationCodes = new Set([
  "bad_request",
  "invalid_input",
  "invalid_request",
  "validation_failed",
  "unprocessable_entity",
  "required_field",
]);

const validationNames = new Set([
  "InventoryReservationValidationError",
  "InventoryValidationError",
  "ValidationError",
  "ZodError",
]);

function readErrorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? (error as ErrorLike) : {};
}

/**
 * Converts structured operation failures to safe UI semantics. The helper
 * deliberately ignores localized `message`/`details` values. HTTP 409 is
 * reserved for InventoryConflictPanel and therefore returns null.
 */
export function classifyInventoryOperationError(
  error: unknown,
): InventoryOperationErrorDetails | null {
  const candidate = readErrorLike(error);
  const status = typeof candidate.status === "number" ? candidate.status : undefined;
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : undefined;
  const name = typeof candidate.name === "string" ? candidate.name : undefined;

  if (status === 409) return null;

  if (status === 401 || status === 403 || (code ? authorizationCodes.has(code) : false)) {
    return { kind: "authorization", subtype: "authorization", status, code };
  }

  if (
    (status !== undefined && [400, 422, 429].includes(status)) ||
    (code ? validationCodes.has(code) || code.startsWith("validation_") : false) ||
    (name ? validationNames.has(name) : false)
  ) {
    return { kind: "rejected", subtype: "validation", status, code };
  }

  if (name === "RepairDeskRequestTimeoutError" || name === "AbortError" || name === "TypeError") {
    return { kind: "outcome-unknown", subtype: "connectivity", status, code };
  }
  if (status === 408) {
    return { kind: "outcome-unknown", subtype: "connectivity", status, code };
  }
  if (status !== undefined && status >= 500) {
    return { kind: "outcome-unknown", subtype: "server", status, code };
  }

  return { kind: "outcome-unknown", subtype: "generic", status, code };
}

export type InventoryOperationVerificationStatus = "idle" | "verifying" | "verified" | "failed";

/**
 * Safe copy for screens that do not have a structured panel available. Never
 * forwards Error.message/details because API adapters may include secrets,
 * identifiers, or localized server diagnostics.
 */
export function inventorySafeOperationMessage(error: unknown, fallback: string): string {
  const candidate = error && typeof error === "object" ? (error as ErrorLike) : {};
  const status = typeof candidate.status === "number" ? candidate.status : undefined;
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  if (status === 401 || status === 403 || authorizationCodes.has(code)) {
    return "当前账号无权完成此操作，请核对门店与权限。";
  }
  if (
    status === 400 ||
    status === 422 ||
    status === 429 ||
    validationCodes.has(code) ||
    code.startsWith("validation_")
  ) {
    return "提交信息未通过校验，请检查标记字段后重试。";
  }
  if (status === 409) return "资料状态已变化，请刷新最新状态后再确认。";
  if (status === 408 || (status !== undefined && status >= 500)) {
    return "服务暂时不可用；当前写入结果需要重新核对，请稍后只读刷新。";
  }
  return fallback;
}
