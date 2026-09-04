import type { StorePurgeRequest } from "@/lib/repairdesk/types";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateSettingsOperations } from "@/shared/i18n/messages";

export type StorePurgeManagerMode = "request" | "confirm";

export type MutationOutcome = {
  kind: StorePurgeManagerMode | "cancel";
  previousState: StorePurgeRequest["state"] | null;
};

const knownPurgeRequestStates: ReadonlySet<StorePurgeRequest["state"]> = new Set([
  "cooling",
  "preparing_export",
  "ready_for_confirmation",
  "scheduled",
  "cancelled",
  "purging",
  "failed",
  "completed",
]);

export function isKnownPurgeRequestState(value: unknown): value is StorePurgeRequest["state"] {
  return (
    typeof value === "string" && knownPurgeRequestStates.has(value as StorePurgeRequest["state"])
  );
}

export function cancellableState(request: StorePurgeRequest) {
  return (
    ["cooling", "preparing_export", "ready_for_confirmation", "scheduled"].includes(
      request.state,
    ) && !request.destructive_step_started
  );
}

export function isMutationOutcomeResolved(
  outcome: MutationOutcome,
  request: StorePurgeRequest | null,
) {
  if (!request || !isKnownPurgeRequestState(request.state)) return false;
  if (outcome.kind === "cancel") return request.state === "cancelled";
  if (outcome.kind === "confirm") {
    return ["scheduled", "purging", "failed", "completed"].includes(request.state);
  }
  return (
    request.state !== "cancelled" &&
    (outcome.previousState === null || outcome.previousState === "cancelled")
  );
}

export function formatTimestamp(value: string, locale: AppLocale = "zh-CN") {
  if (!value) return translateSettingsOperations(locale, "未提供");
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return translateSettingsOperations(locale, "时间不可用");
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(timestamp);
}
