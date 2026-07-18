import { createHash } from "node:crypto";

import type {
  StoreExportManifest,
  StoreExportTableManifest,
  StoreRestoreProof,
  StoreStorageObjectManifest,
} from "@/lib/repairdesk/types";

export const STORE_EXPORT_BUCKETS = [
  "repairdesk-order-attachments",
  "repairdesk-inventory-attachments",
  "repairdesk-buyback-evidence",
] as const;

export interface StoreExportCatalogEntry {
  tableName: string;
  primaryKeyColumns: string[];
}

export interface StoreExportStorageObject {
  bucket: string;
  path: string;
  size: number;
  metadata: Record<string, unknown>;
  bytes: Uint8Array;
}

export interface StoreExportSource {
  listDatabaseCatalog(): Promise<StoreExportCatalogEntry[]>;
  iterateDatabaseRows(input: {
    storeId: string;
    table: StoreExportCatalogEntry;
  }): AsyncIterable<Record<string, unknown>>;
  iterateStorageObjects(input: {
    storeId: string;
    buckets: readonly string[];
  }): AsyncIterable<StoreExportStorageObject>;
}

export interface StoreExportEncryptedSink {
  writeDatabaseRow(tableName: string, canonicalRow: string): Promise<void>;
  writeStorageObject(object: StoreExportStorageObject): Promise<void>;
  finalize(input: {
    storeId: string;
    databaseManifestSha256: string;
    storageManifestSha256: string;
  }): Promise<{
    encryptedArtifactRef: string;
    encryptionKeyRef: string;
    artifactSha256: string;
  }>;
}

export async function createCompleteStoreExport(input: {
  storeId: string;
  schemaVersion: string;
  appVersion: string;
  source: StoreExportSource;
  sink: StoreExportEncryptedSink;
}): Promise<StoreExportManifest & { encrypted_artifact_ref: string; encryption_key_ref: string }> {
  const catalog = [...(await input.source.listDatabaseCatalog())].sort((left, right) =>
    left.tableName.localeCompare(right.tableName),
  );
  assertCompleteCatalog(catalog);

  const databaseTables: StoreExportTableManifest[] = [];
  for (const table of catalog) {
    const content = createHash("sha256");
    let rowCount = 0;
    for await (const row of input.source.iterateDatabaseRows({ storeId: input.storeId, table })) {
      const canonicalRow = stableJson(row);
      await input.sink.writeDatabaseRow(table.tableName, canonicalRow);
      content.update(canonicalRow).update("\n");
      rowCount += 1;
    }
    databaseTables.push({
      table_name: table.tableName,
      row_count: rowCount,
      content_sha256: content.digest("hex"),
    });
  }

  const storageObjects: StoreStorageObjectManifest[] = [];
  for await (const object of input.source.iterateStorageObjects({
    storeId: input.storeId,
    buckets: STORE_EXPORT_BUCKETS,
  })) {
    assertStoreBoundStorageObject(input.storeId, object);
    await input.sink.writeStorageObject(object);
    storageObjects.push({
      bucket: object.bucket,
      path: object.path,
      size: object.size,
      content_sha256: sha256(object.bytes),
      metadata_sha256: sha256(stableJson(object.metadata)),
    });
  }
  storageObjects.sort((left, right) =>
    `${left.bucket}:${left.path}`.localeCompare(`${right.bucket}:${right.path}`),
  );

  const databaseManifestSha256 = sha256(
    databaseTables
      .map((table) => `${table.table_name}:${table.row_count}:${table.content_sha256}`)
      .join("\n"),
  );
  const storageManifestSha256 = sha256(
    storageObjects
      .map(
        (object) =>
          `${object.bucket}:${object.path}:${object.size}:${object.content_sha256}:${object.metadata_sha256}`,
      )
      .join("\n"),
  );
  const artifact = await input.sink.finalize({
    storeId: input.storeId,
    databaseManifestSha256,
    storageManifestSha256,
  });
  assertOpaqueArtifactReference(artifact.encryptedArtifactRef);
  assertOpaqueArtifactReference(artifact.encryptionKeyRef);
  assertSha256(artifact.artifactSha256, "artifact hash");

  return {
    store_id: input.storeId,
    schema_version: input.schemaVersion,
    app_version: input.appVersion,
    database_tables: databaseTables,
    storage_objects: storageObjects,
    database_manifest_sha256: databaseManifestSha256,
    storage_manifest_sha256: storageManifestSha256,
    artifact_sha256: artifact.artifactSha256,
    encrypted_artifact_ref: artifact.encryptedArtifactRef,
    encryption_key_ref: artifact.encryptionKeyRef,
  };
}

