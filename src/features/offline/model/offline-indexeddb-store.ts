import { openRepairDeskOfflineIndexedDb } from "./offline-indexeddb";
import type {
  RepairDeskOfflineCleanupResult,
  RepairDeskOfflineHealth,
  RepairDeskOfflineStore,
} from "./offline-store";
import {
  validateAttachmentStagingEntry,
  validateOrderDraft,
  validateOutboxEntry,
  validateSensitiveVaultEntry,
  validateSyncMeta,
} from "./offline-store";
import type {
  RepairDeskOfflineAttachmentStagingEntry,
  RepairDeskOfflineError,
  RepairDeskOfflineErrorCode,
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineOrderDraftStatus,
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineOutboxStatus,
  RepairDeskOfflineResult,
  RepairDeskOfflineScope,
  RepairDeskOfflineSensitiveVaultEntry,
  RepairDeskOfflineStoreName,
  RepairDeskOfflineSyncMeta,
} from "./offline-types";

export type RepairDeskIndexedDbOfflineStoreOptions = {
  scope: RepairDeskOfflineScope;
  openDatabase?: () => Promise<RepairDeskOfflineResult<IDBDatabase>>;
};

export function createRepairDeskIndexedDbOfflineStore(
  options: RepairDeskIndexedDbOfflineStoreOptions,
): RepairDeskOfflineStore {
  const openDatabase = options.openDatabase ?? openRepairDeskOfflineIndexedDb;
  const activeScope = options.scope;

  return {
    async healthCheck() {
      const database = await openDatabase();
      if (!database.ok) {
        return { ok: true, value: { available: false, error: database.error } };
      }
      closeIndexedDbQuietly(database.value);
      return { ok: true, value: { available: true } };
    },
    async putOrderDraft(draft) {
      const validation = validateOrderDraft(draft);
      if (!validation.ok) return validation;
      const scope = validateActiveRecordScope(draft, activeScope);
      if (!scope.ok) return scope;
      return putRecord(openDatabase, "repairdesk_order_drafts", draft);
    },
    async getOrderDraft(localDraftId, scope) {
      const active = validateActiveRequestedScope(scope, activeScope);
      if (!active.ok) return active;
      return getScopedRecord<RepairDeskOfflineOrderDraft>(
        openDatabase,
        "repairdesk_order_drafts",
        localDraftId,
        scope,
      );
    },
    async listOrderDrafts(scope) {
      if (!matchesScope(scope, activeScope)) return success([]);
      return listScopedRecords<RepairDeskOfflineOrderDraft>(
        openDatabase,
        "repairdesk_order_drafts",
        scope,
        scope.status,
      );
    },
    async deleteOrderDraft(localDraftId, scope) {
      const active = validateActiveRequestedScope(scope, activeScope);
      if (!active.ok) return active;
      return deleteScopedRecord(openDatabase, "repairdesk_order_drafts", localDraftId, scope);
    },
    async putOutboxEntry(entry) {
      const validation = validateOutboxEntry(entry);
      if (!validation.ok) return validation;
      const scope = validateActiveRecordScope(entry, activeScope);
      if (!scope.ok) return scope;
      return putRecord(openDatabase, "repairdesk_outbox", entry);
    },
    async getOutboxEntry(operationId, scope) {
      const active = validateActiveRequestedScope(scope, activeScope);
      if (!active.ok) return active;
      return getScopedRecord<RepairDeskOfflineOutboxEntry>(
        openDatabase,
        "repairdesk_outbox",
        operationId,
        scope,
      );
    },
    async listOutboxEntries(scope) {
      if (!matchesScope(scope, activeScope)) return success([]);
      return listScopedRecords<RepairDeskOfflineOutboxEntry>(
        openDatabase,
        "repairdesk_outbox",
        scope,
        scope.status,
      );
    },
    async deleteOutboxEntry(operationId, scope) {
      const active = validateActiveRequestedScope(scope, activeScope);
      if (!active.ok) return active;
      return deleteScopedRecord(openDatabase, "repairdesk_outbox", operationId, scope);
    },
    async putSensitiveVaultEntry(entry) {
      const validation = validateSensitiveVaultEntry(entry);
      if (!validation.ok) return validation;
      const scope = validateActiveRecordScope(entry, activeScope);
      if (!scope.ok) return scope;
      return putRecord(openDatabase, "repairdesk_sensitive_vault", entry);
    },
    async getSensitiveVaultEntry(vaultEntryId, scope) {
      const active = validateActiveRequestedScope(scope, activeScope);
      if (!active.ok) return active;
      return getScopedRecord<RepairDeskOfflineSensitiveVaultEntry>(
        openDatabase,
        "repairdesk_sensitive_vault",
        vaultEntryId,
        scope,
      );
    },
    async listSensitiveVaultEntries(scope) {
      if (!matchesScope(scope, activeScope)) return success([]);
      return listScopedRecords<RepairDeskOfflineSensitiveVaultEntry>(
        openDatabase,
        "repairdesk_sensitive_vault",
        scope,
      );
    },
    async putAttachmentStagingEntry(entry) {
      const validation = validateAttachmentStagingEntry(entry);
      if (!validation.ok) return validation;
      const scope = validateActiveRecordScope(entry, activeScope);
      if (!scope.ok) return scope;
      return putRecord(openDatabase, "repairdesk_attachment_staging", entry);
    },
    async listAttachmentStagingEntries(scope) {
      if (!matchesScope(scope, activeScope)) return success([]);
      return listScopedRecords<RepairDeskOfflineAttachmentStagingEntry>(
        openDatabase,
        "repairdesk_attachment_staging",
        scope,
      );
    },
    async putSyncMeta(meta) {
      const validation = validateSyncMeta(meta);
      if (!validation.ok) return validation;
      const scope = validateActiveRecordScope(meta, activeScope);
      if (!scope.ok) return scope;
      return putRecord(openDatabase, "repairdesk_sync_meta", meta);
    },
    async getSyncMeta(metaId, scope) {
      const active = validateActiveRequestedScope(scope, activeScope);
      if (!active.ok) return active;
      return getScopedRecord<RepairDeskOfflineSyncMeta>(
        openDatabase,
        "repairdesk_sync_meta",
        metaId,
        scope,
      );
    },
    async cleanupExpired(nowIso) {
      const now = Date.parse(nowIso);
      if (Number.isNaN(now)) {
        return failure("validation_failed", "Cleanup requires a valid ISO timestamp.");
      }
      const orderDrafts = await cleanupExpiredStore<RepairDeskOfflineOrderDraft>(
        openDatabase,
        "repairdesk_order_drafts",
        "localDraftId",
        now,
      );
      if (!orderDrafts.ok) return orderDrafts;
      const sensitiveVaultEntries = await cleanupExpiredStore<RepairDeskOfflineSensitiveVaultEntry>(
        openDatabase,
        "repairdesk_sensitive_vault",
        "vaultEntryId",
        now,
      );
      if (!sensitiveVaultEntries.ok) return sensitiveVaultEntries;
      const attachmentStagingEntries =
        await cleanupExpiredStore<RepairDeskOfflineAttachmentStagingEntry>(
          openDatabase,
          "repairdesk_attachment_staging",
          "stagingId",
          now,
        );
      if (!attachmentStagingEntries.ok) return attachmentStagingEntries;

      return success({
        orderDrafts: orderDrafts.value,
        sensitiveVaultEntries: sensitiveVaultEntries.value,
        attachmentStagingEntries: attachmentStagingEntries.value,
      });
    },
  };
}

