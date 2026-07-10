import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepairDeskRealtimeEvent } from "./realtime-events";
import { QueryFreshnessCoordinator, StalePreloadError } from "./query-freshness-coordinator";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const otherStoreId = "d0693ca5-cb0f-4506-9d1d-40d6ff69e779";

afterEach(() => {
  vi.useRealTimers();
});

describe("QueryFreshnessCoordinator", () => {
  it("deduplicates event bursts and refetches an active key once", async () => {
    vi.useFakeTimers();
    const queryClient = createQueryClient();
    const queryFn = vi.fn().mockResolvedValue({ version: 1 });
    const queryKey = ["orders", "queue-summary", "store", storeId, { page: 1 }] as const;
    await queryClient.fetchQuery({ queryKey, queryFn });
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const coordinator = new QueryFreshnessCoordinator(queryClient, { debounceMs: 100 });
    coordinator.setStore(storeId);

    const event = createEvent("evt_same");
    expect(coordinator.handleRealtimeEvent(event)).toBe(true);
    expect(coordinator.handleRealtimeEvent(event)).toBe(false);
    for (let index = 0; index < 20; index += 1) {
      coordinator.handleRealtimeEvent(createEvent(`evt_${index}`));
    }

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    const activeInvalidations = invalidateQueries.mock.calls.filter(
      ([filters]) => filters?.refetchType === "active",
    );
    expect(activeInvalidations).toHaveLength(1);
    expect(queryFn).toHaveBeenCalledTimes(2);

    unsubscribe();
    coordinator.dispose();
  });

  it("rejects a stale prefetch result when an event advances the group epoch", async () => {
    vi.useFakeTimers();
    const queryClient = createQueryClient();
    const coordinator = new QueryFreshnessCoordinator(queryClient, { debounceMs: 100 });
    coordinator.setStore(storeId);
    const queryKey = ["customers", "detail", "customer_1", "store", storeId] as const;
    let resolveQuery: ((value: { version: number }) => void) | undefined;
    const queryFn = vi.fn(
      () =>
        new Promise<{ version: number }>((resolve) => {
          resolveQuery = resolve;
        }),
    );

    const prefetch = coordinator.prefetch({
      group: "customers.all",
      queryKey,
      queryFn,
      staleTime: 30_000,
    });
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    coordinator.handleRealtimeEvent(createEvent("evt_customer", "customers", ["customers.all"]));
    resolveQuery?.({ version: 1 });
    await prefetch;

    expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    expect(queryClient.getQueryState(queryKey)?.error).toBeNull();
    coordinator.dispose();
  });

  it("uses the epoch guard when an in-flight prefetch cannot be cancelled", async () => {
    const queryClient = createQueryClient();
    vi.spyOn(queryClient, "cancelQueries").mockResolvedValue();
    const coordinator = new QueryFreshnessCoordinator(queryClient, { debounceMs: 100 });
    coordinator.setStore(storeId);
    const queryKey = ["customers", "detail", "customer_1", "store", storeId] as const;
    let resolveQuery: ((value: { version: number }) => void) | undefined;
    const queryFn = vi.fn(
      () =>
        new Promise<{ version: number }>((resolve) => {
          resolveQuery = resolve;
        }),
    );

    const prefetch = coordinator.prefetch({
      group: "customers.all",
      queryKey,
      queryFn,
      staleTime: 30_000,
    });
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    coordinator.handleRealtimeEvent(
      createEvent("evt_uncancellable", "customers", ["customers.all"]),
    );
    resolveQuery?.({ version: 1 });
    await prefetch;

    expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    expect(queryClient.getQueryState(queryKey)?.error).toBeInstanceOf(StalePreloadError);
    coordinator.dispose();
  });

  it("does not restore a mutation snapshot after a newer realtime event", () => {
    const queryClient = createQueryClient();
    const coordinator = new QueryFreshnessCoordinator(queryClient, { debounceMs: 100 });
    coordinator.setStore(storeId);
    const guard = coordinator.beginMutation(["orders.all"]);

    expect(coordinator.canRestoreMutationSnapshot(guard)).toBe(true);
    coordinator.handleRealtimeEvent(createEvent("evt_remote"));
    expect(coordinator.canRestoreMutationSnapshot(guard)).toBe(false);

    coordinator.endMutation(guard);
    coordinator.dispose();
  });

  it("ignores old-store events after the active store changes", () => {
    const queryClient = createQueryClient();
    const coordinator = new QueryFreshnessCoordinator(queryClient);
    coordinator.setStore(storeId);
    coordinator.setStore(otherStoreId);

    expect(coordinator.handleRealtimeEvent(createEvent("evt_old_store"))).toBe(false);
    expect(
      coordinator.handleRealtimeEvent({
        ...createEvent("evt_new_store"),
        storeId: otherStoreId,
      }),
    ).toBe(true);
    coordinator.dispose();
  });

  it("invalidates unscoped legacy keys without touching another store cache", async () => {
    const queryClient = createQueryClient();
    const coordinator = new QueryFreshnessCoordinator(queryClient);
    const unscopedKey = ["orders", "stats"] as const;
    const currentStoreKey = ["orders", "queue-summary", "store", storeId] as const;
    const otherStoreKey = ["orders", "queue-summary", "store", otherStoreId] as const;
    queryClient.setQueryData(unscopedKey, { total: 1 });
    queryClient.setQueryData(currentStoreKey, { total: 1 });
    queryClient.setQueryData(otherStoreKey, { total: 1 });
    coordinator.setStore(storeId);

    coordinator.handleRealtimeEvent(createEvent("evt_scoped"));
    await coordinator.flushNow();

    expect(queryClient.getQueryState(unscopedKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(currentStoreKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherStoreKey)?.isInvalidated).toBe(false);
    coordinator.dispose();
  });

  it("marks an inactive query stale without fetching it in the background", async () => {
    const queryClient = createQueryClient();
    const queryFn = vi.fn().mockResolvedValue({ version: 1 });
    const queryKey = ["orders", "queue-summary", "store", storeId] as const;
    await queryClient.prefetchQuery({ queryKey, queryFn });
    queryFn.mockClear();
    const coordinator = new QueryFreshnessCoordinator(queryClient);
    coordinator.setStore(storeId);

    coordinator.handleRealtimeEvent(createEvent("evt_inactive"));
    await coordinator.flushNow();

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
    coordinator.dispose();
  });
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createEvent(
  eventId: string,
  domain: RepairDeskRealtimeEvent["domain"] = "orders",
  queryGroups: RepairDeskRealtimeEvent["queryGroups"] = ["orders.all"],
): RepairDeskRealtimeEvent {
  return {
    schemaVersion: 1,
    eventId,
    emittedAt: "2026-07-10T21:00:00.000Z",
    storeId,
    domain,
    mutation: "updated",
    queryGroups,
  };
}
