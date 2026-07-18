import type { StoreExportManifest, StoreRestoreProof } from "@/lib/repairdesk/types";
import { type DbRecord, fail, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

import {
  createCompleteStoreExport,
  STORE_EXPORT_BUCKETS,
  type StoreExportCatalogEntry,
  type StoreExportEncryptedSink,
  type StoreExportSource,
  verifyStoreRestore,
} from "./store-export-worker";
import { isStoreLifecycleExportWorkerEnabled } from "./store-lifecycle-feature-flags";

const DATABASE_PAGE_SIZE = 500;
const STORAGE_PAGE_SIZE = 100;
const STORAGE_OBJECT_LIMIT = 100_000;

export function createSupabaseStoreExportSource(): StoreExportSource {
  const supabase = getSupabaseAdmin();
  return {
    async listDatabaseCatalog() {
      const { data, error } = await supabase.rpc("repairdesk_store_data_catalog");
      fail(error, "读取店铺导出目录失败");
      return ((data ?? []) as DbRecord[]).map(
        (row): StoreExportCatalogEntry => ({
          tableName: requiredString(row.table_name),
          primaryKeyColumns: Array.isArray(row.primary_key_columns)
            ? row.primary_key_columns.filter((value): value is string => typeof value === "string")
            : [],
        }),
      );
    },
    async *iterateDatabaseRows({ storeId, table }) {
      let offset = 0;
      for (;;) {
        let query = supabase
          .from(table.tableName)
          .select("*")
          .eq(
            table.tableName === "stores" ? "id" : "store_id",
            storeId,
          ) as unknown as OrderedStoreExportQuery;
        for (const primaryKey of table.primaryKeyColumns) {
          query = query.order(primaryKey, { ascending: true });
        }
        const { data, error } = await query.range(offset, offset + DATABASE_PAGE_SIZE - 1);
        fail(error, `导出 ${table.tableName} 数据失败`);
        const rows = (data ?? []) as Record<string, unknown>[];
        for (const row of rows) yield row;
        if (rows.length < DATABASE_PAGE_SIZE) break;
        offset += rows.length;
      }
    },
    async *iterateStorageObjects({ storeId, buckets }) {
      let objectCount = 0;
      for (const bucket of buckets) {
        if (!STORE_EXPORT_BUCKETS.includes(bucket as (typeof STORE_EXPORT_BUCKETS)[number])) {
          throw new Error("导出请求包含未批准的 Storage bucket");
        }
        const pending = [storeId];
        while (pending.length > 0) {
          const prefix = pending.pop()!;
          let offset = 0;
          for (;;) {
            const { data, error } = await supabase.storage.from(bucket).list(prefix, {
              limit: STORAGE_PAGE_SIZE,
              offset,
              sortBy: { column: "name", order: "asc" },
            });
            fail(error, "读取店铺 Storage 清单失败");
            const entries = data ?? [];
            for (const entry of entries) {
              const path = `${prefix}/${entry.name}`;
              if (!(entry.id || entry.metadata)) {
                pending.push(path);
                continue;
              }
              objectCount += 1;
              if (objectCount > STORAGE_OBJECT_LIMIT) {
                throw new Error("店铺 Storage 对象超过单次导出安全上限");
              }
              const { data: blob, error: downloadError } = await supabase.storage
                .from(bucket)
                .download(path);
              fail(downloadError, "下载店铺 Storage 对象失败");
              if (!blob) throw new Error("Storage 对象内容为空");
              const bytes = new Uint8Array(await blob.arrayBuffer());
              yield {
                bucket,
                path,
                size: bytes.byteLength,
                metadata:
                  entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
                bytes,
              };
            }
            if (entries.length < STORAGE_PAGE_SIZE) break;
            offset += entries.length;
          }
        }
      }
    },
  };
}

export async function runSupabaseStoreExportJob(input: {
  exportJobId: string;
  storeId: string;
  actorId: string;
  schemaVersion: string;
  appVersion: string;
  sink: StoreExportEncryptedSink;
  source?: StoreExportSource;
}): Promise<StoreExportManifest> {
  if (!isStoreLifecycleExportWorkerEnabled()) {
    throw new Error("店铺完整导出 worker 未启用");
  }
  const supabase = getSupabaseAdmin();
  const source = input.source ?? createSupabaseStoreExportSource();
  const catalog = await source.listDatabaseCatalog();
  const cachedSource: StoreExportSource = {
    ...source,
    async listDatabaseCatalog() {
      return catalog;
    },
  };
  const { data: job, error: jobError } = await supabase
    .from("store_export_jobs")
    .update({ state: "exporting", updated_at: new Date().toISOString(), error_code: null })
    .eq("id", input.exportJobId)
    .eq("store_id", input.storeId)
    .eq("actor_id", input.actorId)
    .in("state", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  fail(jobError, "锁定店铺导出任务失败");
  if (!job) throw new Error("店铺导出任务不存在或状态已变化");

  try {
    const manifest = await createCompleteStoreExport({
      storeId: input.storeId,
      schemaVersion: input.schemaVersion,
      appVersion: input.appVersion,
      source: cachedSource,
      sink: input.sink,
    });
    const primaryKeys = new Map(catalog.map((table) => [table.tableName, table.primaryKeyColumns]));
    const { error: tableError } = await supabase.from("store_export_table_manifests").upsert(
      manifest.database_tables.map((table) => ({
        export_job_id: input.exportJobId,
        table_name: table.table_name,
        primary_key_columns: primaryKeys.get(table.table_name) ?? [],
        row_count: table.row_count,
        content_sha256: table.content_sha256,
      })),
      { onConflict: "export_job_id,table_name" },
    );
    fail(tableError, "保存数据库导出 manifest 失败");
    if (manifest.storage_objects.length > 0) {
      const { error: storageError } = await supabase.from("store_export_storage_objects").upsert(
        manifest.storage_objects.map((object) => ({
          export_job_id: input.exportJobId,
          bucket_id: object.bucket,
          object_path: object.path,
          byte_size: object.size,
          content_sha256: object.content_sha256,
          metadata_sha256: object.metadata_sha256,
        })),
        { onConflict: "export_job_id,bucket_id,object_path" },
      );
      fail(storageError, "保存 Storage 导出 manifest 失败");
    }
    const { error: completeError } = await supabase.rpc("repairdesk_complete_store_export_rpc", {
      p_export_job_id: input.exportJobId,
      p_store_id: input.storeId,
      p_actor_id: input.actorId,
      p_encrypted_artifact_ref: manifest.encrypted_artifact_ref,
      p_encryption_key_ref: manifest.encryption_key_ref,
      p_artifact_sha256: manifest.artifact_sha256,
    });
    fail(completeError, "完成店铺导出任务失败");
    return manifest;
  } catch (error) {
    await supabase
      .from("store_export_jobs")
      .update({
        state: "failed",
        error_code: exportErrorCode(error),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.exportJobId)
      .eq("store_id", input.storeId);
    throw error;
  }
}

export async function recordSupabaseStoreRestoreProof(input: {
  exportJobId: string;
  storeId: string;
  verifiedBy: string;
  isolatedEnvironmentRefHash: string;
  expected: StoreExportManifest;
  restored: StoreExportManifest;
  smokeChecks: Record<string, boolean>;
  verifiedAt?: string;
}): Promise<StoreRestoreProof> {
  if (!isStoreLifecycleExportWorkerEnabled()) {
    throw new Error("店铺完整导出 worker 未启用");
  }
  if (!/^[0-9a-f]{64}$/.test(input.isolatedEnvironmentRefHash)) {
    throw new Error("隔离恢复环境引用摘要无效");
  }
  const proof = verifyStoreRestore({
    exportJobId: input.exportJobId,
    expected: input.expected,
    restored: input.restored,
    verifiedAt: input.verifiedAt,
  });
  if (!proof.verified || input.smokeChecks.store_read !== true) {
    throw new Error("隔离恢复验证未通过，不能记录恢复证明");
  }
  const { error } = await getSupabaseAdmin().rpc("repairdesk_record_store_restore_proof_rpc", {
    p_proof_id: crypto.randomUUID(),
    p_export_job_id: input.exportJobId,
    p_store_id: input.storeId,
    p_verified_by: input.verifiedBy,
    p_isolated_environment_ref_hash: input.isolatedEnvironmentRefHash,
    p_database_manifest_sha256: input.expected.database_manifest_sha256,
    p_storage_manifest_sha256: input.expected.storage_manifest_sha256,
    p_table_mismatches: proof.table_mismatches,
    p_storage_mismatches: proof.storage_mismatches,
    p_smoke_checks: input.smokeChecks,
    p_proof_sha256: proof.proof_sha256,
  });
  fail(error, "记录店铺隔离恢复证明失败");
  return proof;
}

function exportErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown";
  return `STORE_EXPORT_${value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, 80)}`;
}

type OrderedStoreExportQuery = {
  order(column: string, options: { ascending: boolean }): OrderedStoreExportQuery;
  range(
    from: number,
    to: number,
  ): Promise<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};
