import { describe, expect, it } from "vitest";

import {
  assertKioskEndToEndEnabled,
  assertKioskReviewWriteEnabled,
  isKioskEndToEndEnabled,
} from "./kiosk-review-gate";

describe("kiosk review production gate", () => {
  it("allows local verification without changing production state", () => {
    const mockContext = { hasSupabaseConfig: false, e2eAuthBypass: false };
    expect(isKioskEndToEndEnabled({ NODE_ENV: "test" }, mockContext)).toBe(true);
    expect(() => assertKioskEndToEndEnabled({ NODE_ENV: "test" }, mockContext)).not.toThrow();
    expect(() => assertKioskReviewWriteEnabled({ NODE_ENV: "test" }, mockContext)).not.toThrow();
  });

  it("fails closed for every production Kiosk collection entry until explicitly enabled", () => {
    const mockContext = { hasSupabaseConfig: false, e2eAuthBypass: false };
    expect(isKioskEndToEndEnabled({ NODE_ENV: "production" }, mockContext)).toBe(false);
    expect(() => assertKioskEndToEndEnabled({ NODE_ENV: "production" }, mockContext)).toThrow(
      "生产功能暂未启用",
    );
    expect(() =>
      assertKioskEndToEndEnabled(
        {
          VERCEL_ENV: "production",
          REPAIRDESK_KIOSK_PRODUCTION_ENABLED: "1",
          REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED: "1",
        },
        mockContext,
      ),
    ).not.toThrow();
  });

  it("requires explicit gates for every Supabase-backed runtime", () => {
    const linkedContext = { hasSupabaseConfig: true, e2eAuthBypass: false };
    expect(isKioskEndToEndEnabled({ NODE_ENV: "development" }, linkedContext)).toBe(false);
    expect(() => assertKioskEndToEndEnabled({ NODE_ENV: "development" }, linkedContext)).toThrow(
      "生产功能暂未启用",
    );
    expect(() =>
      assertKioskReviewWriteEnabled(
        {
          NODE_ENV: "development",
          REPAIRDESK_KIOSK_PRODUCTION_ENABLED: "1",
        },
        linkedContext,
      ),
    ).toThrow("收集与审核链路暂未启用");
    expect(
      isKioskEndToEndEnabled(
        {
          NODE_ENV: "development",
          REPAIRDESK_KIOSK_PRODUCTION_ENABLED: "1",
        },
        linkedContext,
      ),
    ).toBe(false);
    expect(() =>
      assertKioskReviewWriteEnabled(
        {
          NODE_ENV: "development",
          REPAIRDESK_KIOSK_PRODUCTION_ENABLED: "1",
          REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED: "1",
        },
        linkedContext,
      ),
    ).not.toThrow();
  });

  it("fails closed in production until the owner explicitly enables reviewed writes", () => {
    const linkedContext = { hasSupabaseConfig: true, e2eAuthBypass: false };
    expect(() => assertKioskReviewWriteEnabled({ NODE_ENV: "production" }, linkedContext)).toThrow(
      "生产功能暂未启用",
    );
    expect(() =>
      assertKioskReviewWriteEnabled(
        {
          VERCEL_ENV: "production",
          REPAIRDESK_KIOSK_PRODUCTION_ENABLED: "1",
          REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED: "1",
        },
        linkedContext,
      ),
    ).not.toThrow();
    expect(() =>
      assertKioskReviewWriteEnabled(
        {
          VERCEL_ENV: "production",
          REPAIRDESK_KIOSK_PRODUCTION_ENABLED: "1",
        },
        linkedContext,
      ),
    ).toThrow("收集与审核链路暂未启用");
  });
});
