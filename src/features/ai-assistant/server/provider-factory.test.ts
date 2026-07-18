import { describe, expect, it } from "vitest";

import { AiServiceError } from "./errors";
import { getAiAssistantProvider } from "./provider-factory";

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

  it("still fails closed after configuration gates until the live dependency is approved", () => {
    expect(() =>
      getAiAssistantProvider({
        AI_ASSISTANT_PROVIDER: "openai",
        AI_ASSISTANT_EXTERNAL_DATA_APPROVED: "1",
        AI_ASSISTANT_BUDGET_APPROVED: "1",
        AI_ASSISTANT_REQUESTS_PER_STORE_DAY: "10",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AiServiceError>>({
        code: "AI_MISCONFIGURED",
        status: 503,
      }),
    );
  });
});
