import type {
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineOutboxStatus,
  RepairDeskOfflineResult,
  RepairDeskOfflineScope,
  RepairDeskOfflineSyncMeta,
} from "./offline-types";
import type { RepairDeskOfflineStore } from "./offline-store";

export type RepairDeskOfflineOutboxSyncPreflight = {
  online: boolean;
  authenticated: boolean;
  reason?: string;
};

export type RepairDeskOfflineOutboxSyncHandlerResult =
  | { status: "synced"; serverOrderId?: string }
  | { status: "conflict" }
  | { status: "blocked" }
  | { status: "retryable_error" };

export type RepairDeskOfflineOutboxSyncItemOutcome =
  | "synced"
  | "conflict"
  | "blocked"
  | "sync_failed";

export type RepairDeskOfflineOutboxSyncItemResult = {
  operationId: string;
  action: RepairDeskOfflineOutboxEntry["action"];
  outcome: RepairDeskOfflineOutboxSyncItemOutcome;
  previousStatus: RepairDeskOfflineOutboxStatus;
  nextStatus: RepairDeskOfflineOutboxStatus;
};

export type RepairDeskOfflineOutboxSyncRunStatus =
  | "disabled"
  | "in_flight"
  | "preflight_failed"
  | "idle"
  | "completed";

export type RepairDeskOfflineOutboxSyncRunResult = {
  status: RepairDeskOfflineOutboxSyncRunStatus;
  reason?: string;
  processedCount: number;
  skippedCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  blockedCount: number;
  items: RepairDeskOfflineOutboxSyncItemResult[];
};

export type RepairDeskOfflineOutboxSyncRunnerOptions = {
  store: RepairDeskOfflineStore;
  scope: RepairDeskOfflineScope;
  enabled?: boolean;
  maxEntries?: number;
  metaId?: string;
  now?: () => string;
  checkApiHealth?: () => Promise<RepairDeskOfflineResult<RepairDeskOfflineOutboxSyncPreflight>>;
  getCurrentScope?: () => Promise<RepairDeskOfflineResult<RepairDeskOfflineScope | null>>;
  syncOrder?: (
    entry: RepairDeskOfflineOutboxEntry,
  ) => Promise<RepairDeskOfflineOutboxSyncHandlerResult>;
};

export type RepairDeskOfflineOutboxSyncRunner = {
  runOnce(): Promise<RepairDeskOfflineResult<RepairDeskOfflineOutboxSyncRunResult>>;
};

const reviewRequiredMessage = "Offline item requires review before sync.";
const conflictMessage = "Server data changed. Manual conflict resolution is required.";
const retryableFailureMessage = "Offline sync failed. Retry when connection is stable.";
const unsafeSyncPayloadKeyFragments = [
  "accessrequest",
  "approval",
  "attachment",
  "cancel",
  "capture",
  "delete",
  "inventory",
  "member",
  "message",
  "paid",
  "payment",
  "role",
  "setting",
  "sms",
  "status",
  "stock",
  "transition",
  "upload",
  "whatsapp",
  "workflow",
] as const;

