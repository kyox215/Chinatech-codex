import type { QueryKey } from "@tanstack/react-query";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";

import type { RepairDeskRealtimeEvent, RepairDeskRealtimeQueryGroup } from "./realtime-events";

export type RepairDeskRealtimeInvalidationTarget = {
  group: RepairDeskRealtimeQueryGroup;
  queryKey: QueryKey;
};

export function getRepairDeskRealtimeInvalidationTargets(
  event: RepairDeskRealtimeEvent,
): RepairDeskRealtimeInvalidationTarget[] {
  return event.queryGroups.map((group) => ({
    group,
    queryKey: getQueryKeyForGroup(group, event.storeId),
  }));
}

function getQueryKeyForGroup(group: RepairDeskRealtimeQueryGroup, storeId: string): QueryKey {
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
    case "settings.store":
      return messageSettingsKeys.storeScoped(storeId);
    case "settings.templates":
      return messageSettingsKeys.templatesScoped(storeId);
    case "stores.context":
      return storesKeys.context;
    case "stores.members":
      return storesKeys.membersScoped(storeId);
    case "stores.access_requests":
      return storesKeys.accessRequestsScoped(storeId);
  }
}
