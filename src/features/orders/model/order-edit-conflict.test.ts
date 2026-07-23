import { describe, expect, it } from "vitest";

import { hasOrderEditRemoteConflict } from "./order-edit-conflict";

describe("hasOrderEditRemoteConflict", () => {
  it("detects a newer server version during editing", () => {
    expect(
      hasOrderEditRemoteConflict({
        baselineUpdatedAt: "2026-07-23T10:00:00.000Z",
        currentUpdatedAt: "2026-07-23T10:00:30.000Z",
        hasLocalChanges: true,
        isEditing: true,
      }),
    ).toBe(true);
  });

  it("does not flag equal versions or a read-only view", () => {
    expect(
      hasOrderEditRemoteConflict({
        baselineUpdatedAt: "2026-07-23T10:00:00.000Z",
        currentUpdatedAt: "2026-07-23T10:00:00.000Z",
        hasLocalChanges: true,
        isEditing: true,
      }),
    ).toBe(false);
    expect(
      hasOrderEditRemoteConflict({
        baselineUpdatedAt: "2026-07-23T10:00:00.000Z",
        currentUpdatedAt: "2026-07-23T10:00:30.000Z",
        hasLocalChanges: true,
        isEditing: false,
      }),
    ).toBe(false);
  });

  it("keeps a clean editor eligible for automatic rebasing", () => {
    expect(
      hasOrderEditRemoteConflict({
        baselineUpdatedAt: "2026-07-23T10:00:00.000Z",
        currentUpdatedAt: "2026-07-23T10:00:30.000Z",
        hasLocalChanges: false,
        isEditing: true,
      }),
    ).toBe(false);
  });
});
