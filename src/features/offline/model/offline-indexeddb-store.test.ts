import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createRepairDeskIndexedDbOfflineStore } from "./offline-indexeddb-store";
import type {
  RepairDeskOfflineAttachmentStagingEntry,
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineSensitiveVaultEntry,
  RepairDeskOfflineStoreName,
  RepairDeskOfflineSyncMeta,
} from "./offline-types";
import { repairDeskOfflineStoreKeyPaths, repairDeskOfflineStoreNames } from "./offline-types";

const storeId = "store_1";
const userId = "user_1";
const scope = { storeId, userId };
const now = "2026-07-06T20:00:00.000Z";
const earlier = "2026-07-05T20:00:00.000Z";
const later = "2026-07-07T20:00:00.000Z";

describe("RepairDesk IndexedDB offline CRUD store", () => {
  it("performs order draft CRUD by active scope and status with clone semantics", async () => {
    const harness = createIndexedDbHarness();
    const store = harness.store;
    const draft = orderDraft({
      draftPayload: { issue_description: "Broken screen", nested: { safe: true } },
    });

    await expect(store.putOrderDraft(draft)).resolves.toEqual({ ok: true, value: draft });
    draft.draftPayload.issue_description = "caller mutation";

    const stored = await store.getOrderDraft("draft_1", scope);
    expect(stored.ok && stored.value?.draftPayload.issue_description).toBe("Broken screen");

    if (stored.ok && stored.value) {
      stored.value.draftPayload.issue_description = "returned mutation";
    }
    const storedAgain = await store.getOrderDraft("draft_1", scope);
    expect(storedAgain.ok && storedAgain.value?.draftPayload.issue_description).toBe(
      "Broken screen",
    );

    await store.putOrderDraft(orderDraft({ localDraftId: "draft_2", status: "discarded" }));
    const localDrafts = await store.listOrderDrafts({ ...scope, status: "draft_local" });
    expect(localDrafts.ok && localDrafts.value.map((entry) => entry.localDraftId)).toEqual([
      "draft_1",
    ]);
    expect(harness.database.indexReads).toContainEqual({
      storeName: "repairdesk_order_drafts",
      indexName: "by_scope_status",
      query: [storeId, userId, "draft_local"],
    });

    await expect(store.deleteOrderDraft("draft_1", scope)).resolves.toEqual({
      ok: true,
      value: true,
    });
    await expect(store.getOrderDraft("draft_1", scope)).resolves.toEqual({
      ok: true,
      value: null,
    });
    expect(harness.database.transactionLog).toContainEqual([
      "repairdesk_order_drafts",
      "readwrite",
    ]);
    expect(harness.database.close).toHaveBeenCalled();
  });

  it("enforces active store/user scope for reads, writes, lists, and deletes", async () => {
    const harness = createIndexedDbHarness();
    const store = harness.store;
    await store.putOrderDraft(orderDraft());

    const wrongWrite = await store.putOrderDraft(
      orderDraft({ localDraftId: "draft_2", storeId: "store_2" }),
    );
    expect(wrongWrite.ok).toBe(false);
    expect(!wrongWrite.ok && wrongWrite.error.code).toBe("context_mismatch");

    const wrongGet = await store.getOrderDraft("draft_1", { storeId: "store_2", userId });
    expect(wrongGet.ok).toBe(false);
    expect(!wrongGet.ok && wrongGet.error.code).toBe("context_mismatch");

    const openCallsBeforeWrongList = harness.openDatabase.mock.calls.length;
    await expect(store.listOrderDrafts({ storeId: "store_2", userId })).resolves.toEqual({
      ok: true,
      value: [],
    });
    expect(harness.openDatabase).toHaveBeenCalledTimes(openCallsBeforeWrongList);

    const wrongDelete = await store.deleteOrderDraft("draft_1", { storeId, userId: "user_2" });
    expect(wrongDelete.ok).toBe(false);
    expect(!wrongDelete.ok && wrongDelete.error.code).toBe("context_mismatch");
  });

  it("validates outbox entries and lists them through scoped status indexes", async () => {
    const harness = createIndexedDbHarness();
    const store = harness.store;

    const createEntry = outboxEntry({ action: "create" });
    const updateEntry = outboxEntry({
      operationId: "op_2",
      action: "update",
      serverOrderId: "order_1",
      baseUpdatedAt: now,
    });

    await expect(store.putOutboxEntry(createEntry)).resolves.toEqual({
      ok: true,
      value: createEntry,
    });
    await expect(store.putOutboxEntry(updateEntry)).resolves.toEqual({
      ok: true,
      value: updateEntry,
    });

    const staleUpdate = await store.putOutboxEntry(
      outboxEntry({ operationId: "op_3", action: "update", serverOrderId: "order_1" }),
    );
    expect(staleUpdate.ok).toBe(false);
    expect(!staleUpdate.ok && staleUpdate.error.code).toBe("validation_failed");

    const rawUnlock = await store.putOutboxEntry(
      outboxEntry({ operationId: "op_4", payload: { device_unlock_value: "1234" } }),
    );
    expect(rawUnlock.ok).toBe(false);
    expect(!rawUnlock.ok && rawUnlock.error.code).toBe("validation_failed");

    const missingServerOrder = await store.putOutboxEntry(
      outboxEntry({ operationId: "op_5", action: "update", baseUpdatedAt: now }),
    );
    expect(missingServerOrder.ok).toBe(false);
    expect(!missingServerOrder.ok && missingServerOrder.error.code).toBe("validation_failed");

    const pending = await store.listOutboxEntries({ ...scope, status: "pending_sync" });
    expect(pending.ok && pending.value.map((entry) => entry.operationId)).toEqual(["op_1", "op_2"]);
    expect(harness.database.indexReads).toContainEqual({
      storeName: "repairdesk_outbox",
      indexName: "by_scope_status",
      query: [storeId, userId, "pending_sync"],
    });

    await expect(store.deleteOutboxEntry("op_1", scope)).resolves.toEqual({
      ok: true,
      value: true,
    });
    await expect(store.getOutboxEntry("op_1", scope)).resolves.toEqual({ ok: true, value: null });
  });

  it("keeps sensitive vault records metadata-only with a strict field allowlist", async () => {
    const harness = createIndexedDbHarness();
    const store = harness.store;
    const vaultEntry = sensitiveVaultEntry({ fieldType: "pin" });

    await expect(store.putSensitiveVaultEntry(vaultEntry)).resolves.toEqual({
      ok: true,
      value: vaultEntry,
    });

    for (const key of [
      "value",
      "ciphertext",
      "secret",
      "credential",
      "encryptedValue",
      "iv",
      "salt",
      "kdfParams",
      "rawPin",
    ]) {
      const unsafe = await store.putSensitiveVaultEntry(
        sensitiveVaultEntry({
          vaultEntryId: `vault_${key}`,
          [key]: "unsafe",
        } as Partial<RepairDeskOfflineSensitiveVaultEntry>),
      );
      expect(unsafe.ok).toBe(false);
      expect(!unsafe.ok && unsafe.error.message).toContain("metadata only");
    }

    const listed = await store.listSensitiveVaultEntries(scope);
    expect(listed.ok && listed.value.map((entry) => entry.vaultEntryId)).toEqual(["vault_1"]);
    expect(harness.database.indexReads).toContainEqual({
      storeName: "repairdesk_sensitive_vault",
      indexName: "by_scope",
      query: [storeId, userId],
    });
  });

  it("validates attachments and sync meta with scoped reads", async () => {
    const harness = createIndexedDbHarness();
    const store = harness.store;
    const attachment = attachmentEntry();
    const meta = syncMeta();

    await expect(store.putAttachmentStagingEntry(attachment)).resolves.toEqual({
      ok: true,
      value: attachment,
    });
    await expect(store.putSyncMeta(meta)).resolves.toEqual({ ok: true, value: meta });

    const invalidAttachment = await store.putAttachmentStagingEntry(
      attachmentEntry({ stagingId: "attachment_2", sizeBytes: -1 }),
    );
    expect(invalidAttachment.ok).toBe(false);
    expect(!invalidAttachment.ok && invalidAttachment.error.code).toBe("validation_failed");

    await expect(store.getSyncMeta("sync_1", scope)).resolves.toEqual({ ok: true, value: meta });
    const wrongScope = await store.getSyncMeta("sync_1", { storeId, userId: "user_2" });
    expect(wrongScope.ok).toBe(false);
    expect(!wrongScope.ok && wrongScope.error.code).toBe("context_mismatch");
  });

  it("cleans up expired local-only records without touching outbox or sync meta", async () => {
    const harness = createIndexedDbHarness();
    const store = harness.store;

    await store.putOrderDraft(orderDraft({ expiresAt: earlier }));
    await store.putOrderDraft(orderDraft({ localDraftId: "draft_live", expiresAt: later }));
    await store.putSensitiveVaultEntry(sensitiveVaultEntry({ expiresAt: earlier }));
    await store.putSensitiveVaultEntry(
      sensitiveVaultEntry({ vaultEntryId: "vault_live", expiresAt: later }),
    );
    await store.putAttachmentStagingEntry(attachmentEntry({ expiresAt: earlier }));
    await store.putOutboxEntry(outboxEntry());
    await store.putSyncMeta(syncMeta());

    await expect(store.cleanupExpired(now)).resolves.toEqual({
      ok: true,
      value: { orderDrafts: 1, sensitiveVaultEntries: 1, attachmentStagingEntries: 1 },
    });
    await expect(store.cleanupExpired("not-a-date")).resolves.toEqual({
      ok: false,
      error: {
        code: "validation_failed",
        message: "Cleanup requires a valid ISO timestamp.",
      },
    });

    const drafts = await store.listOrderDrafts(scope);
    expect(drafts.ok && drafts.value.map((entry) => entry.localDraftId)).toEqual(["draft_live"]);
    await expect(store.getOutboxEntry("op_1", scope)).resolves.toEqual({
      ok: true,
      value: outboxEntry(),
    });
    await expect(store.getSyncMeta("sync_1", scope)).resolves.toEqual({
      ok: true,
      value: syncMeta(),
    });
  });

  it("maps request and transaction failures to UI-safe offline errors", async () => {
    const quotaHarness = createIndexedDbHarness();
    quotaHarness.database.failNextRequest(
      new DOMException("raw quota details", "QuotaExceededError"),
    );
    const quota = await quotaHarness.store.putOrderDraft(orderDraft());
    expect(quota.ok).toBe(false);
    expect(!quota.ok && quota.error).toEqual({
      code: "quota_exceeded",
      message: "RepairDesk offline storage quota was exceeded.",
    });

    const cloneHarness = createIndexedDbHarness();
    cloneHarness.database.throwNextRequest(new DOMException("raw clone details", "DataCloneError"));
    const cloneFailure = await cloneHarness.store.putOrderDraft(orderDraft());
    expect(cloneFailure.ok).toBe(false);
    expect(!cloneFailure.ok && cloneFailure.error).toEqual({
      code: "transaction_failed",
      message: "RepairDesk offline storage transaction failed.",
    });

    const abortHarness = createIndexedDbHarness({ completeAs: "abort" });
    const abort = await abortHarness.store.putOrderDraft(orderDraft());
    expect(abort.ok).toBe(false);
    expect(!abort.ok && abort.error).toEqual({
      code: "transaction_failed",
      message: "RepairDesk offline storage transaction failed.",
    });
  });

  it("resolves successful writes only after the IndexedDB transaction completes", async () => {
    const harness = createIndexedDbHarness({ autoComplete: false });
    const resultPromise = harness.store.putOrderDraft(orderDraft());
    let settled = false;
    resultPromise.then(() => {
      settled = true;
    });

    await flushMicrotasks();
    await flushMicrotasks();
    expect(settled).toBe(false);

    harness.database.completeTransactions();
    await expect(resultPromise).resolves.toEqual({ ok: true, value: orderDraft() });
    expect(settled).toBe(true);
  });

  it("reports health without throwing when IndexedDB cannot be opened", async () => {
    const store = createRepairDeskIndexedDbOfflineStore({
      scope,
      openDatabase: async () => ({
        ok: false,
        error: {
          code: "storage_unavailable",
          message: "RepairDesk offline storage is unavailable.",
        },
      }),
    });

    await expect(store.healthCheck()).resolves.toEqual({
      ok: true,
      value: {
        available: false,
        error: {
          code: "storage_unavailable",
          message: "RepairDesk offline storage is unavailable.",
        },
      },
    });
  });

  it("does not import UI, API, realtime, or network clients", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/offline/model/offline-indexeddb-store.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/@\/lib\/repairdesk\/api/);
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/realtime/i);
  });
});

