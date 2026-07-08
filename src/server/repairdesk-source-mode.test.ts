import { describe, expect, it } from "vitest";

import {
  assertRepairDeskBrowserAuthMode,
  resolveRepairDeskSourceMode,
} from "@/server/repairdesk-source-mode";

describe("RepairDesk source mode", () => {
  it("uses Supabase only when service config is present and E2E bypass is disabled", () => {
    expect(
      resolveRepairDeskSourceMode({
        hasSupabaseConfig: true,
        e2eAuthBypass: false,
        env: { NODE_ENV: "production", VERCEL_ENV: "production" },
      }),
    ).toBe("supabase");
  });

  it("allows mock mode in local development only", () => {
    expect(
      resolveRepairDeskSourceMode({
        hasSupabaseConfig: false,
        e2eAuthBypass: false,
        env: { NODE_ENV: "development" },
      }),
    ).toBe("mock");
  });

  it("fails closed when production is missing Supabase config", () => {
    expect(() =>
      resolveRepairDeskSourceMode({
        hasSupabaseConfig: false,
        e2eAuthBypass: false,
        env: { NODE_ENV: "production" },
      }),
    ).toThrow("requires Supabase config");
  });

  it("fails closed when production has E2E bypass enabled", () => {
    expect(() =>
      resolveRepairDeskSourceMode({
        hasSupabaseConfig: true,
        e2eAuthBypass: true,
        env: { VERCEL_ENV: "production" },
      }),
    ).toThrow("forbids E2E auth bypass");
  });

  it("fails closed when production browser auth config is missing", () => {
    expect(() =>
      assertRepairDeskBrowserAuthMode({
        hasBrowserAuthConfig: false,
        env: { NODE_ENV: "production" },
      }),
    ).toThrow("requires Supabase browser auth config");
  });
});
