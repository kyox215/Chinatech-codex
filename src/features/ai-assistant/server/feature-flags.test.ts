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

describe("AI assistant feature flags", () => {
  it("fails closed for every capability", () => {
    expect(isAiAssistantEnabled({})).toBe(false);
    expect(isAiOrderReadToolsEnabled({ AI_ORDER_READ_TOOLS_ENABLED: "1" })).toBe(false);
    expect(isAiVisionIntakeEnabled({ AI_VISION_INTAKE_ENABLED: "1" })).toBe(false);
    expect(isAiDraftApplyEnabled({ AI_DRAFT_APPLY_ENABLED: "1" })).toBe(false);
    expect(isAiPublicCustomerAssistantEnabled({ AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED: "1" })).toBe(
      false,
    );
    expect(getAiAssistantProviderName({ AI_ASSISTANT_PROVIDER: "anything" })).toBe("fake");
    expect(getAiAssistantModel({})).toBe("fake-ai-assistant-v1");
    expect(() => getAiAssistantModel({ AI_ASSISTANT_PROVIDER: "openai" })).toThrow("模型");
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
    ).not.toThrow();
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
