import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  orderPurgeCatalog,
  runNextStorePurge,
  type StorePurgeCheckpoint,
  type StorePurgeExecutorAdapter,
} from "./store-purge-worker";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

describe("store purge worker", () => {
  it("deletes Storage first, then child tables, proves zero residual and writes a tombstone", async () => {
    const fixture = adapterFixture();
    const result = await runNextStorePurge({
      workerId: "worker-1",
      adapter: fixture.adapter,
      batchSize: 2,
    });

    expect(result).toMatchObject({ status: "completed", jobId: "job-1", deletedRows: 4 });
    expect(fixture.events.indexOf("storage:delete")).toBeLessThan(
      fixture.events.indexOf("table:order_events"),
    );
    expect(fixture.events.indexOf("table:order_events")).toBeLessThan(
      fixture.events.indexOf("table:repair_orders"),
    );
    expect(fixture.events.indexOf("database:prepare")).toBeLessThan(
      fixture.events.indexOf("table:order_events"),
    );
    expect(fixture.completed).toBe(true);
  });

  it("persists a retryable checkpoint and never completes when other-tenant proof changes", async () => {
    const fixture = adapterFixture({ changeOtherTenantGuard: true });
    const result = await runNextStorePurge({ workerId: "worker-1", adapter: fixture.adapter });

    expect(result).toEqual({
      status: "failed",
      jobId: "job-1",
      errorCode: "STORE_PURGE_OTHER_TENANT_CHANGED",
    });
    expect(fixture.completed).toBe(false);
    expect(fixture.checkpoints.at(-1)).toMatchObject({
      stepKey: "verify_database_zero",
      state: "failed",
    });
  });

  it("rejects a cyclic catalog before issuing any table deletion", () => {
    expect(() =>
      orderPurgeCatalog([
        { tableName: "a", dependsOn: ["b"] },
        { tableName: "b", dependsOn: ["a"] },
      ]),
    ).toThrow("cyclic_purge_catalog");
  });

  it("keeps every child before its parent even when the parent sorts first alphabetically", () => {
    expect(
      orderPurgeCatalog([
        { tableName: "customers", dependsOn: [] },
        { tableName: "repair_orders", dependsOn: ["customers"] },
        { tableName: "audit_events", dependsOn: ["repair_orders"] },
      ]).map((entry) => entry.tableName),
    ).toEqual(["audit_events", "repair_orders", "customers"]);
  });
});

function adapterFixture(options: { changeOtherTenantGuard?: boolean } = {}) {
  const checkpoints: StorePurgeCheckpoint[] = [];
  const events: string[] = [];
  const tableRows = new Map([
    ["order_events", 2],
    ["repair_orders", 2],
  ]);
  let storageObjects = 3;
  let guardReads = 0;
  let completed = false;
  const adapter: StorePurgeExecutorAdapter = {
    async claimJob() {
      return { id: "job-1", storeId: "store-1", exportJobId: "export-1", operationId: "op-1" };
    },
    async renewLease() {},
    async computeOtherTenantGuard() {
      guardReads += 1;
      return options.changeOtherTenantGuard && guardReads > 1
        ? digest("changed")
        : digest("stable");
    },
    async startJob() {
      events.push("start");
    },
    async listCatalog() {
      return [
        { tableName: "repair_orders", dependsOn: [] },
        { tableName: "order_events", dependsOn: ["repair_orders"] },
      ];
    },
    async deleteStorageBatch(_job, limit) {
      events.push("storage:delete");
      const deleted = Math.min(limit, storageObjects);
      storageObjects -= deleted;
      return deleted;
    },
    async countStorageObjects() {
      return storageObjects;
    },
    async prepareDatabaseDelete() {
      events.push("database:prepare");
    },
    async deleteTableBatch(_job, _workerId, tableName, limit) {
      events.push(`table:${tableName}`);
      const remaining = tableRows.get(tableName) ?? 0;
      const deleted = Math.min(limit, remaining);
      tableRows.set(tableName, remaining - deleted);
      return deleted;
    },
    async readResidualCounts() {
      return Object.fromEntries(tableRows);
    },
    async checkpoint(_jobId, _workerId, checkpoint) {
      checkpoints.push(checkpoint);
    },
    async markZeroProof() {},
    async complete() {
      completed = true;
      return { storeIdHash: digest("store-1") };
    },
  };
  return {
    adapter,
    checkpoints,
    events,
    get completed() {
      return completed;
    },
  };
}
