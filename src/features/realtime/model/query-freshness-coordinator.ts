import type { QueryClient, QueryFilters, QueryFunction, QueryKey } from "@tanstack/react-query";

import {
  getRepairDeskRealtimeInvalidationTargets,
  getRepairDeskRealtimeQueryGroupsForDomain,
  getRepairDeskRealtimeQueryKeyForGroup,
  type RepairDeskRealtimeInvalidationTarget,
} from "./query-invalidation-map";
import {
  repairDeskRealtimeQueryGroups,
  type RepairDeskRealtimeDomain,
  type RepairDeskRealtimeEvent,
  type RepairDeskRealtimeQueryGroup,
} from "./realtime-events";

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_EVENT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_SEEN_EVENTS = 256;

export class StalePreloadError extends Error {
  constructor() {
    super("Preloaded data became stale before it could enter the query cache.");
    this.name = "StalePreloadError";
  }
}

export type QueryFreshnessMutationGuard = {
  readonly groups: readonly RepairDeskRealtimeQueryGroup[];
  readonly groupEpochs: ReadonlyMap<RepairDeskRealtimeQueryGroup, number>;
  readonly storeEpoch: number;
};

export type CoordinatedPrefetchInput<TQueryFnData, TQueryKey extends QueryKey = QueryKey> = {
  group: RepairDeskRealtimeQueryGroup;
  queryKey: TQueryKey;
  queryFn: QueryFunction<TQueryFnData, TQueryKey>;
  staleTime?: number;
  gcTime?: number;
};

export type QueryFreshnessCoordinatorOptions = {
  debounceMs?: number;
  eventTtlMs?: number;
  maxSeenEvents?: number;
  now?: () => number;
  onFlush?: (groups: readonly RepairDeskRealtimeQueryGroup[]) => void;
};

export class QueryFreshnessCoordinator {
  private readonly debounceMs: number;
  private readonly eventTtlMs: number;
  private readonly maxSeenEvents: number;
  private readonly now: () => number;
  private readonly onFlush?: QueryFreshnessCoordinatorOptions["onFlush"];
  private readonly groupEpochs = new Map<RepairDeskRealtimeQueryGroup, number>();
  private readonly mutationCounts = new Map<RepairDeskRealtimeQueryGroup, number>();
  private readonly pendingTargets = new Map<
    RepairDeskRealtimeQueryGroup,
    RepairDeskRealtimeInvalidationTarget
  >();
  private readonly preparationByGroup = new Map<RepairDeskRealtimeQueryGroup, Promise<void>>();
  private readonly seenEventIds = new Map<string, number>();
  private releasedMutationGuards = new WeakSet<QueryFreshnessMutationGuard>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private online = true;
  private storeEpoch = 0;
  private storeId: string | null = null;

  constructor(
    private readonly queryClient: QueryClient,
    options: QueryFreshnessCoordinatorOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.eventTtlMs = options.eventTtlMs ?? DEFAULT_EVENT_TTL_MS;
    this.maxSeenEvents = options.maxSeenEvents ?? DEFAULT_MAX_SEEN_EVENTS;
    this.now = options.now ?? Date.now;
    this.onFlush = options.onFlush;
  }

  setStore(storeId?: string | null) {
    const nextStoreId = storeId ?? null;
    if (nextStoreId === this.storeId) return;

    const previousStoreId = this.storeId;
    if (previousStoreId) {
      for (const group of repairDeskRealtimeQueryGroups) {
        const target = this.createTarget(group, previousStoreId);
        void this.queryClient.cancelQueries(this.getFilters(target, previousStoreId), {
          silent: true,
        });
      }
    }

    this.storeEpoch += 1;
    this.storeId = nextStoreId;
    this.groupEpochs.clear();
    this.mutationCounts.clear();
    this.pendingTargets.clear();
    this.preparationByGroup.clear();
    this.seenEventIds.clear();
    this.releasedMutationGuards = new WeakSet<QueryFreshnessMutationGuard>();
    this.clearFlushTimer();
  }

