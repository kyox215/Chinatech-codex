import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth-context";

import {
  assertRepairDeskPostRequestAllowed,
  resolveRepairDeskRequestOrigin,
} from "./repairdesk-request-guard";

describe("repairdesk request guard", () => {
  const requestOrigin = "https://chinatech.in";

  it("allows same-origin JSON post requests", () => {
    expect(() =>
      assertRepairDeskPostRequestAllowed({
        headers: new Headers({
          "content-type": "application/json",
          origin: requestOrigin,
          "sec-fetch-site": "same-origin",
        }),
        requestOrigin,
      }),
    ).not.toThrow();
  });

  it("rejects cross-site post requests before dispatch", () => {
    expect(() =>
      assertRepairDeskPostRequestAllowed({
        headers: new Headers({
          "content-type": "application/json",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        }),
        requestOrigin,
      }),
    ).toThrow(ForbiddenError);
  });

  it("rejects same-site subdomain origins that do not match the app origin", () => {
    expect(() =>
      assertRepairDeskPostRequestAllowed({
        headers: new Headers({
          "content-type": "application/json",
          origin: "https://attacker.chinatech.in",
          "sec-fetch-site": "same-site",
        }),
        requestOrigin,
      }),
    ).toThrow(ForbiddenError);
  });

  it("rejects non-json browser posts", () => {
    expect(() =>
      assertRepairDeskPostRequestAllowed({
        headers: new Headers({
          "content-type": "text/plain",
          origin: requestOrigin,
          "sec-fetch-site": "same-origin",
        }),
        requestOrigin,
      }),
    ).toThrow(ForbiddenError);
  });

  it("derives the browser-visible origin from Host when Next supplies an internal fallback", () => {
    expect(
      resolveRepairDeskRequestOrigin({
        headers: new Headers({
          host: "127.0.0.1:3111",
          "x-forwarded-proto": "http",
        }),
        fallbackOrigin: "http://n",
      }),
    ).toBe("http://127.0.0.1:3111");
  });

  it("rejects malformed Host values instead of reflecting them into the trusted origin", () => {
    expect(() =>
      resolveRepairDeskRequestOrigin({
        headers: new Headers({ host: "trusted.example@evil.example" }),
        fallbackOrigin: requestOrigin,
      }),
    ).toThrow(ForbiddenError);
  });
});
