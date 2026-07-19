import { describe, expect, it } from "vitest";

import {
  getNextRepairDeskStyleReloadState,
  getRepairDeskStyleRecoveryDecision,
  parseRepairDeskStyleReloadedAt,
  parseRepairDeskStyleReloadState,
  repairDeskStyleMaxAutoReloads,
  repairDeskStyleReloadWindowMs,
} from "./app-style-recovery";

describe("RepairDesk app style recovery", () => {
  it("keeps the application visible when the global stylesheet marker is present", () => {
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: true,
        reloadState: null,
        now: 10_000,
      }),
    ).toBe("ready");
  });

  it("requests one recovery reload when styles are missing", () => {
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        reloadState: null,
        now: 10_000,
      }),
    ).toBe("reload");
  });

  it("stops automatic reloads after the per-window limit", () => {
    const reloadState = {
      version: 2 as const,
      windowStartedAt: 10_000,
      autoReloadCount: repairDeskStyleMaxAutoReloads,
      lastAutoReloadAt: 10_000,
    };
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        reloadState,
        now: 10_000 + repairDeskStyleReloadWindowMs - 1,
      }),
    ).toBe("wait");
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        reloadState,
        now: 10_000 + repairDeskStyleReloadWindowMs,
      }),
    ).toBe("reload");
  });

  it("allows at most one storage-free reload and then falls back to manual recovery", () => {
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        reloadState: null,
        storageAvailable: false,
        navigationWasReloaded: false,
      }),
    ).toBe("reload");
    expect(
      getRepairDeskStyleRecoveryDecision({
        stylesReady: false,
        reloadState: null,
        storageAvailable: false,
        navigationWasReloaded: true,
      }),
    ).toBe("wait");
  });

  it("ignores malformed recovery timestamps", () => {
    expect(parseRepairDeskStyleReloadedAt(null)).toBeNull();
    expect(parseRepairDeskStyleReloadedAt("not-a-time")).toBeNull();
    expect(parseRepairDeskStyleReloadedAt("-1")).toBeNull();
    expect(parseRepairDeskStyleReloadedAt("1234")).toBe(1234);
  });

  it("parses only valid structured reload state", () => {
    const state = {
      version: 2 as const,
      windowStartedAt: 1_000,
      autoReloadCount: 1,
      lastAutoReloadAt: 1_500,
    };
    expect(parseRepairDeskStyleReloadState(JSON.stringify(state))).toEqual(state);
    expect(parseRepairDeskStyleReloadState(null)).toBeNull();
    expect(parseRepairDeskStyleReloadState("not-json")).toBeNull();
    expect(
      parseRepairDeskStyleReloadState(JSON.stringify({ ...state, autoReloadCount: -1 })),
    ).toBeNull();
  });

  it("records one attempt and resets an expired or future reload window", () => {
    expect(getNextRepairDeskStyleReloadState({ reloadState: null, now: 5_000 })).toEqual({
      version: 2,
      windowStartedAt: 5_000,
      autoReloadCount: 1,
      lastAutoReloadAt: 5_000,
    });

    const active = {
      version: 2 as const,
      windowStartedAt: 5_000,
      autoReloadCount: 1,
      lastAutoReloadAt: 5_000,
    };
    expect(getNextRepairDeskStyleReloadState({ reloadState: active, now: 6_000 })).toEqual({
      ...active,
      autoReloadCount: 2,
      lastAutoReloadAt: 6_000,
    });
    expect(getNextRepairDeskStyleReloadState({ reloadState: active, now: 4_000 })).toEqual({
      version: 2,
      windowStartedAt: 4_000,
      autoReloadCount: 1,
      lastAutoReloadAt: 4_000,
    });
  });
});
