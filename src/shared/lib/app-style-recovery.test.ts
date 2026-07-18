import { describe, expect, it } from "vitest";

import {
  getRepairDeskStyleRecoveryDecision,
  parseRepairDeskStyleReloadedAt,
  repairDeskStyleReloadCooldownMs,
} from "./app-style-recovery";

describe("RepairDesk app style recovery", () => {
  it("keeps the application visible when the global stylesheet marker is present", () => {
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: true,
        lastReloadedAt: null,
        now: 10_000,
      }),
    ).toBe("ready");
  });

  it("requests one recovery reload when styles are missing", () => {
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        lastReloadedAt: null,
        now: 10_000,
      }),
    ).toBe("reload");
  });

  it("prevents a reload loop while the recovery cooldown is active", () => {
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        lastReloadedAt: 10_000,
        now: 10_000 + repairDeskStyleReloadCooldownMs - 1,
      }),
    ).toBe("wait");
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        lastReloadedAt: 10_000,
        now: 10_000 + repairDeskStyleReloadCooldownMs,
      }),
    ).toBe("reload");
  });

  it("ignores malformed recovery timestamps", () => {
    expect(parseRepairDeskStyleReloadedAt(null)).toBeNull();
    expect(parseRepairDeskStyleReloadedAt("not-a-time")).toBeNull();
    expect(parseRepairDeskStyleReloadedAt("-1")).toBeNull();
    expect(parseRepairDeskStyleReloadedAt("1234")).toBe(1234);
  });
});