async function putRecord<T>(
  openDatabase: () => Promise<RepairDeskOfflineResult<IDBDatabase>>,
  storeName: RepairDeskOfflineStoreName,
  record: T,
) {
  return withObjectStore(openDatabase, storeName, "readwrite", async (objectStore) => {
    const result = await idbRequest<IDBValidKey>(objectStore.put(cloneOfflineValue(record)));
    if (!result.ok) return result;
    return success(cloneOfflineValue(record));
  });
}

async function getScopedRecord<T extends { storeId: string; userId: string }>(
  openDatabase: () => Promise<RepairDeskOfflineResult<IDBDatabase>>,
  storeName: RepairDeskOfflineStoreName,
  key: string,
  scope: RepairDeskOfflineScope,
): Promise<RepairDeskOfflineResult<T | null>> {
  return withObjectStore(openDatabase, storeName, "readonly", async (objectStore) => {
    const record = await idbRequest<T | undefined>(objectStore.get(key));
    if (!record.ok) return record;
    if (!record.value) return success(null);
    if (!matchesScope(record.value, scope)) {
      return failure(
        "context_mismatch",
        "Offline record does not belong to the active store/user context.",
      );
    }
    return success(cloneOfflineValue(record.value));
  });
}

async function deleteScopedRecord<T extends { storeId: string; userId: string }>(
  openDatabase: () => Promise<RepairDeskOfflineResult<IDBDatabase>>,
  storeName: RepairDeskOfflineStoreName,
  key: string,
  scope: RepairDeskOfflineScope,
) {
  return withObjectStore(openDatabase, storeName, "readwrite", async (objectStore) => {
    const record = await idbRequest<T | undefined>(objectStore.get(key));
    if (!record.ok) return record;
    if (!record.value) return success(false);
    if (!matchesScope(record.value, scope)) {
      return failure(
        "context_mismatch",
        "Offline record does not belong to the active store/user context.",
      );
    }
    const deleted = await idbRequest<undefined>(objectStore.delete(key));
    if (!deleted.ok) return deleted;
    return success(true);
  });
}