type IndexedDbHarnessOptions = {
  autoComplete?: boolean;
  completeAs?: "complete" | "error" | "abort";
};

function createIndexedDbHarness(options: IndexedDbHarnessOptions = {}) {
  const database = new FakeCrudDatabase(options);
  const openDatabase = vi.fn(async () => ({
    ok: true as const,
    value: database.asDatabase(),
  }));
  const store = createRepairDeskIndexedDbOfflineStore({ scope, openDatabase });
  return { database, openDatabase, store };
}

type FakeStoredRecord = Record<string, unknown>;
type FakeTransactionMode = "readonly" | "readwrite";
type FakeCompleteAs = "complete" | "error" | "abort";
type FakeRequest<T> = {
  result: T;
  error: DOMException | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
};

class FakeCrudDatabase {
  readonly stores = new Map<RepairDeskOfflineStoreName, Map<string, FakeStoredRecord>>();
  readonly transactionLog: Array<[RepairDeskOfflineStoreName, FakeTransactionMode]> = [];
  readonly indexReads: Array<{
    storeName: RepairDeskOfflineStoreName;
    indexName: string;
    query: unknown;
  }> = [];
  readonly transactions: FakeTransaction[] = [];
  readonly autoComplete: boolean;
  readonly completeAs: FakeCompleteAs;
  readonly close = vi.fn();
  private nextRequestError: DOMException | null = null;
  private nextThrownError: DOMException | null = null;

