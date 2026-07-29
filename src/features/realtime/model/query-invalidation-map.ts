import type { QueryKey } from "@tanstack/react-query";

import { customersKeys } from "@/features/customers/api/query-keys";
import { buybackKeys } from "@/features/buyback/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventoryProductKeys } from "@/features/inventory/products/api/query-keys";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { suppliersKeys } from "@/features/suppliers/api/query-keys";
import { memosKeys } from "@/features/memos/api/query-keys";

import type {
  RepairDeskRealtimeDomain,
  RepairDeskRealtimeEvent,
  RepairDeskRealtimeQueryGroup,
} from "./realtime-events";

export type RepairDeskRealtimeInvalidationTarget = {
  group: RepairDeskRealtimeQueryGroup;
  queryKey: QueryKey;
};

export function getRepairDeskRealtimeInvalidationTargets(
  event: RepairDeskRealtimeEvent,
): RepairDeskRealtimeInvalidationTarget[] {
  return event.queryGroups.map((group) => ({
    group,
    queryKey: getRepairDeskRealtimeQueryKeyForGroup(group, event.storeId),
  }));
}

export function getRepairDeskRealtimeQueryKeyForGroup(
  group: RepairDeskRealtimeQueryGroup,
  storeId: string,
): QueryKey {
  switch (group) {
    case "orders.all":
      return ordersKeys.all;
    case "orders.workflow":
      return ordersKeys.workflow(storeId);
    case "orders.options":
      return ordersKeys.options(storeId);
    case "customers.all":
      return customersKeys.all;
    case "inventory.all":
      return inventoryKeys.all;
    case "inventory.products":
      return inventoryProductKeys.all;
    case "buyback.all":
      return buybackKeys.all;
    case "settings.store":
      return messageSettingsKeys.storeScoped(storeId);
    case "settings.templates":
      return messageSettingsKeys.templatesScoped(storeId);
    case "suppliers.all":
      return suppliersKeys.storeScoped(storeId);
    case "kiosk.devices":
      return kioskKeys.devices(storeId);
    case "kiosk.sessions":
      return kioskKeys.sessions(storeId);
    case "stores.context":
      return storesKeys.context;
    case "stores.members":
      return storesKeys.membersScoped(storeId);
    case "stores.access_requests":
      return storesKeys.accessRequestsScoped(storeId);
    case "memos.all":
      return memosKeys.store(storeId);
  }
}

export function getRepairDeskRealtimeQueryGroupsForDomain(
  domain: RepairDeskRealtimeDomain,
): RepairDeskRealtimeQueryGroup[] {
  switch (domain) {
    case "orders":
      return ["orders.all"];
    case "customers":
      return ["customers.all"];
    case "inventory":
      return ["inventory.all", "inventory.products", "buyback.all"];
    case "settings":
      return [
        "settings.store",
        "settings.templates",
        "suppliers.all",
        "kiosk.devices",
        "kiosk.sessions",
        "stores.context",
        "stores.members",
        "stores.access_requests",
        "orders.workflow",
        "orders.options",
        "orders.all",
        "customers.all",
        "inventory.all",
        "inventory.products",
        "buyback.all",
      ];
    case "memos":
      return ["memos.all"];
  }
}
