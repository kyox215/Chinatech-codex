import { formatCurrency, formatDate, formatDateTime } from "@/shared/i18n/format";
import type { AppLocale } from "@/shared/i18n/locales";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const filterKeys: Record<string, MessageKey> = {
  all: "buyback2b5.filter.all",
  awaiting: "buyback2b5.filter.awaiting",
  accepted: "buyback2b5.filter.accepted",
  deferred: "buyback2b5.filter.deferred",
  rejected: "buyback2b5.filter.rejected",
};

const outcomeKeys: Record<string, MessageKey> = {
  awaiting: "buyback2b5.outcome.awaiting",
  undecided: "buyback2b5.outcome.awaiting",
  accepted: "buyback2b5.outcome.accepted",
  deferred: "buyback2b5.outcome.deferred",
  rejected: "buyback2b5.outcome.rejected",
};

const outcomeActionKeys: Record<string, MessageKey> = {
  accepted: "buyback2b5.response.accept",
  deferred: "buyback2b5.response.defer",
  rejected: "buyback2b5.response.reject",
};

const rejectReasonKeys: Record<string, MessageKey> = {
  price_gap: "buyback2b5.reject.priceGap",
  changed_mind: "buyback2b5.reject.changedMind",
  other_channel: "buyback2b5.reject.otherChannel",
  other: "buyback2b5.reject.other",
};

const riskKeys: Record<string, MessageKey> = {
  low: "buyback2b5.risk.low",
  medium: "buyback2b5.risk.medium",
  high: "buyback2b5.risk.high",
};

const revisionKeys: Record<string, MessageKey> = {
  initial: "buyback2b5.revision.initial",
  reprice: "buyback2b5.revision.reprice",
};

const deductionKeys: Record<string, MessageKey> = {
  screen: "buyback2b5.deduction.screen",
  battery: "buyback2b5.deduction.battery",
  adjustment: "buyback2b5.deduction.adjustment",
};

export function localizeBuybackFilter(code: string, t: Translate) {
  const key = filterKeys[code];
  return key ? t(key) : code;
}

export function localizeBuybackOutcome(code: string | undefined, t: Translate) {
  if (!code) return t("buyback2b5.outcome.awaiting");
  const key = outcomeKeys[code];
  return key ? t(key) : code;
}

export function localizeBuybackOutcomeAction(code: string, t: Translate) {
  const key = outcomeActionKeys[code];
  return key ? t(key) : code;
}

export function localizeBuybackRejectReason(code: string, t: Translate) {
  const key = rejectReasonKeys[code];
  return key ? t(key) : code;
}

export function localizeBuybackRisk(code: string | undefined, hardBlock: boolean, t: Translate) {
  if (hardBlock) return t("buyback2b5.risk.blocked");
  if (!code) return t("buyback2b5.risk.low");
  const key = riskKeys[code];
  return key ? t(key) : code;
}

export function localizeBuybackRevision(code: string, t: Translate) {
  const key = revisionKeys[code];
  return key ? t(key) : code;
}

export function localizeBuybackDeduction(code: string, label: string, t: Translate) {
  const key = deductionKeys[code];
  return key ? t(key) : label || code;
}

export function formatBuybackMoney(value: number, locale: AppLocale) {
  return formatCurrency(Number.isFinite(value) ? value : 0, locale);
}

export function formatBuybackDate(
  value: unknown,
  locale: AppLocale,
  t: Translate,
  withTime = false,
) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return t("buyback2b5.value.notSet");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return t("buyback2b5.value.invalidDate");
  return withTime
    ? formatDateTime(date, locale, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : formatDate(date, locale, { month: "numeric", day: "numeric" });
}

export function localizeBuybackNextAction(
  outcome: string | undefined,
  expired: boolean,
  blocked: boolean,
  t: Translate,
) {
  if (blocked) return t("buyback2b5.next.blocked");
  if (expired) return t("buyback2b5.next.expired");
  const keys: Record<string, MessageKey> = {
    accepted: "buyback2b5.next.accepted",
    deferred: "buyback2b5.next.deferred",
    rejected: "buyback2b5.next.rejected",
  };
  return outcome && keys[outcome] ? t(keys[outcome]) : t("buyback2b5.next.awaiting");
}

export type BuybackSafeErrorKind = "conflict" | "permission" | "offline" | "generic";

export function classifyBuybackSafeError(error: unknown): BuybackSafeErrorKind {
  const source =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const status = typeof source.status === "number" ? source.status : undefined;
  const code = typeof source.code === "string" ? source.code : "";
  const name = typeof source.name === "string" ? source.name : "";
  if (status === 409 || code === "CONFLICT" || code === "STALE_VERSION") return "conflict";
  if (status === 401 || status === 403 || code === "FORBIDDEN" || code === "UNAUTHORIZED") {
    return "permission";
  }
  if (name === "AbortError" || code === "OFFLINE" || code === "NETWORK_ERROR") return "offline";
  return "generic";
}

export function localizeBuybackSafeError(error: unknown, t: Translate) {
  return t(`buyback2b5.error.${classifyBuybackSafeError(error)}` as MessageKey);
}
