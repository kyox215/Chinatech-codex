// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { assertCustomerStatusPublicRequest } from "./customer-status-http";

function request(url: string, origin: string, extra: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      host: new URL(url).host,
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...extra,
    },
  });
}

describe("customer status request origin", () => {
  it.each([
    "http://127.0.0.1:3149",
    "http://[::1]:3149",
    "http://localhost:3149",
    "https://www.chinatech.in",
  ])("accepts the exact browser origin %s even when NextURL normalizes loopback", (origin) =>
    expect(() =>
      assertCustomerStatusPublicRequest(request(`${origin}/api/status`, origin)),
    ).not.toThrow(),
  );

  it.each([
    ["http://127.0.0.1:3149", "http://localhost:3149"],
    ["http://localhost:3149", "http://127.0.0.1:3149"],
    ["http://127.0.0.1:3149", "http://127.0.0.1:3150"],
    ["http://127.0.0.1:3149", "https://127.0.0.1:3149"],
    ["http://127.0.0.1:3149", "https://evil.example"],
    ["https://www.chinatech.in", "https://chinatech.in"],
    ["https://www.chinatech.in", "null"],
  ])("rejects a different origin: %s / %s", (target, origin) => {
    expect(() =>
      assertCustomerStatusPublicRequest(request(`${target}/api/status`, origin)),
    ).toThrow("Richiesta non consentita.");
  });

  it("does not trust forwarded host or a production Host override", () => {
    expect(() =>
      assertCustomerStatusPublicRequest(
        request("http://localhost:3149/api/status", "https://evil.example", {
          "x-forwarded-host": "evil.example",
        }),
      ),
    ).toThrow();
    expect(() =>
      assertCustomerStatusPublicRequest(
        request("https://www.chinatech.in/api/status", "http://127.0.0.1:3149", {
          host: "127.0.0.1:3149",
        }),
      ),
    ).toThrow();
  });

  it("continues to reject cross-site requests and non-JSON bodies", () => {
    expect(() =>
      assertCustomerStatusPublicRequest(
        request("http://127.0.0.1:3149/api/status", "http://127.0.0.1:3149", {
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toThrow();
    expect(() =>
      assertCustomerStatusPublicRequest(
        request("http://127.0.0.1:3149/api/status", "http://127.0.0.1:3149", {
          "content-type": "text/plain",
        }),
      ),
    ).toThrow("Formato richiesta non valido.");
  });
});
