import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createRepairDeskOfflineOrderService } from "./offline-order-service";
import { createRepairDeskOfflineMemoryStore } from "./offline-store";
import type {
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineRelationshipPlan,
  RepairDeskOfflineStoreName,
} from "./offline-types";
import type { RepairDeskOfflineStore } from "./offline-store";

const storeId = "store_1";
const userId = "user_1";
const scope = { storeId, userId };
const firstNow = "2026-07-06T20:00:00.000Z";
const secondNow = "2026-07-06T20:01:00.000Z";

describe("RepairDesk offline order autosave/outbox service", () => {
  it("autosaves a new create draft with scoped local ids and relationship metadata", async () => {
    const { service } = createServiceHarness();

    const saved = await service.saveDraft({
      mode: "create",
      draftPayload: safePayload(),
      relationshipPlan: existingCustomerRelationship(),
      attachmentStagingIds: ["attachment_1"],
    });

    expect(saved).toEqual({
      ok: true,
      value: {
        localDraftId: "draft_id_1",
        localOrderId: "local_order_id_2",
        storeId,
        userId,
        mode: "create",
        draftPayload: safePayload(),
        customerLinkMode: "existing_customer",
        customerLinkDraft: existingCustomerRelationship().customerLinkDraft,
        deviceLinkMode: "existing_customer_device",
        deviceLinkDraft: existingCustomerRelationship().deviceLinkDraft,
        hasSensitiveVaultEntry: false,
        attachmentStagingIds: ["attachment_1"],
        createdAt: firstNow,
        updatedAt: firstNow,
        expiresAt: "2026-07-20T20:00:00.000Z",
        status: "draft_local",
      },
    });
  });

  it("updates an existing draft without changing createdAt or local ids", async () => {
    const harness = createServiceHarness();
    const initial = await harness.service.saveDraft({
      mode: "create",
      draftPayload: safePayload({ issueDescription: "Broken screen" }),
      relationshipPlan: walkInRelationship(),
    });
    expect(initial.ok).toBe(true);

    harness.setNow(secondNow);
    const updated = await harness.service.saveDraft({
      localDraftId: "draft_id_1",
      mode: "create",
      draftPayload: safePayload({ issueDescription: "Battery issue" }),
      relationshipPlan: walkInRelationship(),
    });

    expect(updated.ok && updated.value.localOrderId).toBe("local_order_id_2");
    expect(updated.ok && updated.value.createdAt).toBe(firstNow);
    expect(updated.ok && updated.value.updatedAt).toBe(secondNow);
    expect(updated.ok && updated.value.draftPayload.issueDescription).toBe("Battery issue");
  });

  it("rejects unsafe autosave payloads and edit drafts missing server conflict metadata", async () => {
    const { service, store } = createServiceHarness();

    const missingServerOrder = await service.saveDraft({
      mode: "edit",
      baseUpdatedAt: firstNow,
      draftPayload: safePayload(),
      relationshipPlan: walkInRelationship(),
    });
    expect(missingServerOrder.ok).toBe(false);
    expect(!missingServerOrder.ok && missingServerOrder.error.message).toContain("server order id");

    const missingEditMetadata = await service.saveDraft({
      mode: "edit",
      serverOrderId: "order_1",
      draftPayload: safePayload(),
      relationshipPlan: walkInRelationship(),
    });
    expect(missingEditMetadata.ok).toBe(false);
    expect(!missingEditMetadata.ok && missingEditMetadata.error.code).toBe("validation_failed");

    const rawUnlock = await service.saveDraft({
      mode: "create",
      draftPayload: safePayload({ device_unlock_value: "1234" }),
      relationshipPlan: walkInRelationship(),
    });
    expect(rawUnlock.ok).toBe(false);

    const highRiskAction = await service.saveDraft({
      mode: "create",
      draftPayload: safePayload({ paymentCaptured: true }),
      relationshipPlan: walkInRelationship(),
    });
    expect(highRiskAction.ok).toBe(false);

    const fullFormSpread = await service.saveDraft({
      mode: "create",
      draftPayload: safePayload({ unknownUiState: "leaked form state" }),
      relationshipPlan: walkInRelationship(),
    });
    expect(fullFormSpread.ok).toBe(false);
    await expect(store.listOrderDrafts(scope)).resolves.toEqual({ ok: true, value: [] });
  });

  it("discards drafts and keeps active local draft lists scoped to draft_local", async () => {
    const { service } = createServiceHarness();
    await service.saveDraft({
      mode: "create",
      draftPayload: safePayload({ issueDescription: "One" }),
      relationshipPlan: walkInRelationship(),
    });
    await service.saveDraft({
      mode: "create",
      draftPayload: safePayload({ issueDescription: "Two" }),
      relationshipPlan: walkInRelationship(),
    });

    const discarded = await service.discardDraft("draft_id_1");
    expect(discarded.ok && discarded.value.status).toBe("discarded");

    const active = await service.listLocalDrafts();
    expect(active.ok && active.value.map((draft) => draft.localDraftId)).toEqual(["draft_id_3"]);
    await expect(service.restoreDraft("draft_id_1")).resolves.toMatchObject({
      ok: true,
      value: { status: "discarded" },
    });
  });

  it("promotes a create draft to one pending_sync outbox entry", async () => {
    const { service, store } = createServiceHarness();
    await service.saveDraft({
      mode: "create",
      draftPayload: safePayload(),
      relationshipPlan: existingCustomerRelationship(),
      attachmentStagingIds: ["attachment_1"],
    });

    const queued = await service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
      sensitiveVaultEntryIds: ["vault_1"],
    });

    expect(queued.ok && queued.value.queued).toBe(true);
    expect(queued.ok && queued.value.draft.status).toBe("promoted_to_outbox");
    expect(queued.ok && queued.value.draft.promotedOperationId).toBe("op_1");
    expect(queued.ok && queued.value.outboxEntry).toMatchObject({
      operationId: "op_1",
      localOrderId: "local_order_id_2",
      storeId,
      userId,
      domain: "orders",
      action: "create",
      payload: safePayload(),
      relationshipPlan: existingCustomerRelationship(),
      retryCount: 0,
      status: "pending_sync",
      sensitiveVaultEntryIds: ["vault_1"],
      attachmentStagingIds: ["attachment_1"],
    });

    const outbox = await store.listOutboxEntries(scope);
    expect(outbox.ok && outbox.value).toHaveLength(1);
  });

  it("promotes an edit draft to an update outbox entry with baseUpdatedAt", async () => {
    const { service } = createServiceHarness();
    await service.saveDraft({
      mode: "edit",
      serverOrderId: "order_1",
      baseUpdatedAt: firstNow,
      draftPayload: safePayload({ issueDescription: "Updated issue" }),
      relationshipPlan: existingCustomerRelationship(),
    });

    const queued = await service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
    });

    expect(queued.ok && queued.value.outboxEntry).toMatchObject({
      action: "update",
      serverOrderId: "order_1",
      baseUpdatedAt: firstNow,
    });
  });

  it("keeps unknown relationships blocked and sensitive drafts locked instead of pending", async () => {
    const blockedHarness = createServiceHarness();
    await blockedHarness.service.saveDraft({
      mode: "create",
      draftPayload: safePayload(),
      relationshipPlan: {
        customerLinkMode: "unknown_needs_review",
        deviceLinkMode: "unknown_device_needs_review",
        requiresReview: true,
        reviewReason: "customer_device_relationship",
      },
    });
    const blocked = await blockedHarness.service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
    });
    expect(blocked.ok && blocked.value.outboxEntry.status).toBe("blocked");

    const sensitiveHarness = createServiceHarness();
    await sensitiveHarness.service.saveDraft({
      mode: "create",
      draftPayload: safePayload(),
      relationshipPlan: walkInRelationship(),
      hasSensitiveVaultEntry: true,
    });
    const sensitive = await sensitiveHarness.service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
    });
    expect(sensitive.ok && sensitive.value.outboxEntry.status).toBe("sensitive_locked");
  });

  it("handles repeated promotion with the same operationId without duplicating outbox entries", async () => {
    const { service, store } = createServiceHarness();
    await service.saveDraft({
      mode: "create",
      draftPayload: safePayload(),
      relationshipPlan: walkInRelationship(),
    });

    const first = await service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
    });
    const second = await service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
    });

    expect(first.ok && first.value.queued).toBe(true);
    expect(second.ok && second.value.queued).toBe(false);
    const outbox = await store.listOutboxEntries(scope);
    expect(outbox.ok && outbox.value.map((entry) => entry.operationId)).toEqual(["op_1"]);
  });

  it("leaves a draft retryable when outbox writing fails", async () => {
    const base = createRepairDeskOfflineMemoryStore();
    const failingStore = failOutboxWrites(base);
    const service = createRepairDeskOfflineOrderService({
      store: failingStore,
      scope,
      now: () => firstNow,
      idFactory: sequentialIdFactory(),
    });

    await service.saveDraft({
      mode: "create",
      draftPayload: safePayload(),
      relationshipPlan: walkInRelationship(),
    });

    const queued = await service.queueDraftForSync({
      localDraftId: "draft_id_1",
      operationId: "op_1",
    });
    expect(queued.ok).toBe(false);
    expect(!queued.ok && queued.error.code).toBe("quota_exceeded");
    await expect(base.getOrderDraft("draft_id_1", scope)).resolves.toMatchObject({
      ok: true,
      value: { status: "draft_local" },
    });
  });

  it("does not import UI, API, realtime, or network clients", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/offline/model/offline-order-service.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/@\/lib\/repairdesk\/api/);
    expect(source).not.toMatch(/supabase/i);
    expect(source).not.toMatch(/realtime/i);
    expect(source).not.toMatch(/src\/features\/orders\/screens/);
  });
});