export function createRepairDeskOfflineOutboxSyncRunner({
  store,
  scope,
  enabled = false,
  maxEntries = 25,
  metaId = `outbox:${scope.storeId}:${scope.userId}`,
  now = () => new Date().toISOString(),
  checkApiHealth,
  getCurrentScope,
  syncOrder,
}: RepairDeskOfflineOutboxSyncRunnerOptions): RepairDeskOfflineOutboxSyncRunner {
  let inFlight = false;

  return {
    async runOnce() {
      if (inFlight) {
        return success(emptyRun("in_flight", "Offline outbox sync is already running."));
      }
      inFlight = true;
      try {
        return await runOnceInternal();
      } finally {
        inFlight = false;
      }
    },
  };

  async function runOnceInternal(): Promise<
    RepairDeskOfflineResult<RepairDeskOfflineOutboxSyncRunResult>
  > {
    if (!enabled) {
      return success(emptyRun("disabled", "Offline outbox sync is disabled."));
    }

    const storage = await store.healthCheck();
    if (!storage.ok) return storage;
    if (!storage.value.available) {
      return {
        ok: false as const,
        error: storage.value.error ?? {
          code: "storage_unavailable",
          message: "RepairDesk offline storage is unavailable.",
        },
      };
    }

    const preflight = await runPreflight({
      checkApiHealth,
      getCurrentScope,
      scope,
    });
    if (!preflight.ok) return preflight;
    if (!preflight.value.ready) {
      const result = emptyRun("preflight_failed", preflight.value.reason);
      const meta = await updateSyncMeta(store, {
        metaId,
        scope,
        nowIso: now(),
        online: preflight.value.online,
        authenticated: preflight.value.authenticated,
      });
      if (!meta.ok) return meta;
      return success(result);
    }

    if (!syncOrder) {
      const result = emptyRun("preflight_failed", "Offline outbox sync handler is unavailable.");
      const meta = await updateSyncMeta(store, {
        metaId,
        scope,
        nowIso: now(),
        online: true,
        authenticated: true,
      });
      if (!meta.ok) return meta;
      return success(result);
    }

    const [pending, failed] = await Promise.all([
      store.listOutboxEntries({ ...scope, status: "pending_sync" }),
      store.listOutboxEntries({ ...scope, status: "sync_failed" }),
    ]);
    if (!pending.ok) return pending;
    if (!failed.ok) return failed;
    const entries = [...pending.value, ...failed.value]
      .filter((entry) => entry.retryCount < 5)
      .sort(compareOutboxEntries)
      .slice(0, Math.max(0, maxEntries));
    if (entries.length === 0) {
      const meta = await updateSyncMeta(store, {
        metaId,
        scope,
        nowIso: now(),
        online: true,
        authenticated: true,
      });
      if (!meta.ok) return meta;
      return success(emptyRun("idle"));
    }

    const items: RepairDeskOfflineOutboxSyncItemResult[] = [];
    for (const entry of entries) {
      const prepared = await prepareEntryForSync(store, entry, now());
      if (!prepared.ok) return prepared;
      if (!prepared.value.ready) {
        items.push(prepared.value.item);
        continue;
      }

      let handlerResult: RepairDeskOfflineOutboxSyncHandlerResult;
      try {
        handlerResult = await syncOrder(prepared.value.entry);
      } catch {
        handlerResult = { status: "retryable_error" };
      }

      const finalized = await finalizeEntry(store, prepared.value.entry, handlerResult);
      if (!finalized.ok) return finalized;
      items.push(finalized.value);
    }

    const meta = await updateSyncMeta(store, {
      metaId,
      scope,
      nowIso: now(),
      online: true,
      authenticated: true,
    });
    if (!meta.ok) return meta;

    return success(resultFromItems(items));
  }
}

async function runPreflight({
  checkApiHealth,
  getCurrentScope,
  scope,
}: {
  checkApiHealth?: () => Promise<RepairDeskOfflineResult<RepairDeskOfflineOutboxSyncPreflight>>;
  getCurrentScope?: () => Promise<RepairDeskOfflineResult<RepairDeskOfflineScope | null>>;
  scope: RepairDeskOfflineScope;
}): Promise<
  RepairDeskOfflineResult<{
    ready: boolean;
    online: boolean;
    authenticated: boolean;
    reason?: string;
  }>
> {
  if (!checkApiHealth) {
    return success({
      ready: false,
      online: false,
      authenticated: false,
      reason: "Offline outbox sync requires an injected API health check.",
    });
  }

  const api = await checkApiHealth();
  if (!api.ok) return api;
  if (!api.value.online || !api.value.authenticated) {
    return success({
      ready: false,
      online: api.value.online,
      authenticated: api.value.authenticated,
      reason: "Offline outbox sync preflight failed.",
    });
  }

  if (!getCurrentScope) {
    return success({
      ready: false,
      online: true,
      authenticated: true,
      reason: "Offline outbox sync requires an injected active scope check.",
    });
  }

  const current = await getCurrentScope();
  if (!current.ok) return current;
  if (!current.value || !sameScope(current.value, scope)) {
    return success({
      ready: false,
      online: true,
      authenticated: true,
      reason: "Offline outbox sync scope does not match the active store/user.",
    });
  }

  return success({ ready: true, online: true, authenticated: true });
}

