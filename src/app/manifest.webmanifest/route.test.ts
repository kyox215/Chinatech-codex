import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("localized web manifest", () => {
  it.each(["zh-CN", "en", "it-IT"])(
    "uses the %s cookie without a Next request context",
    async (locale) => {
      const response = GET(
        new NextRequest("http://localhost/manifest.webmanifest", {
          headers: { cookie: `repairdesk_locale=${locale}`, "accept-language": "de" },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/manifest+json");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({ lang: locale, start_url: "/orders" });
    },
  );

  it("falls back from an invalid cookie to Accept-Language", async () => {
    const response = GET(
      new NextRequest("http://localhost/manifest.webmanifest", {
        headers: { cookie: "repairdesk_locale=invalid", "accept-language": "it;q=0.9,en;q=0.5" },
      }),
    );
    expect((await response.json()).lang).toBe("it-IT");
    expect(response.headers.get("vary")).toBe("Cookie, Accept-Language");
  });
});
