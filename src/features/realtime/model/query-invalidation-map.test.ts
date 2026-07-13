import { describe, expect, it } from "vitest";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { suppliersKeys } from "@/features/suppliers/api/query-keys";

import type { RepairDeskRealtimeEvent } from "./realtime-events";
import { getRepairDeskRealtimeInvalidationTargets } from "./query-invalidation-map";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";

describe("RepairDesk realtime invalidation map", () => {
  it("maps order-domain events to broad safe cache invalidation targets", () => {
    const event = buildEvent(["orders.all", "customers.all"]);

    expect(getRepairDeskRealtimeInvalidationTargets(event)).toEqual([
      { group: "orders.all", queryKey: ordersKeys.all },
      { group: "customers.all", queryKey: customersKeys.all },
    ]);
  });

  it("maps inventory and settings groups to scoped query keys when available", () => {
    const event = buildEvent([
      "inventory.all",
      "settings.store",
      "settings.templates",
      "suppliers.all",
      "kiosk.devices",
      "kiosk.sessions",
      "orders.workflow",
      "orders.options",
      "stores.context",
      "stores.members",
      "stores.access_requests",
    ]);

    expect(getRepairDeskRealtimeInvalidationTargets(event)).toEqual([
      { group: "inventory.all", queryKey: inventoryKeys.all },
      { group: "settings.store", queryKey: messageSettingsKeys.storeScoped(storeId) },
      { group: "settings.templates", queryKey: messageSettingsKeys.templatesScoped(storeId) },
      { group: "suppliers.all", queryKey: suppliersKeys.storeScoped(storeId) },
      { group: "kiosk.devices", queryKey: kioskKeys.devices(storeId) },
      { group: "kiosk.sessions", queryKey: kioskKeys.sessions(storeId) },
      { group: "orders.workflow", queryKey: ordersKeys.workflow(storeId) },
      { group: "orders.options", queryKey: ordersKeys.options(storeId) },
      { group: "stores.context", queryKey: storesKeys.context },
      { group: "stores.members", queryKey: storesKeys.membersScoped(storeId) },
      {
        group: "stores.access_requests",
        queryKey: storesKeys.accessRequestsScoped(storeId),
      },
    ]);
  });
});

function buildEvent(queryGroups: RepairDeskRealtimeEvent["queryGroups"]): RepairDeskRealtimeEvent {
  return {
    schemaVersion: 1,
    eventId: "evt_1",
    emittedAt: "2026-07-06T06:00:00.000Z",
    storeId,
    domain: "orders",
    mutation: "updated",
    queryGroups,
  };
}
