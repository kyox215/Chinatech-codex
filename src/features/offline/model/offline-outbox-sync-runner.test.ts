import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createRepairDeskOfflineOutboxSyncRunner } from "./offline-outbox-sync-runner";
import { createRepairDeskOfflineMemoryStore } from "./offline-store";
import type {
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineOutboxStatus,
  RepairDeskOfflineRelationshipPlan,
  RepairDeskOfflineResult,
  RepairDeskOfflineScope,
} from "./offline-types";

const storeId = "store_1";
const userId = "user_1";
const scope = { storeId, userId };
const now = "2026-07-06T22:55:00.000Z";

describe("RepairDesk offline outbox sync runner", () => {
  it("stays disabled by default and does not touch pending entries", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry());
    const syncOrder = vi.fn();
    const runner = createRepairDeskOfflineOutboxSyncRunner({
      store,
      scope,
      syncOrder,
    });

    const result = await runner.runOnce();

    expect(result.ok && result.value.status).toBe("disabled");
    expect(syncOrder).not.toHaveBeenCalled();
    await expect(store.getOutboxEntry("op_1", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "pending_sync", retryCount: 0 },
    });
  });

  it("requires injected API health and active scope checks before syncing", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry());
    const syncOrder = vi.fn();
    const runner = createRepairDeskOfflineOutboxSyncRunner({
      store,
      scope,
      enabled: true,
      now: () => now,
      syncOrder,
    });

    const result = await runner.runOnce();

    expect(result.ok && result.value.status).toBe("preflight_failed");
    expect(syncOrder).not.toHaveBeenCalled();
    await expect(store.getOutboxEntry("op_1", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "pending_sync", retryCount: 0 },
    });
    await expect(store.getSyncMeta("outbox:store_1:user_1", scope)).resolves.toMatchObject({
      ok: true,
      value: {
        onlineState: "offline",
        pendingCount: 1,
        conflictCount: 0,
        lastOutboxRunAt: now,
      },
    });
  });

  it("does not sync when the active store or user no longer matches", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry());
    const syncOrder = vi.fn();

    const result = await createRunner(store, {
      syncOrder,
      getCurrentScope: async () => success({ storeId: "store_2", userId }),
    }).runOnce();

    expect(result.ok && result.value.status).toBe("preflight_failed");
    expect(result.ok && result.value.reason).toContain("scope");
    expect(syncOrder).not.toHaveBeenCalled();
    await expect(store.getOutboxEntry("op_1", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "pending_sync", retryCount: 0 },
    });
  });

  it("syncs create entries through an injected handler and stores only status metadata", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry());

    const result = await createRunner(store, {
      syncOrder: async () => ({ status: "synced", serverOrderId: "order_1" }),
    }).runOnce();

    expect(result.ok && result.value).toMatchObject({
      status: "completed",
      processedCount: 1,
      syncedCount: 1,
      failedCount: 0,
      conflictCount: 0,
      blockedCount: 0,
      items: [
        {
          operationId: "op_1",
          action: "create",
          outcome: "synced",
          previousStatus: "syncing",
          nextStatus: "synced",
        },
      ],
    });
    expect(JSON.stringify(result.ok && result.value)).not.toContain("Mario");
    expect(JSON.stringify(result.ok && result.value)).not.toContain("+39");
    await expect(store.getOutboxEntry("op_1", scope)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "synced",
        serverOrderId: "order_1",
        lastAttemptAt: now,
        retryCount: 1,
        lastError: undefined,
      },
    });
    await expect(store.getSyncMeta("outbox:store_1:user_1", scope)).resolves.toMatchObject({
      ok: true,
      value: {
        onlineState: "online",
        lastApiHealthOkAt: now,
        lastOutboxRunAt: now,
        pendingCount: 0,
        conflictCount: 0,
      },
    });
  });

  it("classifies injected conflict and retryable failures without deleting entries", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(
      outboxEntry({
        operationId: "op_conflict",
        action: "update",
        serverOrderId: "order_1",
        baseUpdatedAt: "2026-07-06T20:00:00.000Z",
      }),
    );
    await store.putOutboxEntry(outboxEntry({ operationId: "op_retry" }));

    const result = await createRunner(store, {
      syncOrder: async (entry) =>
        entry.operationId === "op_conflict"
          ? { status: "conflict" }
          : { status: "retryable_error" },
    }).runOnce();

    expect(result.ok && result.value).toMatchObject({
      processedCount: 2,
      syncedCount: 0,
      failedCount: 1,
      conflictCount: 1,
    });
    await expect(store.getOutboxEntry("op_conflict", scope)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "conflict",
        lastError: "Server data changed. Manual conflict resolution is required.",
        retryCount: 1,
      },
    });
    await expect(store.getOutboxEntry("op_retry", scope)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "sync_failed",
        lastError: "Offline sync failed. Retry when connection is stable.",
        retryCount: 1,
      },
    });
  });

  it("turns handler exceptions into retryable local failures without storing thrown text", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry());

    const result = await createRunner(store, {
      syncOrder: async () => {
        throw new Error("raw server text with phone +39 333 000 0000");
      },
    }).runOnce();

    expect(result.ok && result.value.failedCount).toBe(1);
    const stored = await store.getOutboxEntry("op_1", scope);
    expect(stored.ok && stored.value?.lastError).toBe(
      "Offline sync failed. Retry when connection is stable.",
    );
    expect(stored.ok && stored.value?.lastError).not.toContain("+39");
  });

  it("blocks review, sensitive, and attachment-gated pending entries before handler execution", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(
      outboxEntry({
        operationId: "op_review",
        relationshipPlan: {
          ...walkInRelationship(),
          requiresReview: true,
          reviewReason: "customer_device_relationship",
        },
      }),
    );
    await store.putOutboxEntry(
      outboxEntry({ operationId: "op_sensitive", sensitiveVaultEntryIds: ["vault_1"] }),
    );
    await store.putOutboxEntry(
      outboxEntry({ operationId: "op_attachment", attachmentStagingIds: ["attachment_1"] }),
    );
    const syncOrder = vi.fn();

    const result = await createRunner(store, { syncOrder }).runOnce();

    expect(syncOrder).not.toHaveBeenCalled();
    expect(result.ok && result.value).toMatchObject({
      processedCount: 3,
      blockedCount: 3,
      syncedCount: 0,
    });
    await expect(store.getOutboxEntry("op_review", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "blocked", lastError: "Offline item requires review before sync." },
    });
    await expect(store.getOutboxEntry("op_sensitive", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "sensitive_locked", lastError: "Offline item requires review before sync." },
    });
    await expect(store.getOutboxEntry("op_attachment", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "blocked", lastError: "Offline item requires review before sync." },
    });
  });

  it("blocks unknown relationships and high-risk payload keys before handler execution", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(
      outboxEntry({
        operationId: "op_unknown",
        relationshipPlan: {
          customerLinkMode: "unknown_needs_review",
          deviceLinkMode: "unknown_device_needs_review",
        },
      }),
    );
    await store.putOutboxEntry(
      outboxEntry({
        operationId: "op_status",
        payload: safePayload({ orderStatus: "ready_for_pickup" }),
      }),
    );
    await store.putOutboxEntry(
      outboxEntry({
        operationId: "op_payment",
        payload: safePayload({ paymentCaptured: true }),
      }),
    );
    await store.putOutboxEntry(
      outboxEntry({
        operationId: "op_message",
        payload: safePayload({ whatsappMessage: "ready" }),
      }),
    );
    const syncOrder = vi.fn();

    const result = await createRunner(store, { syncOrder }).runOnce();

    expect(syncOrder).not.toHaveBeenCalled();
    expect(result.ok && result.value).toMatchObject({
      processedCount: 4,
      blockedCount: 4,
      syncedCount: 0,
    });
    for (const operationId of ["op_unknown", "op_status", "op_payment", "op_message"]) {
      await expect(store.getOutboxEntry(operationId, scope)).resolves.toMatchObject({
        ok: true,
        value: { status: "blocked", lastError: "Offline item requires review before sync." },
      });
    }
  });

  it("ignores non-pending in-flight entries during a run", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry({ status: "syncing" }));
    const syncOrder = vi.fn();

    const result = await createRunner(store, { syncOrder }).runOnce();

    expect(result.ok && result.value.status).toBe("idle");
    expect(syncOrder).not.toHaveBeenCalled();
  });

  it("prevents overlapping runs from submitting the same entry twice", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOutboxEntry(outboxEntry());
    const release = deferred<void>();
    const syncOrder = vi.fn(async () => {
      await release.promise;
      return { status: "synced" as const, serverOrderId: "order_1" };
    });
    const runner = createRunner(store, { syncOrder });

    const first = runner.runOnce();
    const second = await runner.runOnce();
    release.resolve();
    const firstResult = await first;

    expect(second.ok && second.value.status).toBe("in_flight");
    expect(firstResult.ok && firstResult.value.syncedCount).toBe(1);
    expect(syncOrder).toHaveBeenCalledTimes(1);
  });

  it("does not import UI, API, realtime, server, or network clients", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/offline/model/offline-outbox-sync-runner.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/@\/lib\/repairdesk\/api/);
    expect(source).not.toMatch(/src\/lib\/repairdesk\/api/);
    expect(source).not.toMatch(/src\/server/);
    expect(source).not.toMatch(/@supabase/);
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/WebSocket/);
    expect(source).not.toMatch(/EventSource/);
    expect(source).not.toMatch(/sendBeacon/);
    expect(source).not.toMatch(/realtime/i);
    expect(source).not.toMatch(/src\/features\/realtime/);
    expect(source).not.toMatch(/src\/features\/orders\/screens/);
  });
});

