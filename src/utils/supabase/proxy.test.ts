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
});
