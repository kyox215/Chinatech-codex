import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  createCompleteStoreExport,
  type StoreExportEncryptedSink,
  type StoreExportSource,
  verifyStoreRestore,
} from "./store-export-worker";

const storeId = "00000000-0000-4000-8000-000000000123";

describe("complete store export and restore proof", () => {
  it("exports every catalog table and UUID-bound Storage object with deterministic hashes", async () => {
    const writtenRows: string[] = [];
    const writtenObjects: string[] = [];
    const source = sourceFixture();
    const sink: StoreExportEncryptedSink = {
      writeDatabaseRow: vi.fn(async (table, row) => {
        writtenRows.push(`${table}:${row}`);
      }),
      writeStorageObject: vi.fn(async (object) => {
        writtenObjects.push(object.path);
      }),
      finalize: vi.fn(async () => ({
        encryptedArtifactRef: "vault://exports/job-1",
        encryptionKeyRef: "kms://keys/store-export-v1",
        artifactSha256: createHash("sha256").update("artifact").digest("hex"),
      })),
    };

    const manifest = await createCompleteStoreExport({
      storeId,
      schemaVersion: "schema-1",
      appVersion: "app-1",
      source,
      sink,
    });

    expect(manifest.database_tables.map((table) => [table.table_name, table.row_count])).toEqual([
      ["customers", 1],
      ["repair_orders", 2],
    ]);
    expect(manifest.storage_objects).toHaveLength(1);
    expect(writtenRows).toHaveLength(3);
    expect(writtenObjects).toEqual([`${storeId}/orders/photo.jpg`]);
    expect(manifest.encrypted_artifact_ref).toBe("vault://exports/job-1");
  });

  it("proves an exact isolated restore and identifies changed rows or files", async () => {
    const source = sourceFixture();
    const sink = sinkFixture();
    const expected = await createCompleteStoreExport({
      storeId,
      schemaVersion: "schema-1",
      appVersion: "app-1",
      source,
      sink,
    });
    const exact = verifyStoreRestore({
      exportJobId: "job-1",
      expected,
      restored: expected,
      verifiedAt: "2026-07-17T20:00:00.000Z",
    });
    expect(exact).toMatchObject({ verified: true, table_mismatches: [], storage_mismatches: [] });

    const changed = verifyStoreRestore({
      exportJobId: "job-1",
      expected,
      restored: {
        ...expected,
        database_tables: expected.database_tables.map((table) =>
          table.table_name === "repair_orders" ? { ...table, row_count: 1 } : table,
        ),
        storage_objects: expected.storage_objects.map((object) => ({ ...object, size: 2 })),
      },
      verifiedAt: "2026-07-17T20:00:00.000Z",
    });
    expect(changed).toMatchObject({
      verified: false,
      table_mismatches: ["repair_orders"],
      storage_mismatches: [`repairdesk-order-attachments:${storeId}/orders/photo.jpg`],
    });
  });

  it("rejects cross-store Storage paths before writing them", async () => {
    const source = sourceFixture(`${storeId}-wrong/orders/photo.jpg`);
    await expect(
      createCompleteStoreExport({
        storeId,
        schemaVersion: "schema-1",
        appVersion: "app-1",
        source,
        sink: sinkFixture(),
      }),
    ).rejects.toThrow("不属于目标店铺");
  });
});

function sourceFixture(storagePath = `${storeId}/orders/photo.jpg`): StoreExportSource {
  return {
    async listDatabaseCatalog() {
      return [
        { tableName: "repair_orders", primaryKeyColumns: ["id"] },
        { tableName: "customers", primaryKeyColumns: ["id"] },
      ];
    },
    async *iterateDatabaseRows({ table }) {
      if (table.tableName === "customers") yield { id: "customer-1", store_id: storeId };
      if (table.tableName === "repair_orders") {
        yield { id: "order-1", store_id: storeId };
        yield { id: "order-2", store_id: storeId };
      }
    },
    async *iterateStorageObjects() {
      yield {
        bucket: "repairdesk-order-attachments",
        path: storagePath,
        size: 3,
        metadata: { contentType: "image/jpeg" },
        bytes: new Uint8Array([1, 2, 3]),
      };
    },
  };
}

function sinkFixture(): StoreExportEncryptedSink {
  return {
    async writeDatabaseRow() {},
    async writeStorageObject() {},
    async finalize() {
      return {
        encryptedArtifactRef: "vault://exports/job-1",
        encryptionKeyRef: "kms://keys/store-export-v1",
        artifactSha256: createHash("sha256").update("artifact").digest("hex"),
      };
    },
  };
}
