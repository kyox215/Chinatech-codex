import { describe, expect, it } from "vitest";

import { translateMessage } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";
import {
  classifyBuybackSafeError,
  formatBuybackDate,
  formatBuybackMoney,
  localizeBuybackDeduction,
  localizeBuybackFilter,
  localizeBuybackNextAction,
  localizeBuybackOutcome,
  localizeBuybackOutcomeAction,
  localizeBuybackRejectReason,
  localizeBuybackRevision,
  localizeBuybackRisk,
  localizeBuybackSafeError,
} from "./buyback-i18n";

const locales = ["zh-CN", "it-IT", "en"] as const;
const translator =
  (locale: AppLocale) =>
  (key: Parameters<typeof translateMessage>[1], values?: Record<string, string | number>) =>
    translateMessage(locale, key, values);

describe("buyback i18n presentation", () => {
  it.each(locales)("localizes all stable codes in %s and preserves future values", (locale) => {
    const t = translator(locale);
    for (const code of ["all", "awaiting", "accepted", "deferred", "rejected"]) {
      expect(localizeBuybackFilter(code, t)).not.toBe(code);
    }
    for (const code of ["accepted", "deferred", "rejected"]) {
      expect(localizeBuybackOutcome(code, t)).not.toBe(code);
      expect(localizeBuybackOutcomeAction(code, t)).not.toBe(code);
    }
    for (const code of ["price_gap", "changed_mind", "other_channel", "other"]) {
      expect(localizeBuybackRejectReason(code, t)).not.toBe(code);
    }
    for (const code of ["low", "medium", "high"]) {
      expect(localizeBuybackRisk(code, false, t)).not.toBe(code);
    }
    for (const code of ["initial", "reprice"]) {
      expect(localizeBuybackRevision(code, t)).not.toBe(code);
    }
    expect(localizeBuybackDeduction("screen", "屏幕状况调整", t)).not.toBe("screen");
    expect(localizeBuybackDeduction("future", "动态扣减-SENTINEL", t)).toBe("动态扣减-SENTINEL");
    expect(localizeBuybackFilter("future-filter", t)).toBe("future-filter");
    expect(localizeBuybackOutcome("future-outcome", t)).toBe("future-outcome");
    expect(localizeBuybackRejectReason("future-reason", t)).toBe("future-reason");
    expect(localizeBuybackRisk("future-risk", false, t)).toBe("future-risk");
    expect(localizeBuybackRevision("future-revision", t)).toBe("future-revision");
  });

  it.each(locales)("formats Rome dates and EUR without throwing in %s", (locale) => {
    const t = translator(locale);
    expect(formatBuybackDate("2026-10-25T00:30:00.000Z", locale, t, true)).toContain("02:30");
    expect(formatBuybackDate("invalid", locale, t)).toBe(t("buyback2b5.value.invalidDate"));
    expect(formatBuybackDate(undefined, locale, t)).toBe(t("buyback2b5.value.notSet"));
    expect(formatBuybackMoney(1234.5, locale)).toContain("€");
    expect(formatBuybackMoney(Number.NaN, locale)).toContain("0");
    expect(localizeBuybackNextAction("accepted", false, false, t)).not.toContain("accepted");
  });

  it.each(locales)("sanitizes errors by status, code, and name in %s", (locale) => {
    const t = translator(locale);
    const sentinel = "PROVIDER-SECRET-SENTINEL";
    const errors = [
      { status: 409, message: sentinel },
      { status: 403, message: sentinel },
      { name: "AbortError", message: sentinel },
      { status: 599, code: "FUTURE", details: sentinel, message: sentinel },
    ];
    expect(errors.map(classifyBuybackSafeError)).toEqual([
      "conflict",
      "permission",
      "offline",
      "generic",
    ]);
    for (const error of errors) {
      const copy = localizeBuybackSafeError(error, t);
      expect(copy).not.toContain(sentinel);
      expect(copy.length).toBeGreaterThan(4);
    }
  });
});
