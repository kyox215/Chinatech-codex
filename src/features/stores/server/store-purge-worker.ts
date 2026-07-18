import { createHash } from "node:crypto";

export interface StorePurgeClaim {
  id: string;
  storeId: string;
  exportJobId: string;
  operationId: string;
}

export interface StorePurgeCatalogEntry {
  tableName: string;
  dependsOn: string[];
}

export interface StorePurgeCheckpoint {
  stepKey: string;
  state: "running" | "completed" | "failed";
  cursor?: Record<string, unknown>;
  progress?: Record<string, unknown>;
  rowCount?: number;
  resultSha256?: string;
  errorCode?: string;
}

export interface StorePurgeExecutorAdapter {
  claimJob(workerId: string): Promise<StorePurgeClaim | null>;
  renewLease(jobId: string, workerId: string): Promise<void>;
  computeOtherTenantGuard(storeId: string): Promise<string>;
  startJob(job: StorePurgeClaim, workerId: string, otherTenantGuard: string): Promise<void>;
  listCatalog(): Promise<StorePurgeCatalogEntry[]>;
  deleteStorageBatch(job: StorePurgeClaim, limit: number): Promise<number>;
  countStorageObjects(job: StorePurgeClaim): Promise<number>;
  prepareDatabaseDelete(job: StorePurgeClaim, workerId: string): Promise<void>;
  deleteTableBatch(
    job: StorePurgeClaim,
    workerId: string,
    tableName: string,
    limit: number,
  ): Promise<number>;
  readResidualCounts(storeId: string): Promise<Record<string, number>>;
  checkpoint(jobId: string, workerId: string, checkpoint: StorePurgeCheckpoint): Promise<void>;
  markZeroProof(input: {
    jobId: string;
    workerId: string;
    storageObjectCount: number;
    otherTenantAfterSha256: string;
  }): Promise<void>;
  complete(input: {
    jobId: string;
    workerId: string;
    zeroResidualProofSha256: string;
    otherTenantAfterSha256: string;
  }): Promise<{ storeIdHash: string }>;
}

export type StorePurgeWorkerResult =
  | { status: "idle" }
  | { status: "completed"; jobId: string; storeIdHash: string; deletedRows: number }
  | { status: "failed"; jobId: string; errorCode: string };

const MAX_BATCH_ITERATIONS = 100_000;

