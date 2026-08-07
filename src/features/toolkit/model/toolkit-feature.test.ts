import { describe, expect, it } from "vitest";

import { isRepairDeskToolkitEnabled } from "./toolkit-feature";

describe("toolkit feature flag", () => {
  it("stays fail-closed unless explicitly enabled", () => {
    expect(isRepairDeskToolkitEnabled(undefined)).toBe(false);
    expect(isRepairDeskToolkitEnabled("0")).toBe(false);
    expect(isRepairDeskToolkitEnabled("true")).toBe(false);
    expect(isRepairDeskToolkitEnabled("1")).toBe(true);
  });
});