  constructor(options: IndexedDbHarnessOptions) {
    this.autoComplete = options.autoComplete ?? true;
    this.completeAs = options.completeAs ?? "complete";
    for (const storeName of repairDeskOfflineStoreNames) {
      this.stores.set(storeName, new Map());
    }
  }

  asDatabase() {
    return this as unknown as IDBDatabase;
  }

  transaction(storeName: RepairDeskOfflineStoreName, mode: FakeTransactionMode = "readonly") {
    this.transactionLog.push([storeName, mode]);
    const transaction = new FakeTransaction(this, storeName, mode);
    this.transactions.push(transaction);
    return transaction as unknown as IDBTransaction;
  }

  failNextRequest(error: DOMException) {
    this.nextRequestError = error;
  }

  throwNextRequest(error: DOMException) {
    this.nextThrownError = error;
  }

  completeTransactions() {
    for (const transaction of this.transactions) {
      transaction.complete();
    }
  }

  consumeRequestError() {
    const error = this.nextRequestError;
    this.nextRequestError = null;
    return error;
  }

  consumeThrownError() {
    const error = this.nextThrownError;
    this.nextThrownError = null;
    return error;
  }

  getStore(storeName: RepairDeskOfflineStoreName) {
    const store = this.stores.get(storeName);
    if (!store) throw new Error(`Missing fake store ${storeName}`);
    return store;
  }
}

