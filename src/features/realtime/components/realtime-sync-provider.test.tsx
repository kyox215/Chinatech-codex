import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RepairDeskRealtimeChannel,
  RepairDeskRealtimeClient,
} from "@/features/realtime/api/realtime-client";

import {
  REPAIRDESK_FOREGROUND_RECONCILE_INTERVAL_MS,
  RealtimeSyncProvider,
} from "./realtime-sync-provider";
import { useRealtimeSync } from "./realtime-sync-context";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const otherStoreId = "d0693ca5-cb0f-4506-9d1d-40d6ff69e779";

afterEach(() => {
  vi.useRealTimers();
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

  it("refreshes the visible order workspace only when the 30-second revision changes", async () => {
    vi.useFakeTimers();
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();
    const revisionLoader = vi
      .fn()
      .mockResolvedValueOnce({ revisions: { orders: "7" } })
      .mockResolvedValueOnce({ revisions: { orders: "8" } });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    renderProvider({
      client,
      domains: ["orders"],
      enabled: true,
      foregroundReconcileDomains: ["orders"],
      queryClient,
      revisionCheckEnabled: true,
      revisionLoader,
      storeId,
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(revisionLoader).toHaveBeenCalledOnce();
    expect(invalidateQueries).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(REPAIRDESK_FOREGROUND_RECONCILE_INTERVAL_MS);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["orders"], refetchType: "active" }),
      { cancelRefetch: true },
    );
  });

  it("does not refresh business queries when the 30-second revision is unchanged", async () => {
    vi.useFakeTimers();
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();
    const revisionLoader = vi.fn().mockResolvedValue({ revisions: { orders: "7" } });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    renderProvider({
      client,
      enabled: true,
      foregroundReconcileDomains: ["orders"],
      queryClient,
      revisionCheckEnabled: true,
      revisionLoader,
      storeId,
    });

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(REPAIRDESK_FOREGROUND_RECONCILE_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(revisionLoader).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it.each([
    { visibility: "hidden" as const, online: true, label: "hidden" },
    { visibility: "visible" as const, online: false, label: "offline" },
  ])("pauses revision checks while $label", async ({ visibility, online }) => {
    vi.useFakeTimers();
    const client = createMockRealtimeClient();
    const { queryClient } = createTestQueryClient();
    const revisionLoader = vi.fn().mockResolvedValue({ revisions: { orders: "7" } });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibility);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);

    renderProvider({
      client,
      enabled: true,
      foregroundReconcileDomains: ["orders"],
      queryClient,
      revisionCheckEnabled: true,
      revisionLoader,
      storeId,
    });

    await act(async () => {
      vi.advanceTimersByTime(REPAIRDESK_FOREGROUND_RECONCILE_INTERVAL_MS * 2);
      await Promise.resolve();
    });

    expect(revisionLoader).not.toHaveBeenCalled();
  });

  it("aborts an in-flight revision check and clears its interval on unmount", async () => {
    vi.useFakeTimers();
    const client = createMockRealtimeClient();
    const { queryClient, invalidateQueries } = createTestQueryClient();
    let requestSignal: AbortSignal | undefined;
    const revisionLoader: NonNullable<RealtimeSyncProviderPropsForTest["revisionLoader"]> = vi.fn(
      (_domains, options) => {
        requestSignal = options?.signal;
        return new Promise<{ revisions: { orders: string } }>(() => undefined);
      },
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    const view = renderProvider({
      client,
      enabled: true,
      foregroundReconcileDomains: ["orders"],
      queryClient,
      revisionCheckEnabled: true,
      revisionLoader,
      storeId,
    });
    await act(async () => Promise.resolve());

    expect(requestSignal?.aborted).toBe(false);
    view.unmount();
    expect(requestSignal?.aborted).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(REPAIRDESK_FOREGROUND_RECONCILE_INTERVAL_MS * 2);
      await Promise.resolve();
    });
    expect(revisionLoader).toHaveBeenCalledOnce();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

function renderProvider({
  client,
  domains,
  enabled,
  foregroundReconcileDomains,
  queryClient,
  revisionCheckEnabled,
  revisionLoader,
  storeId,
}: {
  client: RepairDeskRealtimeClient;
  domains?: RealtimeSyncProviderPropsForTest["domains"];
  enabled: boolean;
  foregroundReconcileDomains?: RealtimeSyncProviderPropsForTest["foregroundReconcileDomains"];
  queryClient: QueryClient;
  revisionCheckEnabled?: RealtimeSyncProviderPropsForTest["revisionCheckEnabled"];
  revisionLoader?: RealtimeSyncProviderPropsForTest["revisionLoader"];
  storeId: string | null;
}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimeSyncProvider
        client={client}
        domains={domains}
        enabled={enabled}
        foregroundReconcileDomains={foregroundReconcileDomains}
        revisionCheckEnabled={revisionCheckEnabled}
        revisionLoader={revisionLoader}
        storeId={storeId}
      >
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
