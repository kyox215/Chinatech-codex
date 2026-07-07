import { describe, expect, it, vi } from "vitest";

import {
  ensureRepairDeskOfflineObjectStores,
  getRepairDeskOfflineStoreKeyPath,
  openRepairDeskOfflineIndexedDb,
  validateRepairDeskOfflineIndexedDbSchema,
} from "./offline-indexeddb";
import {
  REPAIRDESK_OFFLINE_DATABASE_NAME,
  REPAIRDESK_OFFLINE_SCHEMA_VERSION,
  repairDeskOfflineStoreNames,
} from "./offline-types";

describe("RepairDesk offline IndexedDB adapter", () => {
  it("creates all required object stores with stable key paths", () => {
    const database = createSchemaDatabase();

    ensureRepairDeskOfflineObjectStores(database);

    expect(database.createdStores).toEqual([
      ["repairdesk_order_drafts", { keyPath: "localDraftId" }],
      ["repairdesk_outbox", { keyPath: "operationId" }],
      ["repairdesk_sensitive_vault", { keyPath: "vaultEntryId" }],
      ["repairdesk_attachment_staging", { keyPath: "stagingId" }],
      ["repairdesk_sync_meta", { keyPath: "metaId" }],
    ]);
    expect(repairDeskOfflineStoreNames.map(getRepairDeskOfflineStoreKeyPath)).toEqual([
      "localDraftId",
      "operationId",
      "vaultEntryId",
      "stagingId",
      "metaId",
    ]);
    expect(database.stores.get("repairdesk_order_drafts")?.createdIndexes).toEqual([
      ["by_scope", ["storeId", "userId"]],
      ["by_scope_status", ["storeId", "userId", "status"]],
      ["by_expires_at", "expiresAt"],
    ]);
  });

  it("does not recreate object stores that already exist", () => {
    const database = createSchemaDatabase(["repairdesk_order_drafts", "repairdesk_outbox"]);

    ensureRepairDeskOfflineObjectStores(database);

    expect(database.createdStores.map(([name]) => name)).toEqual([
      "repairdesk_sensitive_vault",
      "repairdesk_attachment_staging",
      "repairdesk_sync_meta",
    ]);
    expect(database.stores.get("repairdesk_order_drafts")?.createdIndexes).toEqual([]);
  });

  it("opens the configured database and upgrades the schema", async () => {
    const database = createSchemaDatabase();
    const request = createOpenRequest(database);
    const factory = createFactory(request);

    const opened = openRepairDeskOfflineIndexedDb({ factory });
    request.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
    request.onsuccess?.(new Event("success"));

    await expect(opened).resolves.toEqual({ ok: true, value: database });
    expect(factory.open).toHaveBeenCalledWith(
      REPAIRDESK_OFFLINE_DATABASE_NAME,
      REPAIRDESK_OFFLINE_SCHEMA_VERSION,
    );
    expect(database.createdStores).toHaveLength(5);
    expect(database.onversionchange).toBeTypeOf("function");
    database.onversionchange?.(new Event("versionchange") as IDBVersionChangeEvent);
    expect(database.close).toHaveBeenCalled();
  });

  it("returns storage_unavailable without a browser IndexedDB factory", async () => {
    await expect(openRepairDeskOfflineIndexedDb({ factory: undefined })).resolves.toEqual({
      ok: false,
      error: {
        code: "storage_unavailable",
        message: "RepairDesk offline storage is unavailable.",
      },
    });
  });

  it("maps blocked upgrades and quota errors to UI-safe errors", async () => {
    const blockedRequest = createOpenRequest(createSchemaDatabase());
    const blocked = openRepairDeskOfflineIndexedDb({ factory: createFactory(blockedRequest) });
    blockedRequest.onblocked?.(new Event("blocked"));
    await expect(blocked).resolves.toEqual({
      ok: false,
      error: {
        code: "version_blocked",
        message: "RepairDesk offline storage upgrade is blocked by another open tab.",
      },
    });

    const quotaRequest = createOpenRequest(createSchemaDatabase());
    quotaRequest.error = new DOMException("raw browser quota text", "QuotaExceededError");
    const quota = openRepairDeskOfflineIndexedDb({ factory: createFactory(quotaRequest) });
    quotaRequest.onerror?.(new Event("error"));
    await expect(quota).resolves.toEqual({
      ok: false,
      error: {
        code: "quota_exceeded",
        message: "RepairDesk offline storage quota was exceeded.",
      },
    });
  });

  it("returns a migration error if schema creation fails", async () => {
    const database = createSchemaDatabase();
    database.createObjectStore = vi.fn(() => {
      throw new Error("raw migration failure");
    });
    const request = createOpenRequest(database);

    const opened = openRepairDeskOfflineIndexedDb({ factory: createFactory(request) });
    request.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
    request.onsuccess?.(new Event("success"));

    await expect(opened).resolves.toEqual({
      ok: false,
      error: {
        code: "migration_failed",
        message: "RepairDesk offline storage migration failed.",
      },
    });
    expect(database.close).toHaveBeenCalled();
  });

  it("validates existing stores, key paths, and indexes after opening", () => {
    const valid = createSchemaDatabase(repairDeskOfflineStoreNames);

    expect(validateRepairDeskOfflineIndexedDbSchema(valid)).toEqual({ ok: true, value: true });

    const missingStore = createSchemaDatabase(["repairdesk_order_drafts"]);
    expect(validateRepairDeskOfflineIndexedDbSchema(missingStore)).toEqual({
      ok: false,
      error: {
        code: "migration_failed",
        message: "RepairDesk offline storage schema is incomplete.",
      },
    });

    const wrongKeyPath = createSchemaDatabase(repairDeskOfflineStoreNames);
    wrongKeyPath.stores.get("repairdesk_outbox")!.keyPath = "wrong";
    expect(validateRepairDeskOfflineIndexedDbSchema(wrongKeyPath)).toEqual({
      ok: false,
      error: {
        code: "migration_failed",
        message: "RepairDesk offline storage schema key path is invalid.",
      },
    });

    const missingIndex = createSchemaDatabase(repairDeskOfflineStoreNames, { indexes: false });
    expect(validateRepairDeskOfflineIndexedDbSchema(missingIndex)).toEqual({
      ok: false,
      error: {
        code: "migration_failed",
        message: "RepairDesk offline storage schema index is missing.",
      },
    });
  });
});