export function verifyStoreRestore(input: {
  exportJobId: string;
  expected: StoreExportManifest;
  restored: StoreExportManifest;
  verifiedAt?: string;
}): StoreRestoreProof {
  if (input.expected.store_id !== input.restored.store_id) {
    throw new Error("恢复目标 store UUID 与导出包不一致");
  }
  const expectedTables = new Map(
    input.expected.database_tables.map((table) => [table.table_name, table] as const),
  );
  const restoredTables = new Map(
    input.restored.database_tables.map((table) => [table.table_name, table] as const),
  );
  const tableMismatches = unionKeys(expectedTables, restoredTables).filter((tableName) => {
    const expected = expectedTables.get(tableName);
    const restored = restoredTables.get(tableName);
    return (
      !expected ||
      !restored ||
      expected.row_count !== restored.row_count ||
      expected.content_sha256 !== restored.content_sha256
    );
  });
  const expectedStorage = new Map<string, StoreStorageObjectManifest>(
    input.expected.storage_objects.map(
      (object) => [`${object.bucket}:${object.path}`, object] as const,
    ),
  );
  const restoredStorage = new Map<string, StoreStorageObjectManifest>(
    input.restored.storage_objects.map(
      (object) => [`${object.bucket}:${object.path}`, object] as const,
    ),
  );
  const storageMismatches = unionKeys(expectedStorage, restoredStorage).filter((key) => {
    const expected = expectedStorage.get(key);
    const restored = restoredStorage.get(key);
    return (
      !expected ||
      !restored ||
      expected.size !== restored.size ||
      expected.content_sha256 !== restored.content_sha256 ||
      expected.metadata_sha256 !== restored.metadata_sha256
    );
  });
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  const proofPayload = {
    store_id: input.expected.store_id,
    export_job_id: input.exportJobId,
    database_manifest_sha256: input.expected.database_manifest_sha256,
    storage_manifest_sha256: input.expected.storage_manifest_sha256,
    table_mismatches: tableMismatches,
    storage_mismatches: storageMismatches,
    verified_at: verifiedAt,
  };
  return {
    store_id: input.expected.store_id,
    export_job_id: input.exportJobId,
    verified: tableMismatches.length === 0 && storageMismatches.length === 0,
    table_mismatches: tableMismatches,
    storage_mismatches: storageMismatches,
    proof_sha256: sha256(stableJson(proofPayload)),
    verified_at: verifiedAt,
  };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertCompleteCatalog(catalog: StoreExportCatalogEntry[]) {
  const names = new Set<string>();
  for (const table of catalog) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(table.tableName) || names.has(table.tableName)) {
      throw new Error("导出目录包含无效或重复的数据表");
    }
    if (table.primaryKeyColumns.length === 0) {
      throw new Error(`导出表 ${table.tableName} 缺少稳定主键`);
    }
    names.add(table.tableName);
  }
}

function assertStoreBoundStorageObject(storeId: string, object: StoreExportStorageObject) {
  if (!STORE_EXPORT_BUCKETS.includes(object.bucket as (typeof STORE_EXPORT_BUCKETS)[number])) {
    throw new Error("导出器返回了未批准的 Storage bucket");
  }
  if (!object.path.startsWith(`${storeId}/`) || object.path.includes("../")) {
    throw new Error("Storage 对象不属于目标店铺 UUID 前缀");
  }
  if (object.size !== object.bytes.byteLength || object.size < 0) {
    throw new Error("Storage 对象大小与读取内容不一致");
  }
}

function assertOpaqueArtifactReference(value: string) {
  if (!value || /(^|[?&])(token|signature|key)=/i.test(value)) {
    throw new Error("导出产物只能保存不含凭据的持久引用");
  }
}

function assertSha256(value: string, label: string) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} 无效`);
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function unionKeys<T>(left: Map<string, T>, right: Map<string, T>) {
  return [...new Set([...left.keys(), ...right.keys()])].sort();
}
