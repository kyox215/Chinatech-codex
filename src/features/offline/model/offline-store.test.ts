import { describe, expect, it } from "vitest";

import {
  containsOfflineSensitiveUnlockKey,
  createRepairDeskOfflineMemoryStore,
} from "./offline-store";
import type {
  RepairDeskOfflineAttachmentStagingEntry,
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineSensitiveVaultEntry,
} from "./offline-types";
import {
  REPAIRDESK_OFFLINE_DATABASE_NAME,
  REPAIRDESK_OFFLINE_SCHEMA_VERSION,
  repairDeskOfflineStoreNames,
} from "./offline-types";

const storeId = "store_1";
const userId = "user_1";
const now = "2026-07-06T20:00:00.000Z";
const later = "2026-07-07T20:00:00.000Z";

describe("RepairDesk offline storage foundation", () => {
  it("declares a versioned offline database and required stores", () => {
    expect(REPAIRDESK_OFFLINE_DATABASE_NAME).toBe("repairdesk_offline");
    expect(REPAIRDESK_OFFLINE_SCHEMA_VERSION).toBe(1);
    expect(repairDeskOfflineStoreNames).toEqual([
      "repairdesk_order_drafts",
      "repairdesk_outbox",
      "repairdesk_sensitive_vault",
      "repairdesk_attachment_staging",
      "repairdesk_sync_meta",
    ]);
  });

  it("stores order drafts with customer and device relationship metadata", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    const draft = orderDraft({
      draftPayload: {
        customer_name: "Mario Rossi",
        customer_phone: "+39 333 000 0000",
        issue_description: "Broken screen",
      },
      customerLinkMode: "existing_customer",
      customerLinkDraft: {
        customerId: "customer_1",
        customerUpdatedAt: now,
        snapshot: { display_name: "Mario Rossi", phone: "+39 333 000 0000" },
      },
      deviceLinkMode: "existing_customer_device",
      deviceLinkDraft: {
        deviceId: "device_1",
        snapshot: { brand: "Apple", model: "iPhone 14" },
      },
    });

    await expect(store.putOrderDraft(draft)).resolves.toEqual({ ok: true, value: draft });

    const stored = await store.getOrderDraft("draft_1", { storeId, userId });
    expect(stored.ok && stored.value?.customerLinkMode).toBe("existing_customer");
    expect(stored.ok && stored.value?.deviceLinkDraft?.deviceId).toBe("device_1");
  });

  it("rejects raw device unlock secrets in ordinary order drafts", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    const result = await store.putOrderDraft(
      orderDraft({
        draftPayload: {
          customer_name: "Mario Rossi",
          device_unlock_value: "1234",
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("validation_failed");
  });

  it("stores outbox entries and requires conflict metadata for updates", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    const createEntry = outboxEntry({ action: "create" });
    const updateEntry = outboxEntry({
      operationId: "op_2",
      action: "update",
      status: "pending_sync",
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

    const pending = await store.listOutboxEntries({ storeId, userId, status: "pending_sync" });
    expect(pending.ok && pending.value.map((entry) => entry.operationId)).toEqual(["op_1", "op_2"]);

    await expect(store.deleteOutboxEntry("op_1", { storeId, userId })).resolves.toEqual({
      ok: true,
      value: true,
    });
    const afterDelete = await store.listOutboxEntries({ storeId, userId, status: "pending_sync" });
    expect(afterDelete.ok && afterDelete.value.map((entry) => entry.operationId)).toEqual(["op_2"]);

    const staleUpdate = await store.putOutboxEntry(
      outboxEntry({ operationId: "op_3", action: "update", serverOrderId: "order_1" }),
    );
    expect(staleUpdate.ok).toBe(false);
    expect(!staleUpdate.ok && staleUpdate.error.message).toContain("baseUpdatedAt");

    const missingServerOrder = await store.putOutboxEntry(
      outboxEntry({ operationId: "op_4", action: "update", baseUpdatedAt: now }),
    );
    expect(missingServerOrder.ok).toBe(false);
    expect(!missingServerOrder.ok && missingServerOrder.error.message).toContain("server order id");
  });

  it("stores sensitive vault metadata only and rejects encrypted or raw secret fields", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    const vaultEntry = sensitiveVaultEntry({
      fieldType: "pin",
    });

    await expect(store.putSensitiveVaultEntry(vaultEntry)).resolves.toEqual({
      ok: true,
      value: vaultEntry,
    });

    const unsafe = await store.putSensitiveVaultEntry(
      sensitiveVaultEntry({
        vaultEntryId: "vault_2",
        rawPin: "1234",
      } as Partial<RepairDeskOfflineSensitiveVaultEntry>),
    );
    expect(unsafe.ok).toBe(false);
    expect(!unsafe.ok && unsafe.error.code).toBe("validation_failed");

    const encryptedTooEarly = await store.putSensitiveVaultEntry(
      sensitiveVaultEntry({
        vaultEntryId: "vault_3",
        encryptedValue: "encrypted",
      } as Partial<RepairDeskOfflineSensitiveVaultEntry>),
    );
    expect(encryptedTooEarly.ok).toBe(false);
    expect(!encryptedTooEarly.ok && encryptedTooEarly.error.message).toContain("metadata only");
  });

  it("does not return records from a different store or user scope", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOrderDraft(orderDraft());

    const wrongStore = await store.getOrderDraft("draft_1", { storeId: "store_2", userId });
    expect(wrongStore.ok).toBe(false);
    expect(!wrongStore.ok && wrongStore.error.code).toBe("context_mismatch");

    const list = await store.listOrderDrafts({ storeId: "store_2", userId });
    expect(list).toEqual({ ok: true, value: [] });

    const deleted = await store.deleteOrderDraft("draft_1", { storeId: "store_2", userId });
    expect(deleted.ok).toBe(false);
    expect(!deleted.ok && deleted.error.code).toBe("context_mismatch");
  });

  it("detects nested unlock secret key names", () => {
    expect(
      containsOfflineSensitiveUnlockKey({
        device: {
          unlock: {
            passcode: "1234",
          },
        },
      }),
    ).toBe(true);
    expect(
      containsOfflineSensitiveUnlockKey({
        customer: { phone: "+39 333 000 0000" },
        device: { imei: "123456789012345" },
      }),
    ).toBe(false);
  });

  it("cleans up expired draft, vault, and attachment records", async () => {
    const store = createRepairDeskOfflineMemoryStore();
    await store.putOrderDraft(orderDraft({ expiresAt: "2026-07-05T20:00:00.000Z" }));
    await store.putOrderDraft(orderDraft({ localDraftId: "draft_2", expiresAt: later }));
    await store.putSensitiveVaultEntry(
      sensitiveVaultEntry({ expiresAt: "2026-07-05T20:00:00.000Z" }),
    );
    await store.putAttachmentStagingEntry(
      attachmentEntry({ expiresAt: "2026-07-05T20:00:00.000Z" }),
    );

    await expect(store.cleanupExpired(now)).resolves.toEqual({
      ok: true,
      value: { orderDrafts: 1, sensitiveVaultEntries: 1, attachmentStagingEntries: 1 },
    });

    const drafts = await store.listOrderDrafts({ storeId, userId });
    expect(drafts.ok && drafts.value.map((draft) => draft.localDraftId)).toEqual(["draft_2"]);
  });

  it("reports unavailable storage and quota failures without throwing", async () => {
    const unavailable = createRepairDeskOfflineMemoryStore({ unavailable: true });
    const health = await unavailable.healthCheck();
    expect(health.ok && health.value.available).toBe(false);
    expect((await unavailable.listOrderDrafts({ storeId, userId })).ok).toBe(false);

    const quotaLimited = createRepairDeskOfflineMemoryStore({ failWritesWith: "quota_exceeded" });
    const result = await quotaLimited.putOrderDraft(orderDraft());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("quota_exceeded");
  });
});

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
    payload: { customer_name: "Mario Rossi", issue_description: "Broken screen" },
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
