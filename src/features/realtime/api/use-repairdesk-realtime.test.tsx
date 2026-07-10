import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepairDeskRealtimeChannel, RepairDeskRealtimeClient } from "./realtime-client";
import { useRepairDeskRealtime } from "./use-repairdesk-realtime";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const nextStoreId = "d0693ca5-cb0f-4506-9d1d-40d6ff69e779";

afterEach(() => {
  vi.useRealTimers();
});

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

  it("refreshes realtime auth before opening private channels", async () => {
    const client = createMockRealtimeClient();
    let resolveAuth!: () => void;
    const setAuth = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAuth = resolve;
        }),
    );
    client.realtime = { setAuth };

    render(<RealtimeHarness client={client} enabled storeId={storeId} domains={["orders"]} />);

    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(client.channel).not.toHaveBeenCalled();

    resolveAuth();
    await waitFor(() => expect(client.channel).toHaveBeenCalledTimes(1));
  });

  it("reports auth refresh failures without opening a private channel", async () => {
    const client = createMockRealtimeClient();
    const error = new Error("expired session");
    const onStatus = vi.fn();
    client.realtime = { setAuth: vi.fn().mockRejectedValue(error) };

    render(
      <RealtimeHarness
        client={client}
        enabled
        storeId={storeId}
        domains={["orders"]}
        onStatus={onStatus}
      />,
    );

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("orders", "CHANNEL_ERROR", error));
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("retries a transient auth refresh failure before subscribing", async () => {
    vi.useFakeTimers();
    const client = createMockRealtimeClient();
    const setAuth = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary auth failure"))
      .mockResolvedValueOnce(undefined);
    client.realtime = { setAuth };

    const screen = render(
      <RealtimeHarness client={client} enabled storeId={storeId} domains={["orders"]} />,
    );
    await vi.waitFor(() => expect(setAuth).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(client.channel).toHaveBeenCalledTimes(1));

    screen.unmount();
  });
});

function RealtimeHarness({
  client,
  domains,
  enabled,
  storeId,
  onStatus,
}: {
  client: RepairDeskRealtimeClient;
  domains?: Parameters<typeof useRepairDeskRealtime>[0]["domains"];
  enabled: boolean;
  storeId: string | null;
  onStatus?: Parameters<typeof useRepairDeskRealtime>[0]["onStatus"];
}) {
  useRepairDeskRealtime({
    client,
    domains,
    enabled,
    storeId,
    onEvent: vi.fn(),
    onStatus,
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
