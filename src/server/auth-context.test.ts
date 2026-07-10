import { describe, expect, it } from "vitest";

import { isVerifiedEmailAuthUser, isVerifiedEmailClaim } from "./auth-context";

describe("auth email verification evidence", () => {
  it("does not trust user-controlled metadata in claims", () => {
    expect(
      isVerifiedEmailClaim({
        user_metadata: { email_verified: true },
      }),
    ).toBe(false);
  });

  it("accepts canonical claim confirmation and server-controlled app metadata", () => {
    expect(isVerifiedEmailClaim({ email_verified: true })).toBe(true);
    expect(isVerifiedEmailClaim({ email_confirmed_at: "2026-07-10T12:00:00.000Z" })).toBe(true);
    expect(isVerifiedEmailClaim({ app_metadata: { email_verified: true } })).toBe(true);
  });

  it("does not trust user-controlled metadata returned by the admin user lookup", () => {
    expect(
      isVerifiedEmailAuthUser({
        user_metadata: { email_verified: true },
        app_metadata: {},
      }),
    ).toBe(false);
  });

  it("accepts canonical email confirmation and server-controlled metadata", () => {
    expect(isVerifiedEmailAuthUser({ email_confirmed_at: "2026-07-10T12:00:00.000Z" })).toBe(true);
    expect(isVerifiedEmailAuthUser({ app_metadata: { email_verified: true } })).toBe(true);
  });

  it("does not treat a generic confirmation timestamp as email confirmation", () => {
    expect(
      isVerifiedEmailAuthUser({
        confirmed_at: "2026-07-10T12:00:00.000Z",
      }),
    ).toBe(false);
  });
});
