import { describe, expect, it } from "vitest";

import { isRepairDeskOfflineSyncEnabled } from "./offline-sync-feature";

describe("offline sync release flag", () => {
  it("fails closed unless explicitly enabled", () => {
    expect(isRepairDeskOfflineSyncEnabled(undefined)).toBe(false);
    expect(isRepairDeskOfflineSyncEnabled("0")).toBe(false);
    expect(isRepairDeskOfflineSyncEnabled("true")).toBe(false);
    expect(isRepairDeskOfflineSyncEnabled("1")).toBe(true);
  });
});
