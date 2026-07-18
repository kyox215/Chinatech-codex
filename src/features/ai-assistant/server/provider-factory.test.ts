import { describe, expect, it } from "vitest";

import { AiServiceError } from "./errors";
import { getAiAssistantProvider } from "./provider-factory";
import { AI_PRICING_VERSION } from "./cost-policy";
import { AI_DURABLE_QUOTA_BACKEND, AI_RUNTIME_POLICY_VERSION } from "./runtime-policy";

describe("AI assistant provider factory", () => {
  it("uses the deterministic fake provider by default", () => {
    expect(getAiAssistantProvider({}).name).toBe("fake");
  });

  it("fails closed when live external processing gates are incomplete", () => {
    expect(() =>
      getAiAssistantProvider({
        AI_ASSISTANT_PROVIDER: "openai",
        AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AiServiceError>>({
        code: "AI_MISCONFIGURED",
        status: 503,
      }),
    );
  });

  it("constructs the live provider only after every exact configuration gate passes", () => {
    expect(
      getAiAssistantProvider({
        AI_ASSISTANT_PROVIDER: "openai",
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
        OPENAI_API_KEY: "test-only-openai-key-not-a-real-secret",
        OPENAI_AI_ASSISTANT_ORDER_MODEL: "gpt-5-nano-2025-08-07",
        OPENAI_AI_ASSISTANT_VISION_MODEL: "gpt-4o-mini-2024-07-18",
      }),
    ).toEqual(expect.objectContaining({ name: "openai" }));
  });
});
