import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolvePublic = vi.hoisted(() => vi.fn());

vi.mock("@/features/customer-status/server/customer-status.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/customer-status/server/customer-status.service")
  >("@/features/customer-status/server/customer-status.service");
  return { ...actual, resolveCustomerStatusPublic: resolvePublic };
});

import { POST } from "./route";

describe("POST /api/public/order-status", () => {
  beforeEach(() => resolvePublic.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("returns only the customer-safe projection with private response headers", async () => {
    resolvePublic.mockResolvedValue({
      store: { name: "Chinatech", phone: "+39 000" },
      order: {
        public_no: "R2027001",
        device: "Apple iPhone",
        stage: "repair",
        stage_label: "Riparazione in corso",
        progress_percent: 72,
        last_updated_at: "2026-07-20T12:00:00.000Z",
        next_action: "Attendi il completamento della riparazione.",
      },
    });
    const token = "A".repeat(43);
    const request = jsonRequest({ token });
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(request.url).not.toContain(token);
    expect(resolvePublic).toHaveBeenCalledWith(token, "unknown");
    expect(JSON.stringify(payload)).not.toMatch(
      /customer_name|phone_e164|imei|diagnosis|technician|quotation|internal_tag|order_id/,
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("uses the same 404 body for unavailable links", async () => {
    resolvePublic.mockResolvedValue(null);
    const response = await POST(jsonRequest({ token: "B".repeat(43) }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        code: "LINK_UNAVAILABLE",
        message: "Questo link non è disponibile. Contatta il negozio per assistenza.",
      },
    });
  });

  it("rejects cross-origin and non-JSON requests before token resolution", async () => {
    const crossOrigin = await POST(
      new NextRequest("https://www.chinatech.in/api/public/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify({ token: "C".repeat(43) }),
      }),
    );
    const wrongType = await POST(
      new NextRequest("https://www.chinatech.in/api/public/order-status", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "token",
      }),
    );

    expect(crossOrigin.status).toBe(403);
    expect(wrongType.status).toBe(415);
    expect(resolvePublic).not.toHaveBeenCalled();
  });

  it("uses Vercel's platform-normalized client IP instead of a forwarded spoof", async () => {
    vi.stubEnv("VERCEL", "1");
    resolvePublic.mockResolvedValue(null);
    const token = "D".repeat(43);
    const request = new NextRequest("https://www.chinatech.in/api/public/order-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.chinatech.in",
        "X-Vercel-Forwarded-For": "198.51.100.10",
        "X-Forwarded-For": "203.0.113.99",
      },
      body: JSON.stringify({ token }),
    });

    await POST(request);

    expect(resolvePublic).toHaveBeenCalledWith(token, "198.51.100.10");
  });

  it("fails closed to an unknown IP bucket when Vercel omits its normalized header", async () => {
    vi.stubEnv("VERCEL", "1");
    resolvePublic.mockResolvedValue(null);
    const token = "E".repeat(43);
    const request = new NextRequest("https://www.chinatech.in/api/public/order-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.chinatech.in",
        "X-Forwarded-For": "203.0.113.99",
      },
      body: JSON.stringify({ token }),
    });

    await POST(request);

    expect(resolvePublic).toHaveBeenCalledWith(token, "unknown");
  });
});

function jsonRequest(body: unknown) {
  return new NextRequest("https://www.chinatech.in/api/public/order-status", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://www.chinatech.in" },
    body: JSON.stringify(body),
  });
}