  setOnline(online: boolean) {
    if (this.online === online) return;
    this.online = online;
    if (!online) {
      void this.queryClient.cancelQueries(
        { type: "inactive", fetchStatus: "fetching" },
        {
          silent: true,
        },
      );
    }
  }

  handleRealtimeEvent(event: RepairDeskRealtimeEvent) {
    if (!this.storeId || event.storeId !== this.storeId || this.hasSeenEvent(event.eventId)) {
      return false;
    }

    this.rememberEvent(event.eventId);
    this.markTargetsDirty(getRepairDeskRealtimeInvalidationTargets(event), event.storeId);
    return true;
  }

  markGroupsDirty(groups: readonly RepairDeskRealtimeQueryGroup[]) {
    if (!this.storeId) return;
    const targets = uniqueGroups(groups).map((group) => this.createTarget(group, this.storeId!));
    this.markTargetsDirty(targets, this.storeId);
  }

  markDomainDirty(domain: RepairDeskRealtimeDomain) {
    this.markGroupsDirty(getRepairDeskRealtimeQueryGroupsForDomain(domain));
  }

  markAllDomainsDirty() {
    this.markGroupsDirty(repairDeskRealtimeQueryGroups);
  }

  async refreshGroups(groups: readonly RepairDeskRealtimeQueryGroup[]) {
    this.markGroupsDirty(groups);
    await this.flushNow();
  }

  beginMutation(groups: readonly RepairDeskRealtimeQueryGroup[]): QueryFreshnessMutationGuard {
    const unique = uniqueGroups(groups);
    unique.forEach((group) => {
      this.mutationCounts.set(group, (this.mutationCounts.get(group) ?? 0) + 1);
    });

    return {
      groups: unique,
      groupEpochs: new Map(unique.map((group) => [group, this.getGroupEpoch(group)])),
      storeEpoch: this.storeEpoch,
    };
  }

  canRestoreMutationSnapshot(guard?: QueryFreshnessMutationGuard | null) {
    if (!guard || this.releasedMutationGuards.has(guard) || guard.storeEpoch !== this.storeEpoch) {
      return false;
    }
    return guard.groups.every(
      (group) => guard.groupEpochs.get(group) === this.getGroupEpoch(group),
    );
  }

  endMutation(guard?: QueryFreshnessMutationGuard | null) {
    if (!guard || this.releasedMutationGuards.has(guard)) return;
    this.releasedMutationGuards.add(guard);
    guard.groups.forEach((group) => {
      const next = Math.max(0, (this.mutationCounts.get(group) ?? 0) - 1);
      if (next > 0) this.mutationCounts.set(group, next);
      else this.mutationCounts.delete(group);
    });
    this.scheduleFlush(0);
  }

  async prefetch<TQueryFnData, TQueryKey extends QueryKey = QueryKey>({
    group,
    queryKey,
    queryFn,
    staleTime,
    gcTime,
  }: CoordinatedPrefetchInput<TQueryFnData, TQueryKey>) {
    if (!this.online || !this.storeId || this.isMutationShielded(group)) return;

    const token = {
      groupEpoch: this.getGroupEpoch(group),
      storeEpoch: this.storeEpoch,
      storeId: this.storeId,
    };

    await this.queryClient.prefetchQuery({
      queryKey,
      queryFn: async (context) => {
        const data = await queryFn(context);
        if (
          token.storeId !== this.storeId ||
          token.storeEpoch !== this.storeEpoch ||
          token.groupEpoch !== this.getGroupEpoch(group)
        ) {
          throw new StalePreloadError();
        }
        return data;
      },
      staleTime,
      gcTime,
      retry: (failureCount, error) => !(error instanceof StalePreloadError) && failureCount < 1,
    });
  }

