import { describe, expect, it } from "vitest";

import { allowsPendingStore } from "./repairdesk-router";

describe("repairdesk router pending-store access", () => {
  it("allows only POST stores/create under stores", () => {
    expect(allowsPendingStore("stores/create", "POST")).toBe(true);
    expect(allowsPendingStore("stores/create", "GET")).toBe(false);
    expect(allowsPendingStore("stores/context", "GET")).toBe(false);
    expect(allowsPendingStore("stores/members", "GET")).toBe(false);
    expect(allowsPendingStore("stores/members/update-role", "POST")).toBe(false);
    expect(allowsPendingStore("stores/members/disable", "POST")).toBe(false);
    expect(allowsPendingStore("stores/members/restore", "POST")).toBe(false);
    expect(allowsPendingStore("stores/access-requests", "GET")).toBe(false);
    expect(allowsPendingStore("stores/switch", "POST")).toBe(false);
  });

  it("does not allow public store discovery endpoints before active store", () => {
    for (const path of [
      "stores/list",
      "stores/search",
      "stores/context",
      "stores/members",
      "stores/access-requests",
      "onboarding/stores",
    ]) {
      expect(allowsPendingStore(path, "GET")).toBe(false);
      expect(allowsPendingStore(path, "POST")).toBe(false);
    }
  });

  it("uses an exact allowlist for setup endpoints before active store", () => {
    expect(allowsPendingStore("onboarding/status", "GET")).toBe(true);
    expect(allowsPendingStore("onboarding/request", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/request/cancel", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/invitations/accept", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/invite-links/redeem", "POST")).toBe(true);
    expect(allowsPendingStore("stores/invite-links/create", "POST")).toBe(false);
    expect(allowsPendingStore("stores/invite-links/revoke", "POST")).toBe(false);
    expect(allowsPendingStore("platform/onboarding/requests", "GET")).toBe(true);
    expect(allowsPendingStore("platform/onboarding/approve", "POST")).toBe(true);
    expect(allowsPendingStore("platform/onboarding/reject", "POST")).toBe(true);
    expect(allowsPendingStore("account/profile/update", "POST")).toBe(true);
    expect(allowsPendingStore("onboarding/anything-else", "GET")).toBe(false);
    expect(allowsPendingStore("platform/orders", "GET")).toBe(false);
    expect(allowsPendingStore("account/anything-else", "POST")).toBe(false);
  });
});
