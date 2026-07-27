import { createClient } from "@/utils/supabase/client";

import {
  REPAIRDESK_REALTIME_BROADCAST_EVENT,
  REPAIRDESK_REALTIME_ENABLED_VALUE,
  buildRepairDeskRealtimeTopic,
  isRepairDeskRealtimeStoreId,
  parseRepairDeskRealtimeEvent,
  repairDeskRealtimeDomains,
  shouldProcessRepairDeskRealtimeEvent,
  type RepairDeskRealtimeDomain,
  type RepairDeskRealtimeEvent,
} from "@/features/realtime/model/realtime-events";

export { REPAIRDESK_REALTIME_BROADCAST_EVENT, REPAIRDESK_REALTIME_ENABLED_VALUE };

export type RepairDeskRealtimeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CHANNEL_ERROR"
  | "CLOSED"
  | string;

export type RepairDeskRealtimeBroadcastMessage = {
  payload?: unknown;
};

export type RepairDeskRealtimeChannel = {
  on(
    type: "broadcast",
    filter: { event: typeof REPAIRDESK_REALTIME_BROADCAST_EVENT },
    callback: (message: RepairDeskRealtimeBroadcastMessage) => void,
  ): RepairDeskRealtimeChannel;
  subscribe(
    callback?: (status: RepairDeskRealtimeStatus, error?: unknown) => void,
  ): RepairDeskRealtimeChannel | void;
  unsubscribe(): Promise<unknown> | unknown;
};

export type RepairDeskRealtimeClient = {
  channel(topic: string, options: { config: { private: true } }): RepairDeskRealtimeChannel;
  removeChannel?(channel: RepairDeskRealtimeChannel): Promise<unknown> | unknown;
  realtime?: {
    setAuth(token?: string): Promise<unknown> | unknown;
  };
};

export type RepairDeskRealtimeSubscriptionOptions = {
  client: RepairDeskRealtimeClient;
  storeId: string;
  domain: RepairDeskRealtimeDomain;
  onEvent: (event: RepairDeskRealtimeEvent) => void;
  onStatus?: (status: RepairDeskRealtimeStatus, error?: unknown) => void;
};

export function isRepairDeskRealtimeEnabled(
  value = process.env.NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED,
) {
  return value === REPAIRDESK_REALTIME_ENABLED_VALUE;
}

export function createRepairDeskRealtimeClient(): RepairDeskRealtimeClient {
  return createClient() as unknown as RepairDeskRealtimeClient;
}

export function syncRepairDeskRealtimeAuth(client: RepairDeskRealtimeClient) {
  return client.realtime?.setAuth();
}

export function subscribeToRepairDeskRealtimeDomain({
  client,
  storeId,
  domain,
  onEvent,
  onStatus,
}: RepairDeskRealtimeSubscriptionOptions) {
  if (!isRepairDeskRealtimeStoreId(storeId)) return undefined;

  const topic = buildRepairDeskRealtimeTopic(storeId, domain);
  const channel = client.channel(topic, { config: { private: true } });

  channel
    .on("broadcast", { event: REPAIRDESK_REALTIME_BROADCAST_EVENT }, (message) => {
      const event = parseRepairDeskRealtimeEvent(message.payload);
      if (!event || !shouldProcessRepairDeskRealtimeEvent(event, storeId)) return;
      onEvent(event);
    })
    .subscribe(onStatus);

  return () => {
    if (client.removeChannel) {
      void client.removeChannel(channel);
      return;
    }
    void channel.unsubscribe();
  };
}

export function getRepairDeskRealtimeDomains(
  domains?: readonly RepairDeskRealtimeDomain[],
): RepairDeskRealtimeDomain[] {
  return domains?.length
    ? [...domains]
    : repairDeskRealtimeDomains.filter((domain) => domain !== "memos");
}
