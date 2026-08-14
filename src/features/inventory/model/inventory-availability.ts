export type InventoryAvailabilityState =
  | "loading"
  | "no-permission"
  | "feature-off"
  | "not-found-or-hidden"
  | "service-unavailable"
  | "retrying"
  | "available";

export type InventoryAvailabilityInput = {
  shellLoading?: boolean;
  hasPermission: boolean;
  featureEnabled: boolean;
  queryState: "idle" | "loading" | "success" | "error";
  hasData: boolean;
  isRetrying?: boolean;
  error?: unknown;
};

export type InventoryAvailabilityResolution = {
  state: InventoryAvailabilityState;
  retryable: boolean;
};

type ErrorLike = { status?: unknown; code?: unknown; name?: unknown };

const notFoundCodes = new Set(["not_found", "record_not_found", "hidden", "unavailable"]);
const timeoutNames = new Set(["RepairDeskRequestTimeoutError", "AbortError", "TypeError"]);

function readErrorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? (error as ErrorLike) : {};
}

function errorState(
  error: unknown,
): Exclude<InventoryAvailabilityState, "loading" | "retrying" | "feature-off"> {
  const candidate = readErrorLike(error);
  const status = typeof candidate.status === "number" ? candidate.status : undefined;
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : undefined;
  const name = typeof candidate.name === "string" ? candidate.name : undefined;
  if (status === 401 || status === 403 || code === "forbidden" || code === "permission_denied") {
    return "no-permission";
  }
  if (status === 404 || (code ? notFoundCodes.has(code) || code.startsWith("not_found") : false)) {
    return "not-found-or-hidden";
  }
  if (
    status === 408 ||
    (status !== undefined && status >= 500) ||
    (name ? timeoutNames.has(name) : false)
  ) {
    return "service-unavailable";
  }
  return "service-unavailable";
}

/**
 * Resolves only access/read availability. It never renders or inspects an error
 * message, and intentionally does not decide any lifecycle command permission.
 */
export function resolveInventoryAvailability({
  shellLoading = false,
  hasPermission,
  featureEnabled,
  queryState,
  hasData,
  isRetrying = false,
  error,
}: InventoryAvailabilityInput): InventoryAvailabilityResolution {
  if (shellLoading) return { state: "loading", retryable: false };
  if (!hasPermission) return { state: "no-permission", retryable: false };
  if (!featureEnabled) return { state: "feature-off", retryable: false };
  if (isRetrying) return { state: "retrying", retryable: true };
  if (queryState === "loading" && !hasData) {
    return { state: "loading", retryable: false };
  }
  if (queryState === "error" && !hasData) {
    const state = errorState(error);
    return { state, retryable: state === "service-unavailable" };
  }
  if (hasData || queryState === "success") return { state: "available", retryable: false };
  return { state: "service-unavailable", retryable: true };
}