async function listScopedRecords<T extends { storeId: string; userId: string; status?: string }>(
  openDatabase: () => Promise<RepairDeskOfflineResult<IDBDatabase>>,
  storeName: RepairDeskOfflineStoreName,
  scope: RepairDeskOfflineScope & {
    status?: RepairDeskOfflineOrderDraftStatus | RepairDeskOfflineOutboxStatus;
  },
  status?: RepairDeskOfflineOrderDraftStatus | RepairDeskOfflineOutboxStatus,
) {
  return withObjectStore(openDatabase, storeName, "readonly", async (objectStore) => {
    const index = objectStore.index(status ? "by_scope_status" : "by_scope");
    const query = status ? [scope.storeId, scope.userId, status] : [scope.storeId, scope.userId];
    const records = await idbRequest<T[]>(index.getAll(query));
    if (!records.ok) return records;
    return success(records.value.map(cloneOfflineValue));
  });
}

async function cleanupExpiredStore<T extends { expiresAt: string }>(
  openDatabase: () => Promise<RepairDeskOfflineResult<IDBDatabase>>,
  storeName: RepairDeskOfflineStoreName,
  keyField: keyof T & string,
  now: number,
) {
  return withObjectStore(openDatabase, storeName, "readwrite", async (objectStore) => {
    const records = await idbRequest<T[]>(objectStore.getAll());
    if (!records.ok) return records;

    let count = 0;
    for (const record of records.value) {
      const expiresAt = Date.parse(record.expiresAt);
      if (Number.isNaN(expiresAt) || expiresAt > now) continue;
      const key = record[keyField];
      if (typeof key !== "string") continue;
      const deleted = await idbRequest<undefined>(objectStore.delete(key));
      if (!deleted.ok) return deleted;
      count += 1;
    }

    return success(count);
  });
}

async function withObjectStore<T>(
  openDatabase: () => Promise<RepairDeskOfflineResult<IDBDatabase>>,
  storeName: RepairDeskOfflineStoreName,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => Promise<RepairDeskOfflineResult<T>>,
) {
  const database = await openDatabase();
  if (!database.ok) return database;

  try {
    const transaction = database.value.transaction(storeName, mode);
    const transactionDone = idbTransactionDone(transaction);
    const objectStore = transaction.objectStore(storeName);
    const result = await operation(objectStore);
    if (!result.ok) return result;
    const done = await transactionDone;
    if (!done.ok) return done;
    return result;
  } catch {
    return failure("transaction_failed", "RepairDesk offline storage transaction failed.");
  } finally {
    closeIndexedDbQuietly(database.value);
  }
}

function idbTransactionDone(transaction: IDBTransaction): Promise<RepairDeskOfflineResult<true>> {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(success(true));
    transaction.onerror = () =>
      resolve(failure("transaction_failed", "RepairDesk offline storage transaction failed."));
    transaction.onabort = () =>
      resolve(failure("transaction_failed", "RepairDesk offline storage transaction failed."));
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<RepairDeskOfflineResult<T>> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(success(request.result));
    request.onerror = () =>
      resolve(failure(idbErrorCode(request.error), idbErrorMessage(request.error)));
  });
}

function validateActiveRecordScope(
  record: { storeId: string; userId: string },
  scope: RepairDeskOfflineScope,
) {
  if (matchesScope(record, scope)) return success(true);
  return contextMismatch();
}

function validateActiveRequestedScope(
  scope: RepairDeskOfflineScope,
  activeScope: RepairDeskOfflineScope,
) {
  if (matchesScope(scope, activeScope)) return success(true);
  return contextMismatch();
}

function matchesScope<T extends { storeId: string; userId: string }>(
  value: T,
  scope: RepairDeskOfflineScope,
) {
  return value.storeId === scope.storeId && value.userId === scope.userId;
}

function contextMismatch(): RepairDeskOfflineResult<never> {
  return failure(
    "context_mismatch",
    "Offline record does not belong to the active store/user context.",
  );
}

function idbErrorCode(error: DOMException | null): RepairDeskOfflineErrorCode {
  switch (error?.name) {
    case "QuotaExceededError":
      return "quota_exceeded";
    default:
      return "transaction_failed";
  }
}

function idbErrorMessage(error: DOMException | null) {
  switch (idbErrorCode(error)) {
    case "quota_exceeded":
      return "RepairDesk offline storage quota was exceeded.";
    case "transaction_failed":
      return "RepairDesk offline storage transaction failed.";
    case "storage_unavailable":
    case "context_mismatch":
    case "migration_failed":
    case "version_blocked":
    case "unknown_error":
    case "validation_failed":
    case "not_found":
      return "RepairDesk offline storage failed.";
  }
}

function cloneOfflineValue<T>(value: T): T {
  return structuredClone(value);
}

function closeIndexedDbQuietly(database?: IDBDatabase) {
  try {
    database?.close();
  } catch {
    // Close failures should not hide the original offline operation result.
  }
}

function success<T>(value: T): RepairDeskOfflineResult<T> {
  return { ok: true, value };
}

function failure<T = never>(
  code: RepairDeskOfflineErrorCode,
  message: string,
): RepairDeskOfflineResult<T> {
  return { ok: false, error: offlineError(code, message) };
}

function offlineError(code: RepairDeskOfflineErrorCode, message: string): RepairDeskOfflineError {
  return { code, message };
}
