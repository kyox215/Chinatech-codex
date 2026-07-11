import { describe, expect, it, vi } from "vitest";

import {
  BoundedPreloadScheduler,
  getOrderDetailAutomaticPreloadLimit,
} from "./order-detail-preload";

describe("order detail preload policy", () => {
  it("limits automatic detail warming by network conditions", () => {
    expect(getOrderDetailAutomaticPreloadLimit({ online: true, effectiveType: "4g" })).toBe(2);
    expect(getOrderDetailAutomaticPreloadLimit({ online: true, effectiveType: "3g" })).toBe(1);
    expect(getOrderDetailAutomaticPreloadLimit({ online: true, effectiveType: "2g" })).toBe(0);
    expect(getOrderDetailAutomaticPreloadLimit({ online: true, saveData: true })).toBe(0);
    expect(getOrderDetailAutomaticPreloadLimit({ online: false })).toBe(0);
  });

  it("keeps detail tasks within the configured concurrency", async () => {
    const scheduler = new BoundedPreloadScheduler(1);
    const releases: Array<() => void> = [];
    let active = 0;
    let peak = 0;

    const task = () =>
      new Promise<void>((resolve) => {
        active += 1;
        peak = Math.max(peak, active);
        releases.push(() => {
          active -= 1;
          resolve();
        });
      });

    scheduler.schedule("one", task, "background");
    scheduler.schedule("two", task, "background");
    await Promise.resolve();
    expect(scheduler.snapshot()).toMatchObject({ active: 1, queued: 1 });

    releases.shift()?.();
    await vi.waitFor(() => expect(scheduler.snapshot()).toMatchObject({ active: 1, queued: 0 }));
    expect(peak).toBe(1);

    releases.shift()?.();
    await Promise.resolve();
  });

  it("runs intent before queued background work and deduplicates keys", async () => {
    const scheduler = new BoundedPreloadScheduler(1);
    const order: string[] = [];
    let releaseActive: (() => void) | undefined;

    scheduler.schedule(
      "active",
      () =>
        new Promise<void>((resolve) => {
          releaseActive = resolve;
        }),
      "background",
    );
    scheduler.schedule(
      "background",
      async () => {
        order.push("background");
      },
      "background",
    );
    expect(
      scheduler.schedule(
        "background",
        async () => {
          order.push("duplicate");
        },
        "intent",
      ),
    ).toBe(false);
    scheduler.schedule(
      "intent",
      async () => {
        order.push("intent");
      },
      "intent",
    );

    await Promise.resolve();
    releaseActive?.();
    await vi.waitFor(() => expect(order).toEqual(["intent", "background"]));
  });

  it("keeps the queue bounded and replaces an older queued intent with the latest one", async () => {
    const scheduler = new BoundedPreloadScheduler(1, 2);
    const order: string[] = [];
    let releaseActive: (() => void) | undefined;

    scheduler.schedule(
      "active",
      () =>
        new Promise<void>((resolve) => {
          releaseActive = resolve;
        }),
      "background",
    );
    scheduler.schedule("background", async () => order.push("background"), "background");
    scheduler.schedule("old-intent", async () => order.push("old-intent"), "intent");
    scheduler.schedule("latest-intent", async () => order.push("latest-intent"), "intent");

    expect(scheduler.snapshot()).toMatchObject({ active: 1, queued: 2 });
    expect(scheduler.snapshot().queuedKeys).toEqual(["latest-intent", "background"]);

    await Promise.resolve();
    releaseActive?.();
    await vi.waitFor(() => expect(order).toEqual(["latest-intent", "background"]));
    expect(order).not.toContain("old-intent");
  });

  it("cancels queued work without interrupting the active request", async () => {
    const scheduler = new BoundedPreloadScheduler(1);
    let releaseActive: (() => void) | undefined;
    let queuedRan = false;

    scheduler.schedule(
      "active",
      () =>
        new Promise<void>((resolve) => {
          releaseActive = resolve;
        }),
      "background",
    );
    scheduler.schedule(
      "queued",
      async () => {
        queuedRan = true;
      },
      "background",
    );
    await Promise.resolve();

    expect(scheduler.cancel("active")).toBe(false);
    expect(scheduler.cancel("queued")).toBe(true);
    releaseActive?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(queuedRan).toBe(false);
  });
});
