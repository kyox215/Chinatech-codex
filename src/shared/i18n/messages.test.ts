import { describe, expect, it } from "vitest";

import { APP_LOCALES } from "@/shared/i18n/locales";
import {
  aiAssistantPresentationCopy,
  getAiAssistantPresentationCopy,
  getMessagesScreenCopy,
  getMemoPresentationCopy,
  getProfitCenterCopy,
  messagesByLocale,
  memoPresentationCopy,
  messagesScreenCopy,
  profitCenterCopy,
  translateMessage,
  translateSettingsOperations,
  type MessageKey,
} from "@/shared/i18n/messages";

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

  it("localizes settings operations copy without altering dynamic values", () => {
    expect(translateSettingsOperations("zh-CN", "恢复 {store}？", { store: "Archivio 北店" })).toBe(
      "恢复 Archivio 北店？",
    );
    expect(translateSettingsOperations("it-IT", "恢复 {store}？", { store: "Archivio 北店" })).toBe(
      "Ripristinare Archivio 北店?",
    );
    expect(translateSettingsOperations("en", "恢复 {store}？", { store: "Archivio 北店" })).toBe(
      "Restore Archivio 北店?",
    );
  });

  it("keeps the Messages screen presentation catalog structurally complete", () => {
    const expectedKeys = Object.keys(messagesScreenCopy["zh-CN"]).sort();
    for (const locale of APP_LOCALES) {
      expect(Object.keys(messagesScreenCopy[locale]).sort()).toEqual(expectedKeys);
      expect(Object.values(messagesScreenCopy[locale]).every(Boolean)).toBe(true);
    }
    expect(getMessagesScreenCopy("zh-CN").saveTemplate).toBe("保存模板");
    expect(getMessagesScreenCopy("it-IT").saveTemplate).toBe("Salva modello");
    expect(getMessagesScreenCopy("en").saveTemplate).toBe("Save template");
  });

  it("keeps the Memos presentation catalog structurally complete", () => {
    const expectedKeys = Object.keys(memoPresentationCopy["zh-CN"]).sort();
    for (const locale of APP_LOCALES) {
      expect(Object.keys(memoPresentationCopy[locale]).sort()).toEqual(expectedKeys);
      expect(Object.values(memoPresentationCopy[locale]).every(Boolean)).toBe(true);
    }
    expect(getMemoPresentationCopy("zh-CN").newMemo).toBe("新建备忘");
    expect(getMemoPresentationCopy("it-IT").newMemo).toBe("Nuovo promemoria");
    expect(getMemoPresentationCopy("en").newMemo).toBe("New memo");
  });

  it("keeps the Profit center presentation catalog structurally complete", () => {
    const expectedKeys = Object.keys(profitCenterCopy["zh-CN"]).sort();
    for (const locale of APP_LOCALES) {
      expect(Object.keys(profitCenterCopy[locale]).sort()).toEqual(expectedKeys);
      expect(Object.values(profitCenterCopy[locale]).every(Boolean)).toBe(true);
    }
    expect(getProfitCenterCopy("zh-CN").exportCsv).toBe("导出成本 CSV");
    expect(getProfitCenterCopy("it-IT").exportCsv).toBe("Esporta costi CSV");
    expect(getProfitCenterCopy("en").exportCsv).toBe("Export costs CSV");
  });

  it("keeps the AI client presentation catalog structurally complete", () => {
    const expectedKeys = Object.keys(aiAssistantPresentationCopy["zh-CN"]).sort();
    for (const locale of APP_LOCALES) {
      expect(Object.keys(aiAssistantPresentationCopy[locale]).sort()).toEqual(expectedKeys);
      expect(Object.values(aiAssistantPresentationCopy[locale]).every(Boolean)).toBe(true);
    }
    expect(getAiAssistantPresentationCopy("zh-CN").send).toBe("发送");
    expect(getAiAssistantPresentationCopy("it-IT").send).toBe("Invia");
    expect(getAiAssistantPresentationCopy("en").send).toBe("Send");
  });
});
