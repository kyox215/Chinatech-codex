import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth-context";

import { assertRepairDeskPostRequestAllowed } from "./repairdesk-request-guard";

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
});
