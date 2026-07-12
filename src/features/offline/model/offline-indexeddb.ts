import {
  REPAIRDESK_OFFLINE_DATABASE_NAME,
  REPAIRDESK_OFFLINE_SCHEMA_VERSION,
  repairDeskOfflineStoreIndexes,
  repairDeskOfflineStoreKeyPaths,
  repairDeskOfflineStoreNames,
  type RepairDeskOfflineError,
  type RepairDeskOfflineErrorCode,
  type RepairDeskOfflineResult,
  type RepairDeskOfflineStoreName,
} from "./offline-types";

export type RepairDeskOfflineIndexedDbFactory = Pick<IDBFactory, "open">;

export type RepairDeskOfflineIndexedDbOpenOptions = {
  factory?: RepairDeskOfflineIndexedDbFactory;
  databaseName?: string;
  schemaVersion?: number;
};

export type RepairDeskOfflineIndexedDbSchemaDatabase = {
  objectStoreNames: Pick<DOMStringList, "contains">;
  createObjectStore(
    name: string,
    options?: IDBObjectStoreParameters,
  ): RepairDeskOfflineIndexedDbSchemaObjectStore;
  transaction?(
    storeName: string,
    mode?: IDBTransactionMode,
  ): {
    objectStore(name: string): RepairDeskOfflineIndexedDbSchemaObjectStore;
  };
  close?(): void;
};

export type RepairDeskOfflineIndexedDbSchemaObjectStore = {
  keyPath?: string | string[] | null;
  indexNames: Pick<DOMStringList, "contains">;
  createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): unknown;
};

export function getRepairDeskOfflineIndexedDbFactory():
  | RepairDeskOfflineIndexedDbFactory
  | undefined {
  if (typeof window === "undefined") return undefined;
  return window.indexedDB;
}

export async function clearRepairDeskOfflineIndexedDb() {
  if (typeof window === "undefined" || !window.indexedDB) return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 2_000);
    const request = window.indexedDB.deleteDatabase(REPAIRDESK_OFFLINE_DATABASE_NAME);
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    request.onsuccess = finish;
    request.onerror = finish;
    request.onblocked = finish;
  });
}

export async function openRepairDeskOfflineIndexedDb({
  factory = getRepairDeskOfflineIndexedDbFactory(),
  databaseName = REPAIRDESK_OFFLINE_DATABASE_NAME,
  schemaVersion = REPAIRDESK_OFFLINE_SCHEMA_VERSION,
}: RepairDeskOfflineIndexedDbOpenOptions = {}): Promise<RepairDeskOfflineResult<IDBDatabase>> {
  if (!factory) {
    return failure("storage_unavailable", "RepairDesk offline storage is unavailable.");
  }

  let request: IDBOpenDBRequest;
  try {
    request = factory.open(databaseName, schemaVersion);
  } catch {
    return failure("storage_unavailable", "RepairDesk offline storage is unavailable.");
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: RepairDeskOfflineResult<IDBDatabase>) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    request.onupgradeneeded = () => {
      try {
        ensureRepairDeskOfflineObjectStores(request.result, request.transaction ?? undefined);
      } catch {
        closeIndexedDbQuietly(request.result);
        settle(failure("migration_failed", "RepairDesk offline storage migration failed."));
      }
    };

    request.onsuccess = () => {
      const validation = validateRepairDeskOfflineIndexedDbSchema(request.result);
      if (!validation.ok) {
        closeIndexedDbQuietly(request.result);
        settle(failure(validation.error.code, validation.error.message));
        return;
      }
      request.result.onversionchange = () => {
        closeIndexedDbQuietly(request.result);
      };
      settle(success(request.result));
    };

    request.onerror = () => {
      settle(failure(indexedDbErrorCode(request.error), indexedDbErrorMessage(request.error)));
    };

    request.onblocked = () => {
      settle(
        failure(
          "version_blocked",
          "RepairDesk offline storage upgrade is blocked by another open tab.",
        ),
      );
    };
  });
}

export function ensureRepairDeskOfflineObjectStores(
  database: RepairDeskOfflineIndexedDbSchemaDatabase,
  transaction?: Pick<IDBTransaction, "objectStore">,
) {
  for (const storeName of repairDeskOfflineStoreNames) {
    const objectStore = database.objectStoreNames.contains(storeName)
      ? transaction?.objectStore(storeName)
      : database.createObjectStore(storeName, {
          keyPath: repairDeskOfflineStoreKeyPaths[storeName],
        });
    if (objectStore) ensureRepairDeskOfflineIndexes(storeName, objectStore);
  }
}

export function getRepairDeskOfflineStoreKeyPath(storeName: RepairDeskOfflineStoreName) {
  return repairDeskOfflineStoreKeyPaths[storeName];
}

export function validateRepairDeskOfflineIndexedDbSchema(
  database: RepairDeskOfflineIndexedDbSchemaDatabase,
): RepairDeskOfflineResult<true> {
  for (const storeName of repairDeskOfflineStoreNames) {
    if (!database.objectStoreNames.contains(storeName)) {
      return failure("migration_failed", "RepairDesk offline storage schema is incomplete.");
    }
    if (!database.transaction) continue;

    let objectStore: RepairDeskOfflineIndexedDbSchemaObjectStore;
    try {
      objectStore = database.transaction(storeName, "readonly").objectStore(storeName);
    } catch {
      return failure("migration_failed", "RepairDesk offline storage schema is invalid.");
    }

    if (!sameKeyPath(objectStore.keyPath, repairDeskOfflineStoreKeyPaths[storeName])) {
      return failure("migration_failed", "RepairDesk offline storage schema key path is invalid.");
    }

    for (const index of repairDeskOfflineStoreIndexes[storeName]) {
      if (!objectStore.indexNames.contains(index.name)) {
        return failure("migration_failed", "RepairDesk offline storage schema index is missing.");
      }
    }
  }

  return success(true);
}

function ensureRepairDeskOfflineIndexes(
  storeName: RepairDeskOfflineStoreName,
  objectStore: RepairDeskOfflineIndexedDbSchemaObjectStore,
) {
  for (const index of repairDeskOfflineStoreIndexes[storeName]) {
    if (objectStore.indexNames.contains(index.name)) continue;
    objectStore.createIndex(index.name, index.keyPath);
  }
}

function indexedDbErrorCode(error: DOMException | null): RepairDeskOfflineErrorCode {
  switch (error?.name) {
    case "QuotaExceededError":
      return "quota_exceeded";
    case "VersionError":
    case "InvalidStateError":
      return "migration_failed";
    default:
      return "unknown_error";
  }
}

function indexedDbErrorMessage(error: DOMException | null) {
  switch (indexedDbErrorCode(error)) {
    case "quota_exceeded":
      return "RepairDesk offline storage quota was exceeded.";
    case "migration_failed":
      return "RepairDesk offline storage migration failed.";
    case "transaction_failed":
      return "RepairDesk offline storage transaction failed.";
    case "unknown_error":
      return "RepairDesk offline storage failed.";
    case "storage_unavailable":
    case "context_mismatch":
    case "version_blocked":
    case "validation_failed":
    case "not_found":
      return "RepairDesk offline storage failed.";
  }
}

function closeIndexedDbQuietly(database?: IDBDatabase) {
  try {
    database?.close();
  } catch {
    // Closing during a failed upgrade should not hide the original migration error.
  }
}

function sameKeyPath(current: string | string[] | null | undefined, expected: string) {
  return typeof current === "string" && current === expected;
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