async function prepareEntryForSync(
  store: RepairDeskOfflineStore,
  entry: RepairDeskOfflineOutboxEntry,
  nowIso: string,
): Promise<
  RepairDeskOfflineResult<
    | { ready: true; entry: RepairDeskOfflineOutboxEntry }
    | { ready: false; item: RepairDeskOfflineOutboxSyncItemResult }
  >
> {
  const blockedReason = localBlockReason(entry);
  if (blockedReason) {
    const blocked = await putEntry(store, {
      ...entry,
      status: blockedReason.status,
      lastAttemptAt: nowIso,
      lastError: blockedReason.message,
    });
    if (!blocked.ok) return blocked;
    return success({
      ready: false,
      item: {
        operationId: entry.operationId,
        action: entry.action,
        outcome: blockedReason.outcome,
        previousStatus: entry.status,
        nextStatus: blocked.value.status,
      },
    });
  }

  const syncing = await putEntry(store, {
    ...entry,
    status: "syncing",
    lastAttemptAt: nowIso,
    retryCount: entry.retryCount + 1,
    lastError: undefined,
  });
  if (!syncing.ok) return syncing;
  return success({ ready: true, entry: syncing.value });
}

function localBlockReason(entry: RepairDeskOfflineOutboxEntry): {
  status: Extract<RepairDeskOfflineOutboxStatus, "blocked" | "sensitive_locked">;
  outcome: Extract<RepairDeskOfflineOutboxSyncItemOutcome, "blocked">;
  message: string;
} | null {
  if (entry.status === "blocked" || entry.relationshipPlan.requiresReview) {
    return {
      status: "blocked",
      outcome: "blocked",
      message: reviewRequiredMessage,
    };
  }
  if (entry.status === "sensitive_locked" || entry.sensitiveVaultEntryIds.length > 0) {
    return {
      status: "sensitive_locked",
      outcome: "blocked",
      message: reviewRequiredMessage,
    };
  }
  if (entry.attachmentStagingIds.length > 0) {
    return {
      status: "blocked",
      outcome: "blocked",
      message: reviewRequiredMessage,
    };
  }
  if (
    entry.relationshipPlan.customerLinkMode === "unknown_needs_review" ||
    entry.relationshipPlan.deviceLinkMode === "unknown_device_needs_review"
  ) {
    return {
      status: "blocked",
      outcome: "blocked",
      message: reviewRequiredMessage,
    };
  }
  if (containsUnsafeSyncPayloadKey(entry.payload)) {
    return {
      status: "blocked",
      outcome: "blocked",
      message: reviewRequiredMessage,
    };
  }
  if (entry.action === "update" && (!entry.serverOrderId?.trim() || !entry.baseUpdatedAt)) {
    return {
      status: "blocked",
      outcome: "blocked",
      message: reviewRequiredMessage,
    };
  }
  return null;
}

async function finalizeEntry(
  store: RepairDeskOfflineStore,
  entry: RepairDeskOfflineOutboxEntry,
  result: RepairDeskOfflineOutboxSyncHandlerResult,
): Promise<RepairDeskOfflineResult<RepairDeskOfflineOutboxSyncItemResult>> {
  switch (result.status) {
    case "synced": {
      const synced = await putEntry(store, {
        ...entry,
        serverOrderId: result.serverOrderId ?? entry.serverOrderId,
        status: "synced",
        lastError: undefined,
      });
      if (!synced.ok) return synced;
      return success(itemResult(entry, synced.value, "synced"));
    }
    case "conflict": {
      const conflict = await putEntry(store, {
        ...entry,
        status: "conflict",
        lastError: conflictMessage,
      });
      if (!conflict.ok) return conflict;
      return success(itemResult(entry, conflict.value, "conflict"));
    }
    case "blocked": {
      const blocked = await putEntry(store, {
        ...entry,
        status: "blocked",
        lastError: reviewRequiredMessage,
      });
      if (!blocked.ok) return blocked;
      return success(itemResult(entry, blocked.value, "blocked"));
    }
    case "retryable_error": {
      const failed = await putEntry(store, {
        ...entry,
        status: "sync_failed",
        lastError: retryableFailureMessage,
      });
      if (!failed.ok) return failed;
      return success(itemResult(entry, failed.value, "sync_failed"));
    }
  }
}

