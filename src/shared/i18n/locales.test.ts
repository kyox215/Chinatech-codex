import { describe, expect, it } from "vitest";

import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  buildLocaleCookie,
  readLocaleCookie,
  resolveAppLocale,
} from "@/shared/i18n/locales";

describe("application locale contract", () => {
  it("accepts only the three exact supported locale values", () => {
    expect(APP_LOCALES).toEqual(["zh-CN", "it-IT", "en"]);
    expect(resolveAppLocale("zh-CN")).toBe("zh-CN");
    expect(resolveAppLocale("it-IT")).toBe("it-IT");
    expect(resolveAppLocale("en")).toBe("en");
    expect(resolveAppLocale("en-US")).toBe(DEFAULT_LOCALE);
    expect(resolveAppLocale("IT-it")).toBe(DEFAULT_LOCALE);
    expect(resolveAppLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("reads only a valid locale cookie and ignores malformed values", () => {
    expect(readLocaleCookie("a=1; repairdesk_locale=it-IT; b=2")).toBe("it-IT");
    expect(readLocaleCookie("repairdesk_locale=en-US")).toBeUndefined();
    expect(readLocaleCookie("repairdesk_locale=%E0%A4%A")).toBeUndefined();
  });

  it("builds the scoped one-year SameSite cookie", () => {
    expect(buildLocaleCookie("en")).toBe(
      "repairdesk_locale=en; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(buildLocaleCookie("it-IT", true)).toContain("; Secure");
  });
});
