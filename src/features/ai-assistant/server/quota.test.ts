import { beforeEach, describe, expect, it } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";
import { consumeAiAssistantRequestQuota, resetAiAssistantLocalQuotaForTests } from "./quota";

const actor: AuditActor = {
  id: "staff-1",
  displayName: "Staff",
  storeId: "store-1",
};

describe("AI assistant local quota guard", () => {
  beforeEach(resetAiAssistantLocalQuotaForTests);

  it("enforces the configured request count independently per store and UTC day", () => {
    const env = { AI_ASSISTANT_REQUESTS_PER_STORE_DAY: "1" };
    const dayOne = () => new Date("2026-07-18T12:00:00.000Z");

    expect(consumeAiAssistantRequestQuota({ actor, env, now: dayOne })).toEqual({
      limited: true,
      remaining: 0,
    });
    expect(() => consumeAiAssistantRequestQuota({ actor, env, now: dayOne })).toThrowError(
      expect.objectContaining({ code: "AI_QUOTA_EXHAUSTED", status: 429 }),
    );
    expect(
      consumeAiAssistantRequestQuota({
        actor: { ...actor, storeId: "store-2" },
        env,
        now: dayOne,
      }),
    ).toEqual({ limited: true, remaining: 0 });
    expect(
      consumeAiAssistantRequestQuota({
        actor,
        env,
        now: () => new Date("2026-07-19T00:00:00.000Z"),
      }),
    ).toEqual({ limited: true, remaining: 0 });
  });

  it("does not impose an implicit limit when no budget limit is configured", () => {
    expect(consumeAiAssistantRequestQuota({ actor, env: {} })).toEqual({ limited: false });
  });
});
