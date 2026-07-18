import { describe, expect, it } from "vitest";

import { resolveAuthAssuranceFromClaims } from "./auth-context";

describe("auth assurance projection", () => {
  it("keeps the latest AMR timestamp for a recent AAL2 lifecycle challenge", () => {
    expect(
      resolveAuthAssuranceFromClaims({
        aal: "aal2",
        iat: 100,
        amr: [
          { method: "password", timestamp: 90 },
          { method: "totp", timestamp: 120 },
        ],
      }),
    ).toEqual({
      authAssuranceLevel: "aal2",
      recentAuthAt: "1970-01-01T00:02:00.000Z",
    });
  });

  it("does not treat a newer token issue or password event as recent TOTP", () => {
    expect(
      resolveAuthAssuranceFromClaims({
        aal: "aal2",
        iat: 500,
        amr: [
          { method: "totp", timestamp: 120 },
          { method: "password", timestamp: 450 },
        ],
      }),
    ).toEqual({
      authAssuranceLevel: "aal2",
      recentAuthAt: "1970-01-01T00:02:00.000Z",
    });
  });

  it("fails closed when an AAL2 claim has no TOTP authentication event", () => {
    expect(
      resolveAuthAssuranceFromClaims({
        aal: "aal2",
        iat: 500,
        amr: [{ method: "password", timestamp: 450 }],
      }),
    ).toEqual({ authAssuranceLevel: "aal2" });
  });

  it("defaults unknown assurance to AAL1 without inventing a timestamp", () => {
    expect(resolveAuthAssuranceFromClaims({})).toEqual({ authAssuranceLevel: "aal1" });
  });
});
