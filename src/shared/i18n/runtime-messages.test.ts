import { describe, expect, it, vi } from "vitest";
import { APP_LOCALES } from "./locales";
import { commonMessages } from "./common-messages";
import { messagesByLocale, type MessageKey } from "./messages";

describe("cold locale catalog loading", () => {
  it("keeps synchronous helper copy available before any full catalog is loaded", async () => {
    vi.resetModules();
    const runtime = await import("./runtime-messages");
    for (const locale of APP_LOCALES) {
      expect(runtime.getLoadedMessageCatalog(locale)).toBeUndefined();
      for (const key of Object.keys(commonMessages[locale]) as MessageKey[]) {
        expect(runtime.translateLoadedMessage(locale, key)).toBe(messagesByLocale[locale][key]);
      }
    }
    expect(runtime.translateLoadedMessage("en", "orders.minutesAgo", { count: 3 })).toBe(
      "3 min ago",
    );
    const { localizeKnownDocumentTitle } = await import("./document-title");
    expect(localizeKnownDocumentTitle("登录 — RepairDesk", "en")).toBe("Sign in — RepairDesk");
  });

  it("deduplicates an in-flight language load without eagerly loading other languages", async () => {
    vi.resetModules();
    const runtime = await import("./runtime-messages");
    const first = runtime.loadMessageCatalog("en");
    expect(runtime.loadMessageCatalog("en")).toBe(first);
    await expect(first).resolves.toEqual(messagesByLocale.en);
    expect(runtime.getLoadedMessageCatalog("en")).toBeDefined();
    expect(runtime.getLoadedMessageCatalog("zh-CN")).toBeUndefined();
    expect(runtime.getLoadedMessageCatalog("it-IT")).toBeUndefined();
  });
});