class FakeTransaction {
  oncomplete: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  pendingRequests = 0;
  completed = false;

  constructor(
    readonly database: FakeCrudDatabase,
    readonly storeName: RepairDeskOfflineStoreName,
    readonly mode: FakeTransactionMode,
  ) {}

  objectStore(storeName: RepairDeskOfflineStoreName) {
    if (storeName !== this.storeName) throw new Error(`Unexpected store ${storeName}`);
    return new FakeObjectStore(this, storeName) as unknown as IDBObjectStore;
  }

  request<T>(operation: () => T): IDBRequest<T> {
    const thrown = this.database.consumeThrownError();
    if (thrown) throw thrown;

    const request: FakeRequest<T> = {
      result: undefined as T,
      error: null,
      onsuccess: null,
      onerror: null,
    };
    this.pendingRequests += 1;

    queueMicrotask(() => {
      const requestError = this.database.consumeRequestError();
      if (requestError) {
        request.error = requestError;
        request.onerror?.(new Event("error"));
        this.pendingRequests -= 1;
        this.maybeComplete();
        return;
      }

      try {
        request.result = operation();
        request.onsuccess?.(new Event("success"));
      } catch (error) {
        request.error =
          error instanceof DOMException
            ? error
            : new DOMException("IndexedDB request failed.", "UnknownError");
        request.onerror?.(new Event("error"));
      } finally {
        this.pendingRequests -= 1;
        this.maybeComplete();
      }
    });

    return request as unknown as IDBRequest<T>;
  }

  maybeComplete() {
    if (!this.database.autoComplete || this.completed || this.pendingRequests > 0) return;
    queueMicrotask(() => this.complete());
  }

  complete() {
    if (this.completed || this.pendingRequests > 0) return;
    this.completed = true;
    if (this.database.completeAs === "abort") {
      this.onabort?.(new Event("abort"));
      return;
    }
    if (this.database.completeAs === "error") {
      this.onerror?.(new Event("error"));
      return;
    }
    this.oncomplete?.(new Event("complete"));
  }
}

class FakeObjectStore {
  constructor(
    readonly transaction: FakeTransaction,
    readonly storeName: RepairDeskOfflineStoreName,
  ) {}

