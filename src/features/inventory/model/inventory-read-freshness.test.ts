import { describe, expect, it } from "vitest";

import {
  inventoryReadFreshnessBlocksWrites,
  resolveInventoryReadFreshness,
} from "./inventory-read-freshness";

describe("resolveInventoryReadFreshness", () => {
  it("hides a fresh or missing-data state", () => {
    const fresh = resolveInventoryReadFreshness({
      hasData: true,
      keyMatches: true,
      queryState: "success",
      lastSuccessAt: 100,
    });
    expect(fresh).toMatchObject({ state: "fresh", hidden: true, lastSuccessAt: 100 });
    expect(
      resolveInventoryReadFreshness({ hasData: false, keyMatches: true, queryState: "error" }),
    ).toMatchObject({ state: "fresh", hidden: true });
  });

  it("marks cached data plus query error stale and blocks writes", () => {
    const stale = resolveInventoryReadFreshness({
      hasData: true,
      keyMatches: true,
      queryState: "error",
      lastSuccessAt: 100,
    });
    expect(stale.state).toBe("stale");
    expect(inventoryReadFreshnessBlocksWrites(stale)).toBe(true);
  });

  it("models verifying, failed, recovered, and privacy states explicitly", () => {
    const base = { hasData: true, keyMatches: true, queryState: "success" as const };
    expect(resolveInventoryReadFreshness({ ...base, verification: "verifying" }).state).toBe(
      "verifying",
    );
    expect(resolveInventoryReadFreshness({ ...base, verification: "failed" }).state).toBe(
      "verify-failed",
    );
    expect(resolveInventoryReadFreshness({ ...base, verification: "recovered" }).state).toBe(
      "recovered",
    );
    expect(resolveInventoryReadFreshness({ ...base, privacyRedacted: true }).state).toBe(
      "privacy-redacted",
    );
    expect(
      inventoryReadFreshnessBlocksWrites(
        resolveInventoryReadFreshness({ ...base, verification: "recovered" }),
      ),
    ).toBe(false);
  });

  it("does not reuse a snapshot for another key or while post-commit sync owns the state", () => {
    expect(
      resolveInventoryReadFreshness({
        hasData: true,
        keyMatches: false,
        queryState: "error",
        lastSuccessAt: 100,
      }).hidden,
    ).toBe(true);
    expect(
      resolveInventoryReadFreshness({
        hasData: true,
        keyMatches: true,
        queryState: "error",
        suppressStaleGuard: true,
      }).hidden,
    ).toBe(true);
  });
});
