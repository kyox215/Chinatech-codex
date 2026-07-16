import { describe, expect, it } from "vitest";

import { statusGroups } from "./enums";

describe("repair order status groups", () => {
  it("keeps arrived and repaired workflow states in the in-progress business category", () => {
    expect(statusGroups.in_progress).toEqual(
      expect.arrayContaining(["parts_arrived", "repaired", "notified"]),
    );
    expect(statusGroups.in_progress).not.toContain("completed");
    expect(statusGroups.in_progress).not.toContain("cancelled");
  });

  it("keeps ready repairs visible in both active and pickup-focused views", () => {
    expect(statusGroups.awaiting_pickup).toEqual(
      expect.arrayContaining(["repaired", "notified", "waiting_pickup", "unfixed_pickup"]),
    );
  });
});
