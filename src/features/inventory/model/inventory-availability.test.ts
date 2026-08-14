import { describe, expect, it } from "vitest";

import { resolveInventoryAvailability } from "./inventory-availability";

describe("resolveInventoryAvailability", () => {
  it("prioritizes shell loading, access gates, and retrying", () => {
    expect(
      resolveInventoryAvailability({
        shellLoading: true,
        hasPermission: false,
        featureEnabled: false,
        queryState: "idle",
        hasData: false,
      }),
    ).toMatchObject({ state: "loading", retryable: false });
    expect(
      resolveInventoryAvailability({
        shellLoading: false,
        hasPermission: false,
        featureEnabled: true,
        queryState: "loading",
        hasData: false,
      }),
    ).toMatchObject({ state: "no-permission", retryable: false });
    expect(
      resolveInventoryAvailability({
        hasPermission: true,
        featureEnabled: true,
        queryState: "loading",
        hasData: false,
        isRetrying: true,
      }),
    ).toMatchObject({ state: "retrying", retryable: true });
  });

  it("keeps no-permission and feature-off separate and non-retryable", () => {
    expect(
      resolveInventoryAvailability({
        hasPermission: false,
        featureEnabled: true,
        queryState: "idle",
        hasData: false,
      }),
    ).toMatchObject({ state: "no-permission", retryable: false });
    expect(
      resolveInventoryAvailability({
        hasPermission: true,
        featureEnabled: false,
        queryState: "idle",
        hasData: false,
      }),
    ).toMatchObject({ state: "feature-off", retryable: false });
  });

  it("maps structured errors without reading localized messages", () => {
    expect(
      resolveInventoryAvailability({
        hasPermission: true,
        featureEnabled: true,
        queryState: "error",
        hasData: false,
        error: { status: 404, code: "record_not_found", message: "private" },
      }),
    ).toMatchObject({ state: "not-found-or-hidden", retryable: false });
    expect(
      resolveInventoryAvailability({
        hasPermission: true,
        featureEnabled: true,
        queryState: "error",
        hasData: false,
        error: { status: 503, code: "backend_down", message: "private" },
      }),
    ).toMatchObject({ state: "service-unavailable", retryable: true });
  });

  it("returns available for cached data or successful reads, leaving freshness to M4H", () => {
    expect(
      resolveInventoryAvailability({
        hasPermission: true,
        featureEnabled: true,
        queryState: "error",
        hasData: true,
        error: { status: 503 },
      }),
    ).toMatchObject({ state: "available", retryable: false });
    expect(
      resolveInventoryAvailability({
        hasPermission: true,
        featureEnabled: true,
        queryState: "success",
        hasData: false,
      }),
    ).toMatchObject({ state: "available", retryable: false });
  });
});
