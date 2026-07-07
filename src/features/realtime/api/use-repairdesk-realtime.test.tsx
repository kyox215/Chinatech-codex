import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RepairDeskRealtimeChannel, RepairDeskRealtimeClient } from "./realtime-client";
import { useRepairDeskRealtime } from "./use-repairdesk-realtime";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const nextStoreId = "d0693ca5-cb0f-4506-9d1d-40d6ff69e779";

describe("useRepairDeskRealtime", () => {
  it("does not subscribe when disabled", () => {
    const client = createMockRealtimeClient();

    render(<RealtimeHarness client={client} enabled={false} storeId={storeId} />);

    expect(client.channel).not.toHaveBeenCalled();
  });

  it("does not subscribe without an active store", () => {
    const client = createMockRealtimeClient();

    render(<RealtimeHarness client={client} enabled storeId={null} />);

    expect(client.channel).not.toHaveBeenCalled();
  });

  it("subscribes to requested domains and unsubscribes on unmount", () => {
    const client = createMockRealtimeClient();
    const screen = render(
      <RealtimeHarness
        client={client}
        enabled
        storeId={storeId}
        domains={["orders", "customers"]}
      />,
    );

    expect(client.channel).toHaveBeenCalledTimes(2);
    expect(client.channel).toHaveBeenNthCalledWith(1, `repairdesk:v1:store:${storeId}:orders`, {
      config: { private: true },
    });
    expect(client.channel).toHaveBeenNthCalledWith(2, `repairdesk:v1:store:${storeId}:customers`, {
      config: { private: true },
    });

    screen.unmount();
    expect(client.removeChannel).toHaveBeenCalledTimes(2);
  });

  it("removes old channels before subscribing to the next active store", () => {
    const client = createMockRealtimeClient();
    const screen = render(
      <RealtimeHarness client={client} enabled storeId={storeId} domains={["orders"]} />,
    );

    screen.rerender(
      <RealtimeHarness client={client} enabled storeId={nextStoreId} domains={["orders"]} />,
    );

    expect(client.removeChannel).toHaveBeenCalledTimes(1);
    expect(client.channel).toHaveBeenLastCalledWith(`repairdesk:v1:store:${nextStoreId}:orders`, {
      config: { private: true },
    });
  });
});

function RealtimeHarness({
  client,
  domains,
  enabled,
  storeId,
}: {
  client: RepairDeskRealtimeClient;
  domains?: Parameters<typeof useRepairDeskRealtime>[0]["domains"];
  enabled: boolean;
  storeId: string | null;
}) {
  useRepairDeskRealtime({
    client,
    domains,
    enabled,
    storeId,
    onEvent: vi.fn(),
  });
  return null;
}

function createMockRealtimeClient() {
  const channels: RepairDeskRealtimeChannel[] = [];
  const channel = vi.fn((_topic: string, _options: { config: { private: true } }) => {
    const channelInstance: RepairDeskRealtimeChannel = {
      on: vi.fn(() => channelInstance),
      subscribe: vi.fn(() => channelInstance),
      unsubscribe: vi.fn(),
    };
    channels.push(channelInstance);
    return channelInstance;
  });
  const removeChannel = vi.fn((_channel: RepairDeskRealtimeChannel) => undefined);
  const client: RepairDeskRealtimeClient & {
    channel: typeof channel;
    channels: RepairDeskRealtimeChannel[];
    removeChannel: typeof removeChannel;
  } = {
    channel,
    removeChannel,
    channels,
  };

  return client;
}
