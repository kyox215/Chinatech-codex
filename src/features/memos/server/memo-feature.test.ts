import { afterEach, describe, expect, it, vi } from "vitest";

import { assertMemosFeature, isMemosEnabledForStore } from "./memo-feature";

afterEach(() => vi.unstubAllEnvs());

describe("memo rollout", () => {
  it("requires the master flag and an exact store allowlist match", () => {
    expect(
      isMemosEnabledForStore("store-a", {
        REPAIRDESK_MEMOS_ENABLED: "1",
        REPAIRDESK_MEMOS_STORE_ALLOWLIST: "store-a,store-b",
      }),
    ).toBe(true);
    expect(
      isMemosEnabledForStore("store", {
        REPAIRDESK_MEMOS_ENABLED: "1",
        REPAIRDESK_MEMOS_STORE_ALLOWLIST: "store-a",
      }),
    ).toBe(false);
    expect(
      isMemosEnabledForStore("store-a", {
        REPAIRDESK_MEMOS_ENABLED: "1",
        REPAIRDESK_MEMOS_STORE_ALLOWLIST: "*",
      }),
    ).toBe(false);
    expect(
      isMemosEnabledForStore("store-a", {
        REPAIRDESK_MEMOS_ENABLED: "0",
        REPAIRDESK_MEMOS_STORE_ALLOWLIST: "store-a",
      }),
    ).toBe(false);
  });

  it("does not bypass the rollout flag in test mode", () => {
    vi.stubEnv("REPAIRDESK_MEMOS_ENABLED", "0");
    vi.stubEnv("REPAIRDESK_MEMOS_STORE_ALLOWLIST", "store-a");
    expect(() =>
      assertMemosFeature({
        id: "user-a",
        displayName: "Owner",
        storeId: "store-a",
        activeMembershipId: "member-a",
        storeRole: "owner",
      }),
    ).toThrow("尚未");
  });
});
