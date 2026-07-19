import { describe, expect, it } from "vitest";

import {
  assertOpenAiExternalCallsApproved,
  getAiAssistantApiBaseUrl,
  getAiAssistantModel,
  getAiAssistantProviderName,
  isAiAssistantEnabled,
  isAiAssistantStoreEnabled,
  isAiDraftApplyEnabled,
  isAiOrderReadToolsEnabled,
  isAiPublicCustomerAssistantEnabled,
  isAiVisionIntakeEnabled,
} from "./feature-flags";
import { AI_PRICING_VERSION } from "./cost-policy";
import { AI_DURABLE_QUOTA_BACKEND, AI_RUNTIME_POLICY_VERSION } from "./runtime-policy";

const completeLiveBudgetConfig = {
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
} as const;

describe("AI assistant feature flags", () => {
  it("fails closed for every capability", () => {
    expect(isAiAssistantEnabled({})).toBe(false);
    expect(isAiOrderReadToolsEnabled({ AI_ORDER_READ_TOOLS_ENABLED: "1" })).toBe(false);
    expect(isAiVisionIntakeEnabled({ AI_VISION_INTAKE_ENABLED: "1" })).toBe(false);
    expect(isAiDraftApplyEnabled({ AI_DRAFT_APPLY_ENABLED: "1" })).toBe(false);
    expect(isAiPublicCustomerAssistantEnabled({ AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED: "1" })).toBe(
      false,
    );
    expect(() => getAiAssistantProviderName({ AI_ASSISTANT_PROVIDER: "anything" })).toThrow(
      "provider",
    );
    expect(getAiAssistantModel("order_text", {})).toBe("fake-ai-assistant-v1");
    expect(() => getAiAssistantModel("order_text", { AI_ASSISTANT_PROVIDER: "openai" })).toThrow(
      "模型",
    );
  });

  it("requires parent flags before child capabilities", () => {
    const enabled = { AI_ASSISTANT_ENABLED: "1" };
    expect(isAiOrderReadToolsEnabled({ ...enabled, AI_ORDER_READ_TOOLS_ENABLED: "1" })).toBe(true);
    expect(isAiVisionIntakeEnabled({ ...enabled, AI_VISION_INTAKE_ENABLED: "1" })).toBe(true);
    expect(
      isAiDraftApplyEnabled({
        ...enabled,
        AI_VISION_INTAKE_ENABLED: "1",
        AI_DRAFT_APPLY_ENABLED: "1",
      }),
    ).toBe(true);
  });

  it("blocks OpenAI until both privacy and budget gates are explicit", () => {
    expect(() => assertOpenAiExternalCallsApproved({ AI_ASSISTANT_PROVIDER: "openai" })).toThrow(
      "外部数据处理",
    );
    expect(() =>
      assertOpenAiExternalCallsApproved({
        AI_ASSISTANT_PROVIDER: "openai",
        AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
      }),
    ).toThrow("预算");
    expect(() =>
      assertOpenAiExternalCallsApproved({
        AI_ASSISTANT_PROVIDER: "openai",
        AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
        AI_ASSISTANT_BUDGET_APPROVED: "1",
        AI_ASSISTANT_REQUESTS_PER_STORE_DAY: "50",
      }),
    ).toThrow("durable quota");
    expect(() => assertOpenAiExternalCallsApproved(completeLiveBudgetConfig)).not.toThrow();
    expect(() =>
      assertOpenAiExternalCallsApproved({
        ...completeLiveBudgetConfig,
        OPENAI_API_KEY: completeLiveBudgetConfig.AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET,
      }),
    ).toThrow(/相互独立/);
  });

  it("only permits official HTTPS API hosts", () => {
    expect(getAiAssistantApiBaseUrl({})).toBe("https://api.openai.com/v1");
    expect(getAiAssistantApiBaseUrl({ OPENAI_API_BASE_URL: "https://eu.api.openai.com/v1/" })).toBe(
      "https://eu.api.openai.com/v1",
    );
    expect(() =>
      getAiAssistantApiBaseUrl({ OPENAI_API_BASE_URL: "https://example.com/v1" }),
    ).toThrow("允许列表");
  });

  it("requires an explicit exact store allowlist entry", () => {
    const env = {
      AI_ASSISTANT_ENABLED: "1",
      AI_ASSISTANT_STORE_ALLOWLIST: "store-1, store-2",
    };
    expect(isAiAssistantStoreEnabled("store-1", env)).toBe(true);
    expect(isAiAssistantStoreEnabled("store-3", env)).toBe(false);
    expect(isAiAssistantStoreEnabled("store-1", { AI_ASSISTANT_ENABLED: "1" })).toBe(false);
    expect(isAiAssistantStoreEnabled("store-1", { ...env, AI_ASSISTANT_ENABLED: "0" })).toBe(false);
  });
});
