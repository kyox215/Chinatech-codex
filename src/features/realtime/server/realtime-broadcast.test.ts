import { describe, expect, it, vi } from "vitest";

import type {
  RepairDeskRealtimeServerChannel,
  RepairDeskRealtimeServerClient,
} from "./realtime-broadcast";
import {
  buildRepairDeskRealtimeBroadcastEvent,
  broadcastRepairDeskRealtimeEvent,
  isRepairDeskRealtimeServerBroadcastEnabled,
} from "./realtime-broadcast";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

describe("RepairDesk realtime server broadcast", () => {
  it("keeps server broadcast disabled unless the explicit server flag is set", () => {
    expect(isRepairDeskRealtimeServerBroadcastEnabled()).toBe(false);
    expect(isRepairDeskRealtimeServerBroadcastEnabled("0")).toBe(false);
    expect(isRepairDeskRealtimeServerBroadcastEnabled("true")).toBe(false);
    expect(isRepairDeskRealtimeServerBroadcastEnabled("1")).toBe(true);
  });

  it("builds only the allowlisted realtime event payload", () => {
    const event = buildRepairDeskRealtimeBroadcastEvent(
      {
        storeId,
        domain: "orders",
        mutation: "updated",
        queryGroups: ["orders.all"],
        eventId: "evt_orders",
        orderId: "must_not_leak",
        phone: "+39 333 000 0000",
      } as Parameters<typeof buildRepairDeskRealtimeBroadcastEvent>[0],
      { now: () => new Date("2026-07-06T13:40:00.000Z") },
    );

    expect(event).toEqual({
      schemaVersion: 1,
      eventId: "evt_orders",
      emittedAt: "2026-07-06T13:40:00.000Z",
      storeId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all"],
    });
    expect(event).not.toHaveProperty("orderId");
    expect(event).not.toHaveProperty("phone");
  });

  it("does not create a channel when disabled", async () => {
    const client = createMockRealtimeServerClient();

    const result = await broadcastRepairDeskRealtimeEvent(
      {
        storeId,
        domain: "orders",
        mutation: "updated",
        queryGroups: ["orders.all"],
      },
      { client, enabled: false },
    );

    expect(result).toEqual({ status: "disabled" });
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("skips unsafe store topics before sending", async () => {
    const client = createMockRealtimeServerClient();

    const result = await broadcastRepairDeskRealtimeEvent(
      {
        storeId: "store_1",
        domain: "orders",
        mutation: "updated",
        queryGroups: ["orders.all"],
      },
      { client, enabled: true },
    );

    expect(result).toEqual({ status: "skipped", reason: "unsafe_topic" });
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("sends a private broadcast event and cleans up the channel", async () => {
    const client = createMockRealtimeServerClient();

    const result = await broadcastRepairDeskRealtimeEvent(
      {
        storeId,
        domain: "orders",
        mutation: "transitioned",
        queryGroups: ["orders.all", "customers.all"],
        eventId: "evt_transition",
        emittedAt: "2026-07-06T13:40:00.000Z",
      },
      { client, enabled: true },
    );

    expect(result.status).toBe("sent");
    expect(client.channel).toHaveBeenCalledWith(`repairdesk:v1:store:${storeId}:orders`, {
      config: { private: true },
    });
    expect(client.channelInstance.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "repairdesk.realtime",
      payload: {
        schemaVersion: 1,
        eventId: "evt_transition",
        emittedAt: "2026-07-06T13:40:00.000Z",
        storeId,
        domain: "orders",
        mutation: "transitioned",
        queryGroups: ["orders.all", "customers.all"],
      },
    });
    expect(client.removeChannel).toHaveBeenCalledWith(client.channelInstance);
  });

  it("returns failed without throwing when Supabase rejects the send", async () => {
    const client = createMockRealtimeServerClient("timed out");

    const result = await broadcastRepairDeskRealtimeEvent(
      {
        storeId,
        domain: "inventory",
        mutation: "updated",
        queryGroups: ["inventory.all"],
        eventId: "evt_inventory",
      },
      { client, enabled: true },
    );

    expect(result).toMatchObject({
      status: "failed",
      reason: "send_rejected",
      response: "timed out",
    });
    expect(client.removeChannel).toHaveBeenCalledWith(client.channelInstance);
  });
});

function createMockRealtimeServerClient(response: "ok" | "timed out" = "ok") {
  const channelInstance: RepairDeskRealtimeServerChannel = {
    send: vi.fn(async () => response),
    unsubscribe: vi.fn(),
  };
  const channel = vi.fn(
    (_topic: string, _options: { config: { private: true } }) => channelInstance,
  );
  const removeChannel = vi.fn((_channel: RepairDeskRealtimeServerChannel) => undefined);
  const client: RepairDeskRealtimeServerClient & {
    channel: typeof channel;
    channelInstance: RepairDeskRealtimeServerChannel;
    removeChannel: typeof removeChannel;
  } = {
    channel,
    channelInstance,
    removeChannel,
  };

  return client;
}
