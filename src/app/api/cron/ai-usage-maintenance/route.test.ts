import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runAiUsageMaintenance: vi.fn() }));

vi.mock("@/features/ai-assistant/server/ai-usage-maintenance", () => ({
  runAiUsageMaintenance: mocks.runAiUsageMaintenance,
}));

import { GET } from "./route";

const secret = "test-only-cron-secret-with-at-least-32-characters";

describe("AI usage maintenance cron route", () => {
  beforeEach(() => {
    mocks.runAiUsageMaintenance.mockReset();
    vi.stubEnv("CRON_SECRET", secret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects missing, malformed and weak cron credentials before maintenance", async () => {
    for (const authorization of [undefined, "Bearer wrong", `Basic ${secret}`]) {
      const headers = authorization ? { authorization } : undefined;
      const response = await GET(new Request("https://example.test/api/cron", { headers }));
      expect(response.status).toBe(401);
    }
    vi.stubEnv("CRON_SECRET", "short");
    const weakResponse = await GET(
      new Request("https://example.test/api/cron", {
        headers: { authorization: "Bearer short" },
      }),
    );
    expect(weakResponse.status).toBe(401);
    expect(mocks.runAiUsageMaintenance).not.toHaveBeenCalled();
  });

  it("returns only bounded counters for an authorized maintenance run", async () => {
    mocks.runAiUsageMaintenance.mockResolvedValueOnce({
      staleSettledCount: 2,
      requestDeletedCount: 3,
      rateBucketDeletedCount: 4,
    });
    const response = await GET(
      new Request("https://example.test/api/cron", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      staleSettledCount: 2,
      requestDeletedCount: 3,
      rateBucketDeletedCount: 4,
    });
    expect(response.status).toBe(200);
  });

  it("uses a safe failure envelope without logging the database error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runAiUsageMaintenance.mockRejectedValueOnce(new Error("SECRET database detail"));
    const response = await GET(
      new Request("https://example.test/api/cron", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "AI_USAGE_MAINTENANCE_UNAVAILABLE",
    });
    expect(response.status).toBe(503);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SECRET");
  });
});