  put(value: unknown) {
    return this.transaction.request<IDBValidKey>(() => {
      const record = structuredClone(value) as FakeStoredRecord;
      const key = getRecordKey(this.storeName, record);
      this.transaction.database.getStore(this.storeName).set(key, record);
      return key;
    });
  }

  get(key: IDBValidKey) {
    return this.transaction.request<unknown>(() => {
      const record = this.transaction.database.getStore(this.storeName).get(String(key));
      return record ? structuredClone(record) : undefined;
    });
  }

  getAll() {
    return this.transaction.request<unknown[]>(() =>
      Array.from(this.transaction.database.getStore(this.storeName).values()).map((record) =>
        structuredClone(record),
      ),
    );
  }

  delete(key: IDBValidKey) {
    return this.transaction.request<undefined>(() => {
      this.transaction.database.getStore(this.storeName).delete(String(key));
      return undefined;
    });
  }

  index(indexName: string) {
    return {
      getAll: (query: unknown) =>
        this.transaction.request<unknown[]>(() => {
          this.transaction.database.indexReads.push({
            storeName: this.storeName,
            indexName,
            query: structuredClone(query),
          });
          return Array.from(this.transaction.database.getStore(this.storeName).values())
            .filter((record) => matchesIndex(record, indexName, query))
            .map((record) => structuredClone(record));
        }),
    } as unknown as IDBIndex;
  }
}

function matchesIndex(record: FakeStoredRecord, indexName: string, query: unknown) {
  if (indexName === "by_scope" && Array.isArray(query)) {
    return record.storeId === query[0] && record.userId === query[1];
  }
  if (indexName === "by_scope_status" && Array.isArray(query)) {
    return record.storeId === query[0] && record.userId === query[1] && record.status === query[2];
  }
  return false;
}

function getRecordKey(storeName: RepairDeskOfflineStoreName, record: FakeStoredRecord) {
  const key = record[repairDeskOfflineStoreKeyPaths[storeName]];
  if (typeof key !== "string") {
    throw new DOMException("Missing IndexedDB key.", "DataError");
  }
  return key;
}

async function flushMicrotasks() {
  await Promise.resolve();
}

function orderDraft(
  overrides: Partial<RepairDeskOfflineOrderDraft> = {},
): RepairDeskOfflineOrderDraft {
  return {
    localDraftId: "draft_1",
    localOrderId: "local_order_1",
    storeId,
    userId,
    mode: "create",
    draftPayload: { customer_name: "Mario Rossi", issue_description: "Broken screen" },
    customerLinkMode: "walk_in_snapshot_only",
    deviceLinkMode: "order_snapshot_only",
    hasSensitiveVaultEntry: false,
    attachmentStagingIds: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: later,
    status: "draft_local",
    ...overrides,
  };
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
    payload: { issue_description: "Broken screen" },
    relationshipPlan: {
      customerLinkMode: "walk_in_snapshot_only",
      deviceLinkMode: "order_snapshot_only",
    },
    createdAtLocal: now,
    retryCount: 0,
    status: "pending_sync",
    sensitiveVaultEntryIds: [],
    attachmentStagingIds: [],
    ...overrides,
  };
}

function sensitiveVaultEntry(
  overrides: Partial<RepairDeskOfflineSensitiveVaultEntry> = {},
): RepairDeskOfflineSensitiveVaultEntry {
  return {
    vaultEntryId: "vault_1",
    localOrderId: "local_order_1",
    storeId,
    userId,
    fieldType: "pin",
    createdAt: now,
    updatedAt: now,
    expiresAt: later,
    syncStatus: "local_only",
    ...overrides,
  };
}

function attachmentEntry(
  overrides: Partial<RepairDeskOfflineAttachmentStagingEntry> = {},
): RepairDeskOfflineAttachmentStagingEntry {
  return {
    stagingId: "attachment_1",
    localOrderId: "local_order_1",
    storeId,
    userId,
    fileName: "device.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    createdAt: now,
    updatedAt: now,
    expiresAt: later,
    status: "local_only",
    ...overrides,
  };
}

function syncMeta(overrides: Partial<RepairDeskOfflineSyncMeta> = {}): RepairDeskOfflineSyncMeta {
  return {
    metaId: "sync_1",
    storeId,
    userId,
    onlineState: "offline",
    pendingCount: 1,
    conflictCount: 0,
    updatedAt: now,
    ...overrides,
  };
}