function createRunner(
  store: ReturnType<typeof createRepairDeskOfflineMemoryStore>,
  overrides: Partial<Parameters<typeof createRepairDeskOfflineOutboxSyncRunner>[0]> = {},
) {
  return createRepairDeskOfflineOutboxSyncRunner({
    store,
    scope,
    enabled: true,
    now: () => now,
    checkApiHealth: async () => success({ online: true, authenticated: true }),
    getCurrentScope: async () => success(scope),
    syncOrder: async () => ({ status: "synced", serverOrderId: "order_1" }),
    ...overrides,
  });
}

function outboxEntry(
  overrides: Partial<RepairDeskOfflineOutboxEntry> = {},
): RepairDeskOfflineOutboxEntry {
  return {
    operationId: "op_1",
    localOrderId: "local_order_1",
    storeId,
    userId,
    domain: "orders",
    action: "create",
    payload: safePayload(),
    relationshipPlan: walkInRelationship(),
    createdAtLocal: now,
    retryCount: 0,
    status: "pending_sync",
    sensitiveVaultEntryIds: [],
    attachmentStagingIds: [],
    ...overrides,
  };
}

function safePayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Mario Rossi",
    customerPhone: "+39 333 000 0000",
    deviceBrand: "Apple",
    deviceModel: "iPhone 14",
    issueDescription: "Broken screen",
    quotedPriceCents: 12900,
    ...overrides,
  };
}

function walkInRelationship(): RepairDeskOfflineRelationshipPlan {
  return {
    customerLinkMode: "walk_in_snapshot_only",
    deviceLinkMode: "order_snapshot_only",
  };
}

function success<T>(value: T): RepairDeskOfflineResult<T> {
  return { ok: true, value };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
