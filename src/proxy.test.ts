import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { LOCALE_COOKIE } from "@/shared/i18n/locales";

import { proxy } from "./proxy";

describe("locale-aware request proxy", () => {
  it.each(["/r", "/kiosk"])("forces fixed Italian customer route %s to Italian", async (path) => {
    const request = new NextRequest(`https://www.chinatech.in${path}`, {
      headers: { cookie: `${LOCALE_COOKIE}=en` },
    });

    const response = await proxy(request);

    expect(request.cookies.get(LOCALE_COOKIE)?.value).toBe("it-IT");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("preserves the employee locale on ordinary application routes", async () => {
    const request = new NextRequest("https://www.chinatech.in/login", {
      headers: { cookie: `${LOCALE_COOKIE}=en` },
    });

    const response = await proxy(request);

    expect(request.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each(["/r", "/kiosk"])(
    "applies the bounded public page headers to exact route %s",
    async (path) => {
      const response = await proxy(new NextRequest(`https://www.chinatech.in${path}`));

      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(response.headers.get("permissions-policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    },
  );

  it("does not apply the public page policy to Kiosk API responses", async () => {
    const response = await proxy(
      new NextRequest("https://www.chinatech.in/api/kiosk/session", {
        headers: { "x-kiosk-token": "test-token" },
      }),
    );

    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("permissions-policy")).toBeNull();
  });
});
