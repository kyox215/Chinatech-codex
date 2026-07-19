import { describe, expect, it } from "vitest";

import type { AiAssistantFeatureEnvironment } from "./feature-flags";
import { AI_CHINATECH_PILOT_STORE_ID } from "./feature-flags";
import { assertAiProviderEgressAllowed } from "./egress-policy";

const liveTextEnv = {
  AI_ASSISTANT_PROVIDER: "openai",
  AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
  AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED: "1",
} as const satisfies AiAssistantFeatureEnvironment;

describe("AI provider egress policy", () => {
  it("allows only explicitly approved non-sensitive order text", () => {
    expect(() =>
      assertAiProviderEgressAllowed({
        requestKind: "order_text",
        env: liveTextEnv,
        orderMessage: "Show active unpaid repairs from this week",
      }),
    ).not.toThrow();

    for (const orderMessage of [
      "Find user@example.com",
      "Show phone +39 333 123 4567",
      "Find IMEI 867207081030689",
      "Show R202600123",
      "Find Mario's orders",
      'Search for "Mario Rossi"',
    ]) {
      expect(() =>
        assertAiProviderEgressAllowed({
          requestKind: "order_text",
          env: liveTextEnv,
          orderMessage,
        }),
      ).toThrow(expect.objectContaining({ code: "AI_SENSITIVE_INPUT", status: 400 }));
    }
  });

  it("fails closed unless both the global and request-kind approvals exist", () => {
    for (const env of [
      { AI_ASSISTANT_PROVIDER: "openai" },
      {
        AI_ASSISTANT_PROVIDER: "openai",
        AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
      },
    ] satisfies AiAssistantFeatureEnvironment[]) {
      expect(() =>
        assertAiProviderEgressAllowed({
          requestKind: "order_text",
          env,
          orderMessage: "Show active repairs",
        }),
      ).toThrow(expect.objectContaining({ code: "AI_MISCONFIGURED", status: 503 }));
    }
  });

  it("requires an independent vision approval", () => {
    expect(() =>
      assertAiProviderEgressAllowed({
        requestKind: "inventory_vision",
        env: liveTextEnv,
      }),
    ).toThrow(expect.objectContaining({ code: "AI_MISCONFIGURED" }));

    expect(() =>
      assertAiProviderEgressAllowed({
        requestKind: "inventory_vision",
        env: {
          AI_ASSISTANT_PROVIDER: "openai",
          AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
          AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED: "1",
          AI_ASSISTANT_STORE_ALLOWLIST: AI_CHINATECH_PILOT_STORE_ID,
        },
        storeId: AI_CHINATECH_PILOT_STORE_ID,
      }),
    ).not.toThrow();

    expect(() =>
      assertAiProviderEgressAllowed({
        requestKind: "inventory_vision",
        env: {
          AI_ASSISTANT_PROVIDER: "openai",
          AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
          AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED: "1",
          AI_ASSISTANT_STORE_ALLOWLIST: `${AI_CHINATECH_PILOT_STORE_ID},other-store`,
        },
        storeId: AI_CHINATECH_PILOT_STORE_ID,
      }),
    ).toThrow(expect.objectContaining({ code: "AI_MISCONFIGURED" }));
  });
});
