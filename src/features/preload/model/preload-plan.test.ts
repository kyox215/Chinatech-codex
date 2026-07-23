import { describe, expect, it } from "vitest";

import {
  getRepairDeskPreloadTargets,
  isRepairDeskPreloadEnabled,
  isRepairDeskPreloadTargetOwnedByWorkspaceHome,
  runRepairDeskPreloadQueue,
} from "./preload-plan";

describe("preload plan", () => {
  it("defaults to enabled and keeps an explicit rollback switch", () => {
    expect(isRepairDeskPreloadEnabled(undefined)).toBe(true);
    expect(isRepairDeskPreloadEnabled("1")).toBe(true);
    expect(isRepairDeskPreloadEnabled("0")).toBe(false);
  });

  it("prioritizes the active workspace and limits constrained networks", () => {
    expect(getRepairDeskPreloadTargets("/orders").slice(0, 2)).toEqual(["orders", "customers"]);
    expect(getRepairDeskPreloadTargets("/customers").slice(0, 2)).toEqual(["customers", "orders"]);
    expect(getRepairDeskPreloadTargets("/inventory", true)).toEqual(["orders", "customers"]);
    expect(getRepairDeskPreloadTargets("/settings")).toEqual([]);
  });

  it("does not preload data already owned by the active workspace home", () => {
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/", "orders")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/orders", "orders")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/orders/", "workflow")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/orders", "settings")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/orders", "customers")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/orders", "inventory")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/customers", "orders")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/customers", "inventory")).toBe(true);
    expect(isRepairDeskPreloadTargetOwnedByWorkspaceHome("/orders/order-1", "orders")).toBe(false);
  });

  it("never exceeds the configured concurrency", async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 5 }, () => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
    });

    await runRepairDeskPreloadQueue(tasks, 2);

    expect(peak).toBe(2);
  });

  it("continues warming later targets when one preload fails", async () => {
    const completed: string[] = [];

    await runRepairDeskPreloadQueue([
      async () => {
        throw new Error("network unavailable");
      },
      async () => {
        completed.push("customers");
      },
    ]);

    expect(completed).toEqual(["customers"]);
  });
});
