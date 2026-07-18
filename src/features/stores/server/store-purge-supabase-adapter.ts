import { STORE_EXPORT_BUCKETS } from "./store-export-worker";
import { isStoreLifecyclePurgeWorkerEnabled } from "./store-lifecycle-feature-flags";
import {
  runNextStorePurge,
  type StorePurgeCatalogEntry,
  type StorePurgeCheckpoint,
  type StorePurgeExecutorAdapter,
} from "./store-purge-worker";
import { type DbRecord, fail, requiredString } from "@/server/repairdesk-shared";
import { getSupabaseAdmin } from "@/server/supabase";

const STORAGE_LIST_LIMIT = 100;
const STORAGE_OBJECT_SAFETY_LIMIT = 100_000;

export function createSupabaseStorePurgeAdapter(): StorePurgeExecutorAdapter {
  const supabase = getSupabaseAdmin();
  return {
    async claimJob(workerId) {
      await rpc("repairdesk_queue_due_store_purge_jobs", {});
      const data = await rpc("repairdesk_claim_store_purge_job", {
        p_worker_id: workerId,
        p_lease_seconds: 120,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") return null;
      const record = row as DbRecord;
      return {
        id: requiredString(record.id),
        storeId: requiredString(record.store_id),
        exportJobId: requiredString(record.export_job_id),
        operationId: requiredString(record.operation_id),
      };
    },
    async renewLease(jobId, workerId) {
      await rpc("repairdesk_renew_store_purge_lease_rpc", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_lease_seconds: 120,
      });
    },
    async computeOtherTenantGuard(storeId) {
      const data = await rpc("repairdesk_other_tenant_guard_sha256", { p_store_id: storeId });
      return requiredString(data);
    },
    async startJob(job, workerId, otherTenantGuard) {
      await rpc("repairdesk_start_store_purge_rpc", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_other_tenant_before_sha256: otherTenantGuard,
      });
    },
    async listCatalog() {
      const data = await rpc("repairdesk_store_purge_catalog", {});
      return ((data ?? []) as DbRecord[]).map(
        (row): StorePurgeCatalogEntry => ({
          tableName: requiredString(row.table_name),
          dependsOn: Array.isArray(row.depends_on)
            ? row.depends_on.filter((value): value is string => typeof value === "string")
            : [],
        }),
      );
    },
    async deleteStorageBatch(job, limit) {
      const objects = await listStoreStorageObjects(
        job.storeId,
        Math.min(limit, STORAGE_LIST_LIMIT),
      );
      if (objects.length === 0) return 0;
      let deleted = 0;
      for (const [bucket, paths] of groupStoragePaths(objects)) {
        const { error } = await supabase.storage.from(bucket).remove(paths);
        fail(error, "删除店铺 Storage 批次失败");
        deleted += paths.length;
      }
      return deleted;
    },
    async countStorageObjects(job) {
      return (await listStoreStorageObjects(job.storeId, STORAGE_OBJECT_SAFETY_LIMIT)).length;
    },
    async prepareDatabaseDelete(job, workerId) {
      await rpc("repairdesk_prepare_store_purge_database_rpc", {
        p_job_id: job.id,
        p_worker_id: workerId,
      });
    },
    async deleteTableBatch(job, workerId, tableName, limit) {
      const data = await rpc("repairdesk_purge_store_table_batch_rpc", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_table_name: tableName,
        p_batch_size: limit,
      });
      return Number((data as DbRecord | null)?.deleted_count ?? 0);
    },
    async readResidualCounts(storeId) {
      const data = await rpc("repairdesk_store_purge_residual_counts", { p_store_id: storeId });
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([tableName, count]) => [
          tableName,
          Number(count),
        ]),
      );
    },
    async checkpoint(jobId, workerId, checkpoint) {
      await writeCheckpoint(jobId, workerId, checkpoint);
    },
    async markZeroProof(input) {
      await rpc("repairdesk_mark_store_purge_zero_proof_rpc", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_storage_object_count: input.storageObjectCount,
        p_other_tenant_after_sha256: input.otherTenantAfterSha256,
      });
    },
    async complete(input) {
      const data = await rpc("repairdesk_complete_store_purge_rpc", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_zero_residual_proof_sha256: input.zeroResidualProofSha256,
        p_other_tenant_after_sha256: input.otherTenantAfterSha256,
      });
      return { storeIdHash: requiredString((data as DbRecord | null)?.store_id_hash) };
    },
  };

  async function rpc(name: string, params: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(name, params);
    fail(error, `店铺清除 RPC ${name} 失败`);
    return data;
  }

  async function listStoreStorageObjects(storeId: string, maxObjects: number) {
    const objects: Array<{ bucket: string; path: string }> = [];
    for (const bucket of STORE_EXPORT_BUCKETS) {
      const pending = [storeId];
      while (pending.length > 0 && objects.length < maxObjects) {
        const prefix = pending.pop()!;
        let offset = 0;
        for (;;) {
          const { data, error } = await supabase.storage.from(bucket).list(prefix, {
            limit: STORAGE_LIST_LIMIT,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          fail(error, "读取店铺 Storage 对象失败");
          const entries = data ?? [];
          for (const entry of entries) {
            const path = `${prefix}/${entry.name}`;
            if (entry.id || entry.metadata) objects.push({ bucket, path });
            else pending.push(path);
            if (objects.length >= maxObjects) break;
          }
          if (objects.length >= maxObjects || entries.length < STORAGE_LIST_LIMIT) break;
          offset += entries.length;
        }
      }
    }
    if (objects.length > STORAGE_OBJECT_SAFETY_LIMIT) {
      throw new Error("STORE_PURGE_STORAGE_SAFETY_LIMIT");
    }
    return objects;
  }

  async function writeCheckpoint(
    jobId: string,
    workerId: string,
    checkpoint: StorePurgeCheckpoint,
  ) {
    await rpc("repairdesk_checkpoint_store_purge_step_rpc", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_step_key: checkpoint.stepKey,
      p_state: checkpoint.state,
      p_cursor: checkpoint.cursor ?? {},
      p_progress: checkpoint.progress ?? {},
      p_row_count: checkpoint.rowCount ?? null,
      p_result_sha256: checkpoint.resultSha256 ?? null,
      p_error_code: checkpoint.errorCode ?? null,
    });
  }
}

export async function runSupabaseStorePurgeWorker(workerId: string) {
  if (!isStoreLifecyclePurgeWorkerEnabled()) {
    throw new Error("店铺永久清除 worker 未启用");
  }
  if (!/^[A-Za-z0-9:_-]{3,120}$/.test(workerId)) throw new Error("清除 worker id 无效");
  return runNextStorePurge({ workerId, adapter: createSupabaseStorePurgeAdapter() });
}

function groupStoragePaths(objects: Array<{ bucket: string; path: string }>) {
  const grouped = new Map<string, string[]>();
  for (const object of objects) {
    const paths = grouped.get(object.bucket) ?? [];
    paths.push(object.path);
    grouped.set(object.bucket, paths);
  }
  return grouped;
}
