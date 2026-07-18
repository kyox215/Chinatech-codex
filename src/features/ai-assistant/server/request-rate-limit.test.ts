import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";
import {
  consumeAiAssistantRequestRateLimit,
  resetAiAssistantLocalRateLimitForTests,
} from "./request-rate-limit";

const actor: AuditActor = {
  id: "staff-1",
  displayName: "Staff",
  storeId: "store-1",
};

describe("AI assistant request abuse guard", () => {
  beforeEach(resetAiAssistantLocalRateLimitForTests);
  afterEach(() => vi.unstubAllEnvs());

  it("limits every actor/store independently in a short window", () => {
    const env = { AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "1" };
    const now = () => new Date("2026-07-18T12:00:15.000Z");

    expect(consumeAiAssistantRequestRateLimit({ actor, env, now })).toEqual({ remaining: 0 });
    expect(() => consumeAiAssistantRequestRateLimit({ actor, env, now })).toThrowError(
      expect.objectContaining({ code: "AI_RATE_LIMITED", status: 429 }),
    );
    expect(
      consumeAiAssistantRequestRateLimit({
        actor: { ...actor, id: "staff-2" },
        env,
        now,
      }),
    ).toEqual({ remaining: 0 });
  });

  it("uses a bounded safe default when configuration is absent or invalid", () => {
    const now = () => new Date("2026-07-18T12:00:15.000Z");
    expect(consumeAiAssistantRequestRateLimit({ actor, env: {}, now })).toEqual({ remaining: 29 });
    resetAiAssistantLocalRateLimitForTests();
    expect(
      consumeAiAssistantRequestRateLimit({
        actor,
        env: { AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "0" },
        now,
      }),
    ).toEqual({ remaining: 29 });
  });

  it("supports only the explicit non-production E2E system actor", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");
    const now = () => new Date("2026-07-18T12:00:15.000Z");

    expect(
      consumeAiAssistantRequestRateLimit({
        actor: { displayName: "System", isSystem: true },
        env: { AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "1" },
        now,
      }),
    ).toEqual({ remaining: 0 });
    expect(() =>
      consumeAiAssistantRequestRateLimit({
        actor: { displayName: "System", isSystem: true },
        env: { AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE: "1" },
        now,
      }),
    ).toThrowError(expect.objectContaining({ code: "AI_RATE_LIMITED", status: 429 }));
  });

  it("rejects identifierless system actors outside the guarded E2E bypass", () => {
    expect(() =>
      consumeAiAssistantRequestRateLimit({
        actor: { displayName: "System", isSystem: true },
        env: {},
      }),
    ).toThrowError(expect.objectContaining({ code: "AI_NOT_AUTHORIZED", status: 403 }));

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");
    expect(() =>
      consumeAiAssistantRequestRateLimit({
        actor: { displayName: "System", isSystem: true },
        env: {},
      }),
    ).toThrowError(expect.objectContaining({ code: "AI_NOT_AUTHORIZED", status: 403 }));
  });
});
