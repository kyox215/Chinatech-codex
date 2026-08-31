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
});
