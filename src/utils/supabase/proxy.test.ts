import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { updateSession } from "./proxy";

describe("Supabase session proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    mocks.createServerClient.mockReset();
    mocks.createServerClient.mockReturnValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }) },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("lets the secret-authenticated AI usage cron reach its route handler", async () => {
    const response = await updateSession(
      new NextRequest("https://www.chinatech.in/api/cron/ai-usage-maintenance"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each(["/r", "/api/public/order-status"])(
    "keeps the exact customer-status public route unauthenticated: %s",
    async (path) => {
      const response = await updateSession(new NextRequest(`https://www.chinatech.in${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
      if (path === "/r") {
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
        expect(response.headers.get("x-frame-options")).toBe("DENY");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
        expect(response.headers.get("x-robots-tag")).toContain("noindex");
      }
    },
  );

  it("preserves a safe next-path query for an already authenticated login request", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }),
      },
    });
    const request = new NextRequest("https://www.chinatech.in/login?next=%2Fr%3Fstaff%3D1", {
      headers: { cookie: "sb-example-auth-token=authenticated" },
    });
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.chinatech.in/r?staff=1");
  });
});
