import { describe, expect, it, vi } from "vitest";

import {
  getAiAssistantUsageSummary,
  summarizeAiUsageBuckets,
  type AiUsageBucketRow,
} from "./usage.repository";

const now = new Date("2026-07-19T10:00:00.000Z");
const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Owner",
  storeId: "00000000-0000-4000-8000-000000000001",
  role: "owner" as const,
  storeRole: "owner" as const,
};

describe("AI usage repository", () => {
  it("aggregates only the active day and rolling 30-day store buckets", () => {
    const summary = summarizeAiUsageBuckets(
      [
        bucket("order_text", {
          request_count: 3,
          request_limit: 50,
          input_token_count: 1_000,
          cached_input_token_count: 200,
          output_token_count: 100,
          settled_cost_microusd: 80,
          reserved_cost_microusd: 20,
        }),
        bucket("inventory_vision", {
          request_count: 1,
          request_limit: 5,
          input_token_count: 500,
          output_token_count: 50,
          settled_cost_microusd: 40,
        }),
        bucket("order_text", {
          period_start_at: "2026-07-01T22:00:00.000Z",
          period_end_at: "2026-07-02T22:00:00.000Z",
          request_count: 2,
          input_token_count: 300,
          output_token_count: 30,
          settled_cost_microusd: 10,
        }),
        bucket("order_text", {
          period_start_at: "2026-06-01T22:00:00.000Z",
          period_end_at: "2026-06-02T22:00:00.000Z",
          request_count: 99,
        }),
      ],
      now,
    );

    expect(summary.today).toEqual({
      provider_request_count: 4,
      input_token_count: 1_500,
      cached_input_token_count: 200,
      output_token_count: 150,
      settled_cost_microusd: 120,
      reserved_cost_microusd: 20,
    });
    expect(summary.last_30_days).toMatchObject({
      provider_request_count: 6,
      input_token_count: 1_800,
      output_token_count: 180,
      settled_cost_microusd: 130,
    });
    expect(summary.today_by_kind.order_text).toMatchObject({
      provider_request_count: 3,
      request_limit: 50,
    });
    expect(summary.today_by_kind.inventory_vision).toMatchObject({
      provider_request_count: 1,
      request_limit: 5,
    });
  });

  it("scopes the read to the authenticated actor store", async () => {
    const listStoreDayBuckets = vi.fn(async () => []);

    const result = await getAiAssistantUsageSummary(owner, {
      now: () => now,
      listStoreDayBuckets,
    });

    expect(listStoreDayBuckets).toHaveBeenCalledWith(
      owner.storeId,
      expect.stringMatching(/^2026-06-18T/),
    );
    expect(result.today.provider_request_count).toBe(0);
  });

  it("denies aggregate usage to an ungranted sales member before reading data", async () => {
    const listStoreDayBuckets = vi.fn(async () => []);

    await expect(
      getAiAssistantUsageSummary(
        { ...owner, role: "sales", storeRole: "sales" },
        { now: () => now, listStoreDayBuckets },
      ),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
    expect(listStoreDayBuckets).not.toHaveBeenCalled();
  });
});

function bucket(
  requestKind: "order_text" | "inventory_vision",
  overrides: Partial<AiUsageBucketRow> = {},
): AiUsageBucketRow {
  return {
    request_kind: requestKind,
    period_start_at: "2026-07-18T22:00:00.000Z",
    period_end_at: "2026-07-19T22:00:00.000Z",
    quota_timezone: "Europe/Rome",
    request_limit: 50,
    request_count: 0,
    reserved_cost_microusd: 0,
    settled_cost_microusd: 0,
    input_token_count: 0,
    cached_input_token_count: 0,
    output_token_count: 0,
    ...overrides,
  };
}
