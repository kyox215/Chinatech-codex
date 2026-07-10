import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RepairDeskRealtimeChannel,
  RepairDeskRealtimeClient,
} from "@/features/realtime/api/realtime-client";

import { RealtimeSyncProvider } from "./realtime-sync-provider";
import { useRealtimeSync } from "./realtime-sync-context";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const otherStoreId = "d0693ca5-cb0f-4506-9d1d-40d6ff69e779";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RealtimeSyncProvider", () => {
  it("does not subscribe or invalidate when disabled", () => {
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();

    renderProvider({ client, enabled: false, queryClient, storeId });

    expect(client.channel).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("ignores invalid and wrong-store payloads", async () => {
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();

    renderProvider({ client, enabled: true, queryClient, storeId });

    client.emit({ phone: "+39 333 000 0000" });
    client.emit({
      schemaVersion: 1,
      eventId: "evt_wrong_store",
      emittedAt: "2026-07-06T11:30:00.000Z",
      storeId: otherStoreId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all"],
    });

    await waitFor(() => {
      expect(invalidateQueries).not.toHaveBeenCalled();
    });
  });

  it("invalidates mapped React Query targets for valid same-store events", async () => {
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();

    renderProvider({ client, enabled: true, queryClient, storeId, domains: ["orders"] });

    client.emit({
      schemaVersion: 1,
      eventId: "evt_orders",
      emittedAt: "2026-07-06T11:30:00.000Z",
      storeId,
      domain: "orders",
      mutation: "updated",
      queryGroups: ["orders.all", "customers.all"],
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["orders"], refetchType: "active" }),
        { cancelRefetch: true },
      );
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["customers"], refetchType: "active" }),
        { cancelRefetch: true },
      );
    });
  });

  it("cleans up subscriptions on unmount", () => {
    const client = createMockRealtimeClient();
    const { queryClient } = createTestQueryClient();
    const screen = renderProvider({
      client,
      domains: ["orders", "inventory"],
      enabled: true,
      queryClient,
      storeId,
    });

    screen.unmount();

    expect(client.removeChannel).toHaveBeenCalledTimes(2);
  });

  it("reports reconnect recovery and confirms the catch-up refresh", async () => {
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();

    renderProvider({ client, domains: ["orders"], enabled: true, queryClient, storeId });
    client.emitStatus("SUBSCRIBED");
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("live"));

    client.emitStatus("CHANNEL_ERROR");
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("reconnecting"));

    client.emitStatus("SUBSCRIBED");
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["orders"], refetchType: "active" }),
        { cancelRefetch: true },
      );
      expect(screen.getByTestId("sync-state")).toHaveTextContent("synced");
    });
  });

  it("does not report live after network recovery until the channel resubscribes", async () => {
    const client = createMockRealtimeClient();
    const { queryClient } = createTestQueryClient();

    renderProvider({ client, domains: ["orders"], enabled: true, queryClient, storeId });
    client.emitStatus("SUBSCRIBED");
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("live"));

    window.dispatchEvent(new Event("offline"));
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("offline"));
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("reconnecting"));

    client.emitStatus("SUBSCRIBED");
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("synced"));
  });

  it("runs one catch-up refresh after returning from a long hidden state", async () => {
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();
    let visibilityState: DocumentVisibilityState = "visible";
    let now = 1_000;
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);
    vi.spyOn(Date, "now").mockImplementation(() => now);

    renderProvider({ client, domains: ["orders"], enabled: true, queryClient, storeId });
    client.emitStatus("SUBSCRIBED");
    await waitFor(() => expect(screen.getByTestId("sync-state")).toHaveTextContent("live"));

    visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    now = 32_000;
    visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["orders"], refetchType: "active" }),
        { cancelRefetch: true },
      ),
    );
  });
});

function renderProvider({
  client,
  domains,
  enabled,
  queryClient,
  storeId,
}: {
  client: RepairDeskRealtimeClient;
  domains?: RealtimeSyncProviderPropsForTest["domains"];
  enabled: boolean;
  queryClient: QueryClient;
  storeId: string | null;
}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimeSyncProvider client={client} domains={domains} enabled={enabled} storeId={storeId}>
        <div data-testid="child" />
        <SyncStateProbe />
      </RealtimeSyncProvider>
    </QueryClientProvider>,
  );
}

type RealtimeSyncProviderPropsForTest = Parameters<typeof RealtimeSyncProvider>[0];

function SyncStateProbe() {
  const { connectionState } = useRealtimeSync();
  return <span data-testid="sync-state">{connectionState}</span>;
}

function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  return { queryClient, invalidateQueries };
}

function createMockRealtimeClient() {
  const callbacks: Array<(message: { payload?: unknown }) => void> = [];
  const statusCallbacks: Array<(status: string, error?: unknown) => void> = [];
  const channel = vi.fn((_topic: string, _options: { config: { private: true } }) => {
    const channelInstance: RepairDeskRealtimeChannel = {
      on: vi.fn((_type, _filter, callback) => {
        callbacks.push(callback);
        return channelInstance;
      }),
      subscribe: vi.fn((callback) => {
        if (callback) statusCallbacks.push(callback);
        return channelInstance;
      }),
      unsubscribe: vi.fn(),
    };
    return channelInstance;
  });
  const removeChannel = vi.fn((_channel: RepairDeskRealtimeChannel) => undefined);
  const client: RepairDeskRealtimeClient & {
    channel: typeof channel;
    emit: (payload: unknown) => void;
    emitStatus: (status: string, error?: unknown) => void;
    removeChannel: typeof removeChannel;
  } = {
    channel,
    removeChannel,
    emit: (payload: unknown) => callbacks.forEach((callback) => callback({ payload })),
    emitStatus: (status: string, error?: unknown) =>
      statusCallbacks.forEach((callback) => callback(status, error)),
  };
  return client;
}