function createServiceHarness() {
  const store = createRepairDeskOfflineMemoryStore();
  let currentNow = firstNow;
  const service = createRepairDeskOfflineOrderService({
    store,
    scope,
    now: () => currentNow,
    idFactory: sequentialIdFactory(),
  });
  return {
    service,
    store,
    setNow(value: string) {
      currentNow = value;
    },
  };
}

function sequentialIdFactory() {
  let count = 0;
  return () => {
    count += 1;
    return `id_${count}`;
  };
}

function safePayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Mario Rossi",
    customerPhone: "+39 333 000 0000",
    deviceBrand: "Apple",
    deviceModel: "iPhone 14",
    issueDescription: "Broken screen",
    quotedPriceCents: 12900,
    ...overrides,
  };
}

function walkInRelationship(): RepairDeskOfflineRelationshipPlan {
  return {
    customerLinkMode: "walk_in_snapshot_only",
    deviceLinkMode: "order_snapshot_only",
  };
}

function existingCustomerRelationship(): RepairDeskOfflineRelationshipPlan {
  return {
    customerLinkMode: "existing_customer",
    customerLinkDraft: {
      customerId: "customer_1",
      customerUpdatedAt: firstNow,
      snapshot: { displayName: "Mario Rossi", phone: "+39 333 000 0000" },
    },
    deviceLinkMode: "existing_customer_device",
    deviceLinkDraft: {
      deviceId: "device_1",
      snapshot: { brand: "Apple", model: "iPhone 14" },
    },
  };
}

function failOutboxWrites(base: RepairDeskOfflineStore): RepairDeskOfflineStore {
  return {
    ...base,
    async putOutboxEntry() {
      return {
        ok: false,
        error: {
          code: "quota_exceeded",
          message: "RepairDesk offline storage quota was exceeded.",
        },
      };
    },
  };
}