  async flushNow() {
    this.clearFlushTimer();
    if (!this.online || !this.storeId || this.pendingTargets.size === 0) return;
    const storeId = this.storeId;
    const storeEpoch = this.storeEpoch;

    const readyTargets = [...this.pendingTargets.values()].filter(
      ({ group }) => !this.isMutationShielded(group),
    );
    readyTargets.forEach(({ group }) => this.pendingTargets.delete(group));
    if (readyTargets.length === 0) return;

    await Promise.all(
      readyTargets.map(async (target) => {
        await this.preparationByGroup.get(target.group);
        this.preparationByGroup.delete(target.group);
        if (storeEpoch !== this.storeEpoch || storeId !== this.storeId) return;
        await this.queryClient.invalidateQueries(
          { ...this.getFilters(target, storeId), refetchType: "active" },
          { cancelRefetch: true },
        );
      }),
    );
    if (storeEpoch !== this.storeEpoch || storeId !== this.storeId) return;
    this.onFlush?.(readyTargets.map(({ group }) => group));

    if (this.pendingTargets.size > 0) this.scheduleFlush();
  }

  dispose() {
    this.clearFlushTimer();
    this.pendingTargets.clear();
    this.preparationByGroup.clear();
    this.seenEventIds.clear();
  }

  private markTargetsDirty(
    targets: readonly RepairDeskRealtimeInvalidationTarget[],
    storeId: string,
  ) {
    targets.forEach((target) => {
      this.bumpGroupEpoch(target.group);
      this.pendingTargets.set(target.group, target);
      const filters = this.getFilters(target, storeId);
      const preparation = this.queryClient
        .cancelQueries(filters, { silent: true })
        .then(() =>
          this.queryClient.invalidateQueries(
            { ...filters, refetchType: "none" },
            { cancelRefetch: true },
          ),
        );
      this.preparationByGroup.set(target.group, preparation);
    });
    this.scheduleFlush();
  }

  private createTarget(
    group: RepairDeskRealtimeQueryGroup,
    storeId: string,
  ): RepairDeskRealtimeInvalidationTarget {
    return {
      group,
      queryKey: getRepairDeskRealtimeQueryKeyForGroup(group, storeId),
    };
  }

  private getFilters(target: RepairDeskRealtimeInvalidationTarget, storeId: string): QueryFilters {
    return {
      queryKey: target.queryKey,
      predicate:
        target.group === "stores.context"
          ? undefined
          : (query) => queryKeyMatchesStore(query.queryKey, storeId),
    };
  }

  private getGroupEpoch(group: RepairDeskRealtimeQueryGroup) {
    return this.groupEpochs.get(group) ?? 0;
  }

  private bumpGroupEpoch(group: RepairDeskRealtimeQueryGroup) {
    this.groupEpochs.set(group, this.getGroupEpoch(group) + 1);
  }

  private isMutationShielded(group: RepairDeskRealtimeQueryGroup) {
    return (this.mutationCounts.get(group) ?? 0) > 0;
  }

  private scheduleFlush(delay = this.debounceMs) {
    if (this.flushTimer || !this.online) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushNow();
    }, delay);
  }

  private clearFlushTimer() {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private hasSeenEvent(eventId: string) {
    this.pruneSeenEvents();
    return this.seenEventIds.has(eventId);
  }

  private rememberEvent(eventId: string) {
    this.seenEventIds.set(eventId, this.now());
    this.pruneSeenEvents();
  }

  private pruneSeenEvents() {
    const oldestAllowed = this.now() - this.eventTtlMs;
    for (const [eventId, receivedAt] of this.seenEventIds) {
      if (receivedAt >= oldestAllowed && this.seenEventIds.size <= this.maxSeenEvents) break;
      this.seenEventIds.delete(eventId);
    }
  }
}

function queryKeyMatchesStore(queryKey: QueryKey, storeId: string) {
  let hasStoreScope = false;
  for (let index = 0; index < queryKey.length - 1; index += 1) {
    if (queryKey[index] !== "store") continue;
    hasStoreScope = true;
    if (queryKey[index + 1] === storeId) return true;
  }
  return !hasStoreScope;
}

function uniqueGroups(groups: readonly RepairDeskRealtimeQueryGroup[]) {
  return [...new Set(groups)];
}
