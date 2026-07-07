import { describe, expect, it } from "vitest";

import {
  buildRepairDeskRealtimeTopic,
  containsRealtimeSensitiveKey,
  parseRepairDeskRealtimeEvent,
  shouldProcessRepairDeskRealtimeEvent,
} from "./realtime-events";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

describe("RepairDesk realtime event contract", () => {
  it("builds private store-domain topics without business identifiers", () => {
    expect(buildRepairDeskRealtimeTopic(storeId, "orders")).toBe(
      `repairdesk:v1:store:${storeId}:orders`,
    );
    expect(() => buildRepairDeskRealtimeTopic("store_1", "orders")).toThrow(
      "requires a store UUID",
    );
  });

  it("accepts minimal invalidation events for the active store", () => {
    const event = parseRepairDeskRealtimeEvent({
      schemaVersion: 1,
      eventId: "evt_1",
      emittedAt: "2026-07-06T06:00:00.000Z",
      storeId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all", "customers.all"],
    });

    expect(event).toEqual({
      schemaVersion: 1,
      eventId: "evt_1",
      emittedAt: "2026-07-06T06:00:00.000Z",
      storeId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all", "customers.all"],
    });
    expect(shouldProcessRepairDeskRealtimeEvent(event!, storeId)).toBe(true);
    expect(
      shouldProcessRepairDeskRealtimeEvent(event!, "d0693ca5-cb0f-4506-9d1d-40d6ff69e779"),
    ).toBe(false);
  });

  it("rejects broad-channel payloads with identifiers or customer PII", () => {
    expect(
      parseRepairDeskRealtimeEvent({
        schemaVersion: 1,
        eventId: "evt_2",
        emittedAt: "2026-07-06T06:00:00.000Z",
        storeId,
        domain: "customers",
        mutation: "updated",
        customerId: "cust_1",
        queryGroups: ["customers.all"],
      }),
    ).toBeNull();
    expect(
      parseRepairDeskRealtimeEvent({
        schemaVersion: 1,
        eventId: "evt_3",
        emittedAt: "2026-07-06T06:00:00.000Z",
        storeId,
        domain: "customers",
        mutation: "updated",
        queryGroups: ["customers.all"],
        phone: "+39 333 000 0000",
      }),
    ).toBeNull();
  });

  it("detects nested sensitive DTO-like payloads", () => {
    expect(
      containsRealtimeSensitiveKey({
        schemaVersion: 1,
        eventId: "evt_4",
        payload: {
          payment: { amount: 20 },
          device: { imei: "123456789012345" },
          unlock: { passcode: "1234" },
        },
      }),
    ).toBe(true);
  });

  it("requires known query groups", () => {
    expect(
      parseRepairDeskRealtimeEvent({
        schemaVersion: 1,
        eventId: "evt_5",
        emittedAt: "2026-07-06T06:00:00.000Z",
        storeId,
        domain: "inventory",
        mutation: "updated",
        queryGroups: ["inventory.detail"],
      }),
    ).toBeNull();
  });
});
