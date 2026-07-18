import { describe, expect, it } from "vitest";

import {
  AI_PROPOSED_MONTHLY_BUDGET_MICRO_USD,
  AiCostPolicyError,
  estimateAiUsageMicroUsd,
} from "./cost-policy";

describe("AI cost policy", () => {
  it("uses integer micro-USD and the versioned exact-model rates", () => {
    expect(
      estimateAiUsageMicroUsd({
        model: "gpt-5-nano-2025-08-07",
        usage: {
          inputTokens: 1_000_000,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: 1_000_000,
        },
      }),
    ).toBe(450_000);
    expect(AI_PROPOSED_MONTHLY_BUDGET_MICRO_USD).toBe(50_000_000);
  });

  it("rounds every non-empty billable class up", () => {
    expect(
      estimateAiUsageMicroUsd({
        model: "gpt-5-nano-2025-08-07",
        usage: {
          inputTokens: 3,
          cachedInputTokens: 1,
          cacheWriteTokens: 1,
          outputTokens: 1,
        },
      }),
    ).toBe(4);
  });

  it.each([
    [
      "unknown model",
      "gpt-5-nano",
      { inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
    ],
    [
      "negative",
      "gpt-5-nano-2025-08-07",
      { inputTokens: -1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
    ],
    [
      "bad cached split",
      "gpt-5-nano-2025-08-07",
      { inputTokens: 1, cachedInputTokens: 1, cacheWriteTokens: 1, outputTokens: 0 },
    ],
  ])("fails closed for %s", (_case, model, usage) => {
    expect(() => estimateAiUsageMicroUsd({ model, usage })).toThrow(AiCostPolicyError);
  });
});
