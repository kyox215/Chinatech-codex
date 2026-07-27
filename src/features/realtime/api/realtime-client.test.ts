import { describe, expect, it, vi } from "vitest";

import type { RepairDeskRealtimeEvent } from "@/features/realtime/model/realtime-events";

import {
  REPAIRDESK_REALTIME_BROADCAST_EVENT,
  getRepairDeskRealtimeDomains,
  isRepairDeskRealtimeEnabled,
  subscribeToRepairDeskRealtimeDomain,
  type RepairDeskRealtimeChannel,
  type RepairDeskRealtimeClient,
} from "./realtime-client";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const otherStoreId = "d0693ca5-cb0f-4506-9d1d-40d6ff69e779";

describe("RepairDesk realtime client adapter", () => {
  it("keeps realtime disabled unless the explicit public flag is set", () => {
    expect(isRepairDeskRealtimeEnabled()).toBe(false);
    expect(isRepairDeskRealtimeEnabled("0")).toBe(false);
    expect(isRepairDeskRealtimeEnabled("true")).toBe(false);
    expect(isRepairDeskRealtimeEnabled("1")).toBe(true);
  });

  it("subscribes to private store-domain channels and cleans up through removeChannel", () => {
    const client = createMockRealtimeClient();
    const onEvent = vi.fn();

    const cleanup = subscribeToRepairDeskRealtimeDomain({
      client,
      storeId,
      domain: "orders",
      onEvent,
    });

    expect(client.channel).toHaveBeenCalledWith(`repairdesk:v1:store:${storeId}:orders`, {
      config: { private: true },
    });
    expect(client.channelInstance.on).toHaveBeenCalledWith(
      "broadcast",
      { event: REPAIRDESK_REALTIME_BROADCAST_EVENT },
      expect.any(Function),
    );
    expect(client.channelInstance.subscribe).toHaveBeenCalledTimes(1);

    cleanup?.();
    expect(client.removeChannel).toHaveBeenCalledWith(client.channelInstance);
  });

  it("does not subscribe when the store id cannot build a safe topic", () => {
    const client = createMockRealtimeClient();

    const cleanup = subscribeToRepairDeskRealtimeDomain({
      client,
      storeId: "store_1",
      domain: "orders",
      onEvent: vi.fn(),
    });

    expect(cleanup).toBeUndefined();
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("accepts only valid same-store invalidation events", () => {
    const client = createMockRealtimeClient();
    const onEvent = vi.fn();

    subscribeToRepairDeskRealtimeDomain({
      client,
      storeId,
      domain: "orders",
      onEvent,
    });

    client.emit({
      schemaVersion: 1,
      eventId: "evt_1",
      emittedAt: "2026-07-06T06:00:00.000Z",
      storeId: otherStoreId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all"],
    });
    client.emit({ phone: "+39 333 000 0000" });
    client.emit({
      schemaVersion: 1,
      eventId: "evt_2",
      emittedAt: "2026-07-06T06:01:00.000Z",
      storeId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all"],
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      schemaVersion: 1,
      eventId: "evt_2",
      emittedAt: "2026-07-06T06:01:00.000Z",
      storeId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all"],
    });
  });

  it("defaults to all supported realtime domains", () => {
    expect(getRepairDeskRealtimeDomains()).toEqual([
      "orders",
      "customers",
      "inventory",
      "settings",
    ]);
    expect(getRepairDeskRealtimeDomains(["orders"])).toEqual(["orders"]);
    expect(getRepairDeskRealtimeDomains(["memos"])).toEqual(["memos"]);
  });
});

function createMockRealtimeClient() {
  let callback: ((message: { payload?: unknown }) => void) | undefined;
  const channelInstance: RepairDeskRealtimeChannel = {
    on: vi.fn((_type, _filter, nextCallback) => {
      callback = nextCallback;
      return channelInstance;
    }),
    subscribe: vi.fn(() => channelInstance),
    unsubscribe: vi.fn(),
  };
  const channel = vi.fn(
    (_topic: string, _options: { config: { private: true } }) => channelInstance,
  );
  const removeChannel = vi.fn((_channel: RepairDeskRealtimeChannel) => undefined);
  const client: RepairDeskRealtimeClient & {
    channel: typeof channel;
    channelInstance: RepairDeskRealtimeChannel;
    emit: (payload: RepairDeskRealtimeEvent | Record<string, unknown>) => void;
    removeChannel: typeof removeChannel;
  } = {
    channel,
    removeChannel,
    channelInstance,
    emit: (payload: unknown) => callback?.({ payload }),
  };

  return client;
}
