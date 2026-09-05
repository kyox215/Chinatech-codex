import { describe, expect, it } from "vitest";

import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  buildLocaleCookie,
  readLocaleCookie,
  resolveAppLocale,
  resolvePreferredLocale,
} from "@/shared/i18n/locales";

describe("application locale contract", () => {
  it.each([
    ["en-US,en;q=0.9", "en"],
    ["IT-ch,it;q=0.9", "it-IT"],
    ["zh-Hant-TW,zh;q=0.9", "zh-CN"],
    ["fr-FR, it;q=0.8, en;q=0.7", "it-IT"],
    ["en;q=0.2, it-IT;q=0.9, zh-CN;q=0.5", "it-IT"],
    ["en-GB;q=0.8, it;q=0.8", "en"],
    ["zh;q=0, it;q=0.0, en;q=0.5", "en"],
    ["en;q=2, it;q=bad, zh;q=0.5", "zh-CN"],
    ["en-US-;q=1, it;q=0.7", "it-IT"],
    ["en;q=0.5;extra=1, it;q=0.4", "it-IT"],
    ["*, fr-FR", DEFAULT_LOCALE],
    ["", DEFAULT_LOCALE],
    [undefined, DEFAULT_LOCALE],
    [null, DEFAULT_LOCALE],
  ])("matches browser language preferences %s to %s", (header, expected) => {
    expect(resolvePreferredLocale(header)).toBe(expected);
  });

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
