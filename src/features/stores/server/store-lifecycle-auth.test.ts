import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth-context";

import { assertRecentLifecycleAal2 } from "./store-lifecycle-auth";

const now = Date.parse("2026-07-17T20:00:00.000Z");

describe("store lifecycle recent authentication", () => {
  it("accepts a recent AAL2 session", () => {
    expect(
      assertRecentLifecycleAal2(
        {
          id: "actor",
          displayName: "Owner",
          authAssuranceLevel: "aal2",
          recentAuthAt: "2026-07-17T19:56:00.000Z",
        },
        now,
      ),
    ).toEqual({ assuranceLevel: "aal2", authenticatedAt: "2026-07-17T19:56:00.000Z" });
  });

  it("rejects AAL1 and stale AAL2 sessions", () => {
    expect(() =>
      assertRecentLifecycleAal2({ displayName: "Owner", authAssuranceLevel: "aal1" }, now),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertRecentLifecycleAal2(
        {
          displayName: "Owner",
          authAssuranceLevel: "aal2",
          recentAuthAt: "2026-07-17T19:54:59.000Z",
        },
        now,
      ),
    ).toThrow("超过 5 分钟");
  });
});