export async function runNextStorePurge(input: {
  workerId: string;
  adapter: StorePurgeExecutorAdapter;
  batchSize?: number;
}): Promise<StorePurgeWorkerResult> {
  const batchSize = Math.max(1, Math.min(input.batchSize ?? 500, 2_000));
  const job = await input.adapter.claimJob(input.workerId);
  if (!job) return { status: "idle" };

  let activeStep = "prepare";
  let deletedRows = 0;
  try {
    const otherTenantBefore = await input.adapter.computeOtherTenantGuard(job.storeId);
    assertSha256(otherTenantBefore, "other-tenant before proof");
    await input.adapter.startJob(job, input.workerId, otherTenantBefore);

    activeStep = "storage_delete_batches";
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "running",
    });
    let storageDeleted = 0;
    for (let iteration = 0; iteration < MAX_BATCH_ITERATIONS; iteration += 1) {
      await input.adapter.renewLease(job.id, input.workerId);
      const deleted = await input.adapter.deleteStorageBatch(job, batchSize);
      storageDeleted += deleted;
      if (deleted === 0) break;
      if (iteration === MAX_BATCH_ITERATIONS - 1) throw new Error("storage_iteration_limit");
    }
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "completed",
      rowCount: storageDeleted,
      progress: { deletedObjects: storageDeleted },
      resultSha256: sha256(`storage:${storageDeleted}`),
    });

    activeStep = "verify_storage_zero";
    const storageObjectCount = await input.adapter.countStorageObjects(job);
    if (storageObjectCount !== 0) throw new Error("storage_residual");
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "completed",
      rowCount: 0,
      resultSha256: sha256("storage:zero"),
    });

    activeStep = "database_delete_batches";
    await input.adapter.prepareDatabaseDelete(job, input.workerId);
    const catalog = orderPurgeCatalog(await input.adapter.listCatalog());
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "running",
      progress: { tables: catalog.length },
    });
    for (const table of catalog) {
      let tableDeleted = 0;
      for (let iteration = 0; iteration < MAX_BATCH_ITERATIONS; iteration += 1) {
        await input.adapter.renewLease(job.id, input.workerId);
        const deleted = await input.adapter.deleteTableBatch(
          job,
          input.workerId,
          table.tableName,
          batchSize,
        );
        tableDeleted += deleted;
        deletedRows += deleted;
        if (deleted === 0) break;
        if (iteration === MAX_BATCH_ITERATIONS - 1) throw new Error("database_iteration_limit");
      }
      await input.adapter.checkpoint(job.id, input.workerId, {
        stepKey: activeStep,
        state: "running",
        cursor: { tableName: table.tableName },
        progress: { tableDeleted, deletedRows },
        rowCount: deletedRows,
      });
    }
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "completed",
      rowCount: deletedRows,
      resultSha256: sha256(`database:${deletedRows}`),
    });

    activeStep = "verify_database_zero";
    const residualCounts = await input.adapter.readResidualCounts(job.storeId);
    const nonzeroResiduals = Object.fromEntries(
      Object.entries(residualCounts).filter(([, count]) => count !== 0),
    );
    if (Object.keys(nonzeroResiduals).length > 0) throw new Error("database_residual");
    const otherTenantAfter = await input.adapter.computeOtherTenantGuard(job.storeId);
    if (otherTenantAfter !== otherTenantBefore) throw new Error("other_tenant_changed");
    await input.adapter.markZeroProof({
      jobId: job.id,
      workerId: input.workerId,
      storageObjectCount,
      otherTenantAfterSha256: otherTenantAfter,
    });
    const zeroResidualProofSha256 = sha256(
      stableJson({
        jobId: job.id,
        operationId: job.operationId,
        storageObjectCount,
        residualCounts: nonzeroResiduals,
        otherTenantBefore,
        otherTenantAfter,
      }),
    );
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "completed",
      rowCount: 0,
      resultSha256: zeroResidualProofSha256,
    });

    activeStep = "write_tombstone";
    await input.adapter.checkpoint(job.id, input.workerId, {
      stepKey: activeStep,
      state: "running",
    });
    const completed = await input.adapter.complete({
      jobId: job.id,
      workerId: input.workerId,
      zeroResidualProofSha256,
      otherTenantAfterSha256: otherTenantAfter,
    });
    return { status: "completed", jobId: job.id, storeIdHash: completed.storeIdHash, deletedRows };
  } catch (error) {
    const errorCode = normalizePurgeError(error);
    try {
      await input.adapter.checkpoint(job.id, input.workerId, {
        stepKey: activeStep,
        state: "failed",
        rowCount: deletedRows,
        errorCode,
      });
    } catch {
      // The lease may already be gone. The durable job remains claimable after lease expiry.
    }
    return { status: "failed", jobId: job.id, errorCode };
  }
}

export function orderPurgeCatalog(catalog: StorePurgeCatalogEntry[]) {
  const byName = new Map(catalog.map((entry) => [entry.tableName, entry] as const));
  if (byName.size !== catalog.length) throw new Error("duplicate_purge_catalog_table");
  const dependentCounts = new Map<string, number>();
  const parentsByChild = new Map<string, string[]>();
  for (const entry of catalog) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(entry.tableName)) {
      throw new Error("invalid_purge_catalog");
    }
    dependentCounts.set(entry.tableName, dependentCounts.get(entry.tableName) ?? 0);
    const parents = [...new Set(entry.dependsOn.filter((parent) => byName.has(parent)))].sort();
    parentsByChild.set(entry.tableName, parents);
    for (const parent of parents) {
      dependentCounts.set(parent, (dependentCounts.get(parent) ?? 0) + 1);
    }
  }

  const ready = [...byName.keys()]
    .filter((tableName) => dependentCounts.get(tableName) === 0)
    .sort();
  const ordered: StorePurgeCatalogEntry[] = [];
  while (ready.length > 0) {
    const tableName = ready.shift()!;
    ordered.push(byName.get(tableName)!);
    for (const parent of parentsByChild.get(tableName) ?? []) {
      const remaining = (dependentCounts.get(parent) ?? 0) - 1;
      dependentCounts.set(parent, remaining);
      if (remaining === 0) {
        ready.push(parent);
        ready.sort();
      }
    }
  }
  if (ordered.length !== catalog.length) throw new Error("cyclic_purge_catalog");
  return ordered;
}

function normalizePurgeError(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown";
  return `STORE_PURGE_${value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, 80)}`;
}

function assertSha256(value: string, label: string) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label}_invalid`);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