async function putEntry(store: RepairDeskOfflineStore, entry: RepairDeskOfflineOutboxEntry) {
  return store.putOutboxEntry(entry);
}

async function updateSyncMeta(
  store: RepairDeskOfflineStore,
  {
    metaId,
    scope,
    nowIso,
    online,
    authenticated,
  }: {
    metaId: string;
    scope: RepairDeskOfflineScope;
    nowIso: string;
    online: boolean;
    authenticated: boolean;
  },
): Promise<RepairDeskOfflineResult<RepairDeskOfflineSyncMeta>> {
  const pending = await store.listOutboxEntries({ ...scope, status: "pending_sync" });
  if (!pending.ok) return pending;
  const failed = await store.listOutboxEntries({ ...scope, status: "sync_failed" });
  if (!failed.ok) return failed;
  const conflicts = await store.listOutboxEntries({ ...scope, status: "conflict" });
  if (!conflicts.ok) return conflicts;

  return store.putSyncMeta({
    metaId,
    storeId: scope.storeId,
    userId: scope.userId,
    onlineState: online ? (authenticated ? "online" : "degraded") : "offline",
    lastApiHealthOkAt: online && authenticated ? nowIso : undefined,
    lastOutboxRunAt: nowIso,
    pendingCount:
      pending.value.length + failed.value.filter((entry) => entry.retryCount < 5).length,
    conflictCount: conflicts.value.length,
    updatedAt: nowIso,
  });
}

function itemResult(
  previous: RepairDeskOfflineOutboxEntry,
  next: RepairDeskOfflineOutboxEntry,
  outcome: RepairDeskOfflineOutboxSyncItemOutcome,
): RepairDeskOfflineOutboxSyncItemResult {
  return {
    operationId: previous.operationId,
    action: previous.action,
    outcome,
    previousStatus: previous.status,
    nextStatus: next.status,
  };
}

function resultFromItems(
  items: RepairDeskOfflineOutboxSyncItemResult[],
): RepairDeskOfflineOutboxSyncRunResult {
  return {
    status: "completed",
    processedCount: items.length,
    skippedCount: 0,
    syncedCount: countItems(items, "synced"),
    failedCount: countItems(items, "sync_failed"),
    conflictCount: countItems(items, "conflict"),
    blockedCount: countItems(items, "blocked"),
    items,
  };
}

function emptyRun(
  status: RepairDeskOfflineOutboxSyncRunStatus,
  reason?: string,
): RepairDeskOfflineOutboxSyncRunResult {
  return {
    status,
    reason,
    processedCount: 0,
    skippedCount: 0,
    syncedCount: 0,
    failedCount: 0,
    conflictCount: 0,
    blockedCount: 0,
    items: [],
  };
}

function countItems(items: RepairDeskOfflineOutboxSyncItemResult[], outcome: string) {
  return items.filter((item) => item.outcome === outcome).length;
}

function compareOutboxEntries(
  left: RepairDeskOfflineOutboxEntry,
  right: RepairDeskOfflineOutboxEntry,
) {
  const byCreatedAt = left.createdAtLocal.localeCompare(right.createdAtLocal);
  if (byCreatedAt !== 0) return byCreatedAt;
  return left.operationId.localeCompare(right.operationId);
}

function sameScope(left: RepairDeskOfflineScope, right: RepairDeskOfflineScope) {
  return left.storeId === right.storeId && left.userId === right.userId;
}

function containsUnsafeSyncPayloadKey(input: unknown): boolean {
  if (Array.isArray(input)) return input.some((value) => containsUnsafeSyncPayloadKey(value));
  if (!isRecord(input)) return false;

  return Object.entries(input).some(([key, value]) => {
    const normalized = normalizePayloadKey(key);
    if (normalized === "orderstatus" && value === "new") return false;
    return (
      unsafeSyncPayloadKeyFragments.some((fragment) => normalized.includes(fragment)) ||
      containsUnsafeSyncPayloadKey(value)
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePayloadKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function success<T>(value: T): RepairDeskOfflineResult<T> {
  return { ok: true, value };
}
