import { randomUUID } from "node:crypto";

import { getSupabaseAdmin, hasSupabaseConfig } from "@/server/supabase";
import {
  REPAIRDESK_REALTIME_BROADCAST_EVENT,
  REPAIRDESK_REALTIME_ENABLED_VALUE,
  REPAIRDESK_REALTIME_SCHEMA_VERSION,
  buildRepairDeskRealtimeTopic,
  parseRepairDeskRealtimeEvent,
  type RepairDeskRealtimeDomain,
  type RepairDeskRealtimeEvent,
  type RepairDeskRealtimeMutation,
  type RepairDeskRealtimeQueryGroup,
} from "@/features/realtime/model/realtime-events";

export type RepairDeskRealtimeServerChannel = {
  send(
    args: {
      type: "broadcast";
      event: typeof REPAIRDESK_REALTIME_BROADCAST_EVENT;
      payload: RepairDeskRealtimeEvent;
    },
    options?: Record<string, unknown>,
  ): Promise<RepairDeskRealtimeBroadcastSendResponse> | RepairDeskRealtimeBroadcastSendResponse;
  unsubscribe?(): Promise<unknown> | unknown;
};

export type RepairDeskRealtimeServerClient = {
  channel(topic: string, options: { config: { private: true } }): RepairDeskRealtimeServerChannel;
  removeChannel?(channel: RepairDeskRealtimeServerChannel): Promise<unknown> | unknown;
};

export type RepairDeskRealtimeBroadcastSendResponse = "ok" | "timed out" | "error" | (string & {});

export type RepairDeskRealtimeBroadcastInput = {
  storeId: string;
  domain: RepairDeskRealtimeDomain;
  mutation: RepairDeskRealtimeMutation;
  queryGroups: readonly RepairDeskRealtimeQueryGroup[];
  eventId?: string;
  emittedAt?: string;
};

export type RepairDeskRealtimeMutationBroadcast = Omit<RepairDeskRealtimeBroadcastInput, "storeId">;

export type RepairDeskRealtimeBroadcastOptions = {
  client?: RepairDeskRealtimeServerClient;
  createClient?: () => RepairDeskRealtimeServerClient;
  enabled?: boolean;
  hasConfig?: () => boolean;
  now?: () => Date;
  randomUUID?: () => string;
};

export type RepairDeskRealtimeBroadcastResult =
  | { status: "disabled" }
  | { status: "skipped"; reason: "invalid_payload" | "supabase_unconfigured" | "unsafe_topic" }
  | { status: "sent"; event: RepairDeskRealtimeEvent; response: "ok" }
  | {
      status: "failed";
      event?: RepairDeskRealtimeEvent;
      error?: unknown;
      reason: "send_error" | "send_rejected";
      response?: RepairDeskRealtimeBroadcastSendResponse;
    };

export function isRepairDeskRealtimeServerBroadcastEnabled(
  value = process.env.REPAIRDESK_REALTIME_BROADCAST_ENABLED,
) {
  return value === REPAIRDESK_REALTIME_ENABLED_VALUE;
}

export async function broadcastRepairDeskRealtimeEvent(
  input: RepairDeskRealtimeBroadcastInput,
  options: RepairDeskRealtimeBroadcastOptions = {},
): Promise<RepairDeskRealtimeBroadcastResult> {
  const enabled = options.enabled ?? isRepairDeskRealtimeServerBroadcastEnabled();
  if (!enabled) return { status: "disabled" };

  const event = buildRepairDeskRealtimeBroadcastEvent(input, options);
  if (!event) return { status: "skipped", reason: "invalid_payload" };

  let topic: string;
  try {
    topic = buildRepairDeskRealtimeTopic(event.storeId, event.domain);
  } catch {
    return { status: "skipped", reason: "unsafe_topic" };
  }

  const client = getRepairDeskRealtimeBroadcastClient(options);
  if (!client) return { status: "skipped", reason: "supabase_unconfigured" };

  const channel = client.channel(topic, { config: { private: true } });

  try {
    const response = await channel.send({
      type: "broadcast",
      event: REPAIRDESK_REALTIME_BROADCAST_EVENT,
      payload: event,
    });

    if (response !== "ok") {
      return { status: "failed", event, reason: "send_rejected", response };
    }

    return { status: "sent", event, response: "ok" };
  } catch (error) {
    return { status: "failed", event, error, reason: "send_error" };
  } finally {
    await cleanupRepairDeskRealtimeChannel(client, channel);
  }
}

export function queueRepairDeskRealtimeBroadcast(
  input: RepairDeskRealtimeBroadcastInput,
  options: RepairDeskRealtimeBroadcastOptions = {},
) {
  void broadcastRepairDeskRealtimeEvent(input, options).catch(() => undefined);
}

export function buildRepairDeskRealtimeBroadcastEvent(
  input: RepairDeskRealtimeBroadcastInput,
  options: Pick<RepairDeskRealtimeBroadcastOptions, "now" | "randomUUID"> = {},
): RepairDeskRealtimeEvent | null {
  const event = {
    schemaVersion: REPAIRDESK_REALTIME_SCHEMA_VERSION,
    eventId: input.eventId ?? `evt_${(options.randomUUID ?? randomUUID)()}`,
    emittedAt: input.emittedAt ?? (options.now ?? (() => new Date()))().toISOString(),
    storeId: input.storeId,
    domain: input.domain,
    mutation: input.mutation,
    queryGroups: [...input.queryGroups],
  };

  return parseRepairDeskRealtimeEvent(event);
}

function getRepairDeskRealtimeBroadcastClient(
  options: RepairDeskRealtimeBroadcastOptions,
): RepairDeskRealtimeServerClient | null {
  if (options.client) return options.client;

  const hasConfig = options.hasConfig ?? hasSupabaseConfig;
  if (!hasConfig()) return null;

  const createClient = options.createClient ?? createRepairDeskRealtimeServerClient;
  return createClient();
}

function createRepairDeskRealtimeServerClient(): RepairDeskRealtimeServerClient {
  return getSupabaseAdmin() as unknown as RepairDeskRealtimeServerClient;
}

async function cleanupRepairDeskRealtimeChannel(
  client: RepairDeskRealtimeServerClient,
  channel: RepairDeskRealtimeServerChannel,
) {
  try {
    if (client.removeChannel) {
      await client.removeChannel(channel);
      return;
    }
    await channel.unsubscribe?.();
  } catch {
    // Realtime cleanup must not make the original business mutation fail.
  }
}
