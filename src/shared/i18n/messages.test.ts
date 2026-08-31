import { describe, expect, it } from "vitest";

import { APP_LOCALES } from "@/shared/i18n/locales";
import { messagesByLocale, translateMessage, type MessageKey } from "@/shared/i18n/messages";

function interpolationTokens(message: string) {
  return [...message.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

describe("internationalized messages", () => {
  it("keeps every locale catalog structurally identical", () => {
    const expectedKeys = Object.keys(messagesByLocale["zh-CN"]).sort();
    for (const locale of APP_LOCALES) {
      expect(Object.keys(messagesByLocale[locale]).sort()).toEqual(expectedKeys);
      expect(Object.values(messagesByLocale[locale]).every(Boolean)).toBe(true);
    }
  });

  it("interpolates values in the selected language", () => {
    expect(translateMessage("en", "shell.switchedStore", { store: "Roma Centro" })).toBe(
      "Active store: Roma Centro",
    );
    expect(translateMessage("it-IT", "shell.switchedStore", { store: "Milano" })).toBe(
      "Negozio attivo: Milano",
    );
  });

  it("keeps interpolation parameters identical across catalogs", () => {
    for (const key of Object.keys(messagesByLocale["zh-CN"]) as MessageKey[]) {
      const expectedTokens = interpolationTokens(messagesByLocale["zh-CN"][key]);
      for (const locale of APP_LOCALES) {
        expect(interpolationTokens(messagesByLocale[locale][key]), `${locale}:${key}`).toEqual(
          expectedTokens,
        );
      }
    }
  });
});