type SchemaDatabase = ReturnType<typeof createSchemaDatabase>;

function createSchemaDatabase(
  existingStoreNames: readonly string[] = [],
  options = { indexes: true },
) {
  const existing = new Set(existingStoreNames);
  const stores = new Map<string, SchemaObjectStore>();
  for (const name of existing) {
    stores.set(name, createSchemaObjectStore(name, options));
  }
  const database = {
    createdStores: [] as Array<[string, IDBObjectStoreParameters | undefined]>,
    objectStoreNames: {
      contains: vi.fn((name: string) => existing.has(name)),
    },
    createObjectStore: vi.fn((name: string, options?: IDBObjectStoreParameters) => {
      existing.add(name);
      const store = createSchemaObjectStore(name, { indexes: false });
      stores.set(name, store);
      database.createdStores.push([name, options]);
      return store;
    }),
    transaction: vi.fn((storeName: string) => ({
      objectStore: vi.fn(() => {
        const objectStore = stores.get(storeName);
        if (!objectStore) throw new Error("missing store");
        return objectStore;
      }),
    })),
    stores,
    onversionchange: null as ((event: IDBVersionChangeEvent) => void) | null,
    close: vi.fn(),
  };
  return database;
}

type SchemaObjectStore = ReturnType<typeof createSchemaObjectStore>;

function createSchemaObjectStore(storeName: string, options = { indexes: true }) {
  const indexNames = new Set<string>();
  if (options.indexes && isRepairDeskStoreName(storeName)) {
    for (const index of {
      repairdesk_order_drafts: ["by_scope", "by_scope_status", "by_expires_at"],
      repairdesk_outbox: ["by_scope", "by_scope_status"],
      repairdesk_sensitive_vault: ["by_scope", "by_expires_at"],
      repairdesk_attachment_staging: ["by_scope", "by_expires_at"],
      repairdesk_sync_meta: [],
    }[storeName]) {
      indexNames.add(index);
    }
  }
  const objectStore = {
    keyPath: isRepairDeskStoreName(storeName) ? getRepairDeskOfflineStoreKeyPath(storeName) : "id",
    indexNames: {
      contains: vi.fn((name: string) => indexNames.has(name)),
    },
    createdIndexes: [] as Array<[string, string | string[]]>,
    createIndex: vi.fn((name: string, keyPath: string | string[]) => {
      indexNames.add(name);
      objectStore.createdIndexes.push([name, keyPath]);
      return {};
    }),
  };
  return objectStore;
}

function createOpenRequest(database: SchemaDatabase) {
  return {
    result: database as unknown as IDBDatabase,
    error: null as DOMException | null,
    onblocked: null as ((event: Event) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onsuccess: null as ((event: Event) => void) | null,
    onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
  } as IDBOpenDBRequest & {
    error: DOMException | null;
    onblocked: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;
    onsuccess: ((event: Event) => void) | null;
    onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
  };
}

function createFactory(request: IDBOpenDBRequest) {
  return {
    open: vi.fn(() => request),
  };
}

function isRepairDeskStoreName(
  value: string,
): value is (typeof repairDeskOfflineStoreNames)[number] {
  return repairDeskOfflineStoreNames.includes(
    value as (typeof repairDeskOfflineStoreNames)[number],
  );
}
