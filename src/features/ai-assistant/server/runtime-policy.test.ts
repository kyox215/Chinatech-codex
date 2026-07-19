import { describe, expect, it } from "vitest";

import { AI_PRICING_VERSION } from "./cost-policy";
import {
  AI_DURABLE_QUOTA_BACKEND,
  AI_RUNTIME_POLICY_VERSION,
  assertAiLiveBudgetConfiguration,
  getAiModelRuntimePolicy,
} from "./runtime-policy";

const validLiveConfig = {
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_BUDGET_APPROVED: "1",
  AI_ASSISTANT_DURABLE_QUOTA_BACKEND: AI_DURABLE_QUOTA_BACKEND,
  AI_ASSISTANT_POLICY_VERSION: AI_RUNTIME_POLICY_VERSION,
  AI_ASSISTANT_PRICING_VERSION: AI_PRICING_VERSION,
  AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD: "50000000",
  AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY: "20",
  AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY: "10",
  AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY: "300",
  AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "30",
  AI_ASSISTANT_QUOTA_TIMEZONE: "Europe/Rome",
  AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET: "test-only-secret-with-at-least-32-characters",
  AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET:
    "test-only-fingerprint-secret-with-at-least-32-characters",
} as const;

describe("AI runtime policy", () => {
  it("pins exact low-cost models, deadlines and a single attempt", () => {
    expect(getAiModelRuntimePolicy("order_text")).toMatchObject({
      model: "gpt-5-nano-2025-08-07",
      maxOutputTokens: 256,
      reasoningEffort: "minimal",
      providerDeadlineMs: 8_000,
      maxAttempts: 1,
      fallbackEnabled: false,
    });
    expect(getAiModelRuntimePolicy("inventory_vision")).toMatchObject({
      model: "gpt-4o-mini-2024-07-18",
      imageDetail: "high",
      reasoningEffort: null,
      maxAttempts: 1,
    });
  });

  it("accepts only a complete, version-matched live budget configuration", () => {
    expect(() => assertAiLiveBudgetConfiguration(validLiveConfig)).not.toThrow();
    for (const key of Object.keys(validLiveConfig)) {
      expect(() => assertAiLiveBudgetConfiguration({ ...validLiveConfig, [key]: "" })).toThrow();
    }
  });
});
