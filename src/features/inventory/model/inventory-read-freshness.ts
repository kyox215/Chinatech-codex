export type InventoryReadFreshnessState =
  | "fresh"
  | "stale"
  | "verifying"
  | "verify-failed"
  | "recovered"
  | "privacy-redacted";

export type InventoryReadFreshnessVerification = "idle" | "verifying" | "failed" | "recovered";

export type InventoryReadFreshnessInput = {
  hasData: boolean;
  keyMatches: boolean;
  queryState: "idle" | "loading" | "success" | "error";
  verification?: InventoryReadFreshnessVerification;
  lastSuccessAt?: number;
  suppressStaleGuard?: boolean;
  privacyRedacted?: boolean;
};

export type InventoryReadFreshnessResolution = {
  state: InventoryReadFreshnessState;
  hidden: boolean;
  lastSuccessAt?: number;
};

/**
 * Resolves read freshness without guessing connectivity or interpreting
 * localized errors. A query can retain data while entering `error`; that
 * combination is explicitly stale and never authorizes a write.
 */
export function resolveInventoryReadFreshness({
  hasData,
  keyMatches,
  queryState,
  verification = "idle",
  lastSuccessAt,
  suppressStaleGuard = false,
  privacyRedacted = false,
}: InventoryReadFreshnessInput): InventoryReadFreshnessResolution {
  if (!hasData || !keyMatches || suppressStaleGuard) {
    return { state: "fresh", hidden: true, lastSuccessAt };
  }
  if (privacyRedacted) {
    return { state: "privacy-redacted", hidden: false, lastSuccessAt };
  }
  if (queryState === "error") {
    if (verification === "verifying") {
      return { state: "verifying", hidden: false, lastSuccessAt };
    }
    if (verification === "failed") {
      return { state: "verify-failed", hidden: false, lastSuccessAt };
    }
    return { state: "stale", hidden: false, lastSuccessAt };
  }
  if (verification === "verifying") {
    return { state: "verifying", hidden: false, lastSuccessAt };
  }
  if (verification === "failed") {
    return { state: "verify-failed", hidden: false, lastSuccessAt };
  }
  if (verification === "recovered") {
    return { state: "recovered", hidden: false, lastSuccessAt };
  }
  return { state: "fresh", hidden: true, lastSuccessAt };
}

export function inventoryReadFreshnessBlocksWrites(
  resolution: InventoryReadFreshnessResolution,
): boolean {
  return ["stale", "verifying", "verify-failed", "privacy-redacted"].includes(resolution.state);
}
