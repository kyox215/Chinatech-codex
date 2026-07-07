import type {
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineOrderDraftMode,
  RepairDeskOfflineOutboxAction,
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineOutboxStatus,
  RepairDeskOfflineRelationshipPlan,
  RepairDeskOfflineResult,
  RepairDeskOfflineSafeRecord,
  RepairDeskOfflineScope,
} from "./offline-types";
import type { RepairDeskOfflineStore } from "./offline-store";
import { containsOfflineSensitiveUnlockKey } from "./offline-store";

export type RepairDeskOfflineOrderServiceOptions = {
  store: RepairDeskOfflineStore;
  scope: RepairDeskOfflineScope;
  now?: () => string;
  idFactory?: () => string;
  draftTtlMs?: number;
};

export type SaveRepairDeskOfflineOrderDraftInput = {
  localDraftId?: string;
  localOrderId?: string;
  mode: RepairDeskOfflineOrderDraftMode;
  serverOrderId?: string;
  baseUpdatedAt?: string;
  draftPayload: RepairDeskOfflineSafeRecord;
  relationshipPlan: RepairDeskOfflineRelationshipPlan;
  hasSensitiveVaultEntry?: boolean;
  attachmentStagingIds?: string[];
  expiresAt?: string;
};

export type QueueRepairDeskOfflineOrderDraftInput = {
  localDraftId: string;
  operationId?: string;
  sensitiveVaultEntryIds?: string[];
};

export type QueueRepairDeskOfflineOrderDraftResult = {
  draft: RepairDeskOfflineOrderDraft;
  outboxEntry: RepairDeskOfflineOutboxEntry;
  queued: boolean;
};

export type RepairDeskOfflineOrderService = {
  healthCheck: RepairDeskOfflineStore["healthCheck"];
  saveDraft(
    input: SaveRepairDeskOfflineOrderDraftInput,
  ): Promise<RepairDeskOfflineResult<RepairDeskOfflineOrderDraft>>;
  restoreDraft(
    localDraftId: string,
  ): Promise<RepairDeskOfflineResult<RepairDeskOfflineOrderDraft | null>>;
  listLocalDrafts(): Promise<RepairDeskOfflineResult<RepairDeskOfflineOrderDraft[]>>;
  discardDraft(localDraftId: string): Promise<RepairDeskOfflineResult<RepairDeskOfflineOrderDraft>>;
  queueDraftForSync(
    input: QueueRepairDeskOfflineOrderDraftInput,
  ): Promise<RepairDeskOfflineResult<QueueRepairDeskOfflineOrderDraftResult>>;
};

const defaultDraftTtlMs = 1000 * 60 * 60 * 24 * 14;
const allowedOrderDraftPayloadKeys = new Set([
  "accessoryNotes",
  "accessory_notes",
  "customerEmail",
  "customerName",
  "customerPhone",
  "customer_email",
  "customer_name",
  "customer_phone",
  "depositAmountCents",
  "deposit_amount_cents",
  "deviceBrand",
  "deviceCapacity",
  "deviceColor",
  "deviceModel",
  "deviceNotes",
  "deviceStorage",
  "device_brand",
  "device_capacity",
  "device_color",
  "device_model",
  "device_notes",
  "device_storage",
  "diagnosisDraft",
  "diagnosisResult",
  "diagnosis_draft",
  "diagnosis_result",
  "imei",
  "intakeNotes",
  "intake_notes",
  "issueDescription",
  "issue_description",
  "orderStatus",
  "orderType",
  "order_status",
  "order_type",
  "quotedPriceCents",
  "quoted_price_cents",
  "repairItems",
  "repair_items",
  "serialNumber",
  "serial_number",
  "status",
  "warrantyDraft",
  "warranty_draft",
]);
const allowedCustomerSnapshotKeys = new Set([
  "customerId",
  "customerUpdatedAt",
  "displayName",
  "display_name",
  "email",
  "name",
  "phone",
]);
const allowedDeviceSnapshotKeys = new Set([
  "brand",
  "capacity",
  "color",
  "deviceId",
  "imei",
  "model",
  "serialNumber",
  "serial_number",
  "storage",
]);
const forbiddenOfflineActionFragments = [
  "accessrequest",
  "cancel",
  "capture",
  "delete",
  "inventory",
  "member",
  "message",
  "paid",
  "payment",
  "role",
  "setting",
  "sms",
  "stock",
  "whatsapp",
  "workflow",
] as const;

export function createRepairDeskOfflineOrderService({
  store,
  scope,
  now = () => new Date().toISOString(),
  idFactory = defaultIdFactory,
  draftTtlMs = defaultDraftTtlMs,
}: RepairDeskOfflineOrderServiceOptions): RepairDeskOfflineOrderService {
  return {
    healthCheck() {
      return store.healthCheck();
    },
    async saveDraft(input) {
      const timestamp = now();
      const validation = validateSaveDraftInput(input);
      if (!validation.ok) return validation;
      const existing = input.localDraftId
        ? await store.getOrderDraft(input.localDraftId, scope)
        : success(null);
      if (!existing.ok) return existing;
      if (existing.value && existing.value.status !== "draft_local") {
        return failure(
          "validation_failed",
          "Only draft_local offline order drafts can be autosaved.",
        );
      }

      const draft: RepairDeskOfflineOrderDraft = {
        localDraftId: input.localDraftId ?? prefixedId("draft", idFactory),
        localOrderId:
          input.localOrderId ??
          existing.value?.localOrderId ??
          prefixedId("local_order", idFactory),
        storeId: scope.storeId,
        userId: scope.userId,
        mode: input.mode,
        serverOrderId: input.serverOrderId,
        baseUpdatedAt: input.baseUpdatedAt,
        draftPayload: input.draftPayload,
        customerLinkMode: input.relationshipPlan.customerLinkMode,
        customerLinkDraft: input.relationshipPlan.customerLinkDraft,
        deviceLinkMode: input.relationshipPlan.deviceLinkMode,
        deviceLinkDraft: input.relationshipPlan.deviceLinkDraft,
        hasSensitiveVaultEntry: input.hasSensitiveVaultEntry ?? false,
        attachmentStagingIds: input.attachmentStagingIds ?? [],
        createdAt: existing.value?.createdAt ?? timestamp,
        updatedAt: timestamp,
        expiresAt: input.expiresAt ?? expiresAt(timestamp, draftTtlMs),
        status: "draft_local",
      };

      return store.putOrderDraft(draft);
    },
    restoreDraft(localDraftId) {
      return store.getOrderDraft(localDraftId, scope);
    },
    listLocalDrafts() {
      return store.listOrderDrafts({ ...scope, status: "draft_local" });
    },
    async discardDraft(localDraftId) {
      const draft = await store.getOrderDraft(localDraftId, scope);
      if (!draft.ok) return draft;
      if (!draft.value) {
        return failure("not_found", "Offline order draft was not found.");
      }
      const discarded: RepairDeskOfflineOrderDraft = {
        ...draft.value,
        updatedAt: now(),
        status: "discarded",
      };
      return store.putOrderDraft(discarded);
    },
    async queueDraftForSync(input) {
      const draft = await store.getOrderDraft(input.localDraftId, scope);
      if (!draft.ok) return draft;
      if (!draft.value) {
        return failure("not_found", "Offline order draft was not found.");
      }
      if (draft.value.status === "discarded") {
        return failure("validation_failed", "Discarded offline order drafts cannot be queued.");
      }
      if (
        draft.value.status === "promoted_to_outbox" &&
        draft.value.promotedOperationId &&
        input.operationId &&
        draft.value.promotedOperationId !== input.operationId
      ) {
        return failure("validation_failed", "Offline order draft is already queued.");
      }

      const operationId =
        input.operationId ?? draft.value.promotedOperationId ?? prefixedId("offline_op", idFactory);
      const existing = await store.getOutboxEntry(operationId, scope);
      if (!existing.ok) return existing;
      if (existing.value) {
        if (existing.value.localOrderId !== draft.value.localOrderId) {
          return failure("validation_failed", "Offline operation id is already used.");
        }
        const promoted = await markDraftPromoted(
          draft.value,
          existing.value.operationId,
          existing.value.createdAtLocal,
        );
        if (!promoted.ok) return promoted;
        return success({
          draft: promoted.value,
          outboxEntry: existing.value,
          queued: false,
        });
      }

      const entry = buildOutboxEntry({
        draft: draft.value,
        operationId,
        sensitiveVaultEntryIds: input.sensitiveVaultEntryIds ?? [],
        nowIso: now(),
      });
      if (!entry.ok) return entry;

      const queued = await store.putOutboxEntry(entry.value);
      if (!queued.ok) return queued;

      const promoted = await markDraftPromoted(
        draft.value,
        entry.value.operationId,
        entry.value.createdAtLocal,
      );
      if (!promoted.ok) {
        await store.deleteOutboxEntry(entry.value.operationId, scope);
        return promoted;
      }

      return success({
        draft: promoted.value,
        outboxEntry: queued.value,
        queued: true,
      });
    },
  };

  async function markDraftPromoted(
    draft: RepairDeskOfflineOrderDraft,
    operationId: string,
    updatedAt: string,
  ) {
    const promotedDraft: RepairDeskOfflineOrderDraft = {
      ...draft,
      promotedOperationId: operationId,
      updatedAt,
      status: "promoted_to_outbox",
    };
    return store.putOrderDraft(promotedDraft);
  }
}

function buildOutboxEntry({
  draft,
  operationId,
  sensitiveVaultEntryIds,
  nowIso,
}: {
  draft: RepairDeskOfflineOrderDraft;
  operationId: string;
  sensitiveVaultEntryIds: string[];
  nowIso: string;
}): RepairDeskOfflineResult<RepairDeskOfflineOutboxEntry> {
  const payload = validateSafeRecordKeys(
    draft.draftPayload,
    allowedOrderDraftPayloadKeys,
    "Offline order drafts contain unsupported fields.",
  );
  if (!payload.ok) return payload;
  const relationship = validateRelationshipPlan({
    customerLinkMode: draft.customerLinkMode,
    customerLinkDraft: draft.customerLinkDraft,
    deviceLinkMode: draft.deviceLinkMode,
    deviceLinkDraft: draft.deviceLinkDraft,
  });
  if (!relationship.ok) return relationship;
  if (!operationId.trim()) {
    return failure("validation_failed", "Offline operation id is required.");
  }
  if (draft.mode === "edit" && !draft.baseUpdatedAt) {
    return failure(
      "validation_failed",
      "Offline order updates require baseUpdatedAt for conflict checks.",
    );
  }
  if (draft.mode === "edit" && !draft.serverOrderId?.trim()) {
    return failure("validation_failed", "Offline order updates require a server order id.");
  }

  const action: RepairDeskOfflineOutboxAction = draft.mode === "edit" ? "update" : "create";
  const status: RepairDeskOfflineOutboxStatus = outboxStatusForDraft(draft, sensitiveVaultEntryIds);

  return success({
    operationId,
    localOrderId: draft.localOrderId,
    serverOrderId: draft.serverOrderId,
    storeId: draft.storeId,
    userId: draft.userId,
    domain: "orders",
    action,
    payload: draft.draftPayload,
    relationshipPlan: {
      customerLinkMode: draft.customerLinkMode,
      customerLinkDraft: draft.customerLinkDraft,
      deviceLinkMode: draft.deviceLinkMode,
      deviceLinkDraft: draft.deviceLinkDraft,
    },
    baseUpdatedAt: draft.baseUpdatedAt,
    createdAtLocal: nowIso,
    retryCount: 0,
    status,
    sensitiveVaultEntryIds,
    attachmentStagingIds: draft.attachmentStagingIds,
  });
}

function outboxStatusForDraft(
  draft: RepairDeskOfflineOrderDraft,
  sensitiveVaultEntryIds: string[],
): RepairDeskOfflineOutboxStatus {
  if (relationshipNeedsReview(draft)) return "blocked";
  if (draft.hasSensitiveVaultEntry && sensitiveVaultEntryIds.length === 0)
    return "sensitive_locked";
  return "pending_sync";
}

function relationshipNeedsReview(draft: RepairDeskOfflineOrderDraft) {
  return (
    draft.customerLinkMode === "unknown_needs_review" ||
    draft.deviceLinkMode === "unknown_device_needs_review"
  );
}

function validateSaveDraftInput(
  input: SaveRepairDeskOfflineOrderDraftInput,
): RepairDeskOfflineResult<true> {
  if (containsOfflineSensitiveUnlockKey(input.draftPayload)) {
    return failure("validation_failed", "Order drafts must not contain raw device unlock secrets.");
  }
  const payload = validateSafeRecordKeys(
    input.draftPayload,
    allowedOrderDraftPayloadKeys,
    "Offline order drafts contain unsupported fields.",
  );
  if (!payload.ok) return payload;
  const relationship = validateRelationshipPlan(input.relationshipPlan);
  if (!relationship.ok) return relationship;
  if (input.mode === "edit") {
    if (!input.serverOrderId?.trim()) {
      return failure("validation_failed", "Offline order edits require a server order id.");
    }
    if (!input.baseUpdatedAt?.trim()) {
      return failure("validation_failed", "Offline order edits require baseUpdatedAt.");
    }
  }
  if (input.mode === "create" && input.baseUpdatedAt) {
    return failure("validation_failed", "Offline order creates must not include baseUpdatedAt.");
  }
  return success(true);
}

function validateRelationshipPlan(
  relationshipPlan: RepairDeskOfflineRelationshipPlan,
): RepairDeskOfflineResult<true> {
  const customerSnapshot = relationshipPlan.customerLinkDraft?.snapshot;
  if (customerSnapshot) {
    const customer = validateSafeRecordKeys(
      customerSnapshot,
      allowedCustomerSnapshotKeys,
      "Offline customer snapshots contain unsupported fields.",
    );
    if (!customer.ok) return customer;
  }
  const deviceSnapshot = relationshipPlan.deviceLinkDraft?.snapshot;
  if (deviceSnapshot) {
    const device = validateSafeRecordKeys(
      deviceSnapshot,
      allowedDeviceSnapshotKeys,
      "Offline device snapshots contain unsupported fields.",
    );
    if (!device.ok) return device;
  }
  if (
    relationshipPlan.reviewReason &&
    containsUnsafeOfflineActionKey({ reviewReason: relationshipPlan.reviewReason })
  ) {
    return failure("validation_failed", "Offline review reasons contain unsupported fields.");
  }
  return success(true);
}

function validateSafeRecordKeys(
  record: RepairDeskOfflineSafeRecord,
  allowedKeys: ReadonlySet<string>,
  message: string,
): RepairDeskOfflineResult<true> {
  if (containsUnsafeOfflineActionKey(record)) {
    return failure(
      "validation_failed",
      "Offline order drafts contain unsupported high-risk actions.",
    );
  }
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      return failure("validation_failed", message);
    }
  }
  return success(true);
}

function containsUnsafeOfflineActionKey(input: unknown): boolean {
  if (Array.isArray(input)) return input.some((value) => containsUnsafeOfflineActionKey(value));
  if (!isRecord(input)) return false;

  return Object.entries(input).some(([key, value]) => {
    const normalized = normalizeOfflinePayloadKey(key);
    return (
      forbiddenOfflineActionFragments.some((fragment) => normalized.includes(fragment)) ||
      containsUnsafeOfflineActionKey(value)
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOfflinePayloadKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function prefixedId(prefix: string, idFactory: () => string) {
  return `${prefix}_${idFactory()}`;
}

function defaultIdFactory() {
  return crypto.randomUUID();
}

function expiresAt(nowIso: string, ttlMs: number) {
  const timestamp = Date.parse(nowIso);
  if (Number.isNaN(timestamp)) return nowIso;
  return new Date(timestamp + ttlMs).toISOString();
}

function success<T>(value: T): RepairDeskOfflineResult<T> {
  return { ok: true, value };
}

function failure<T = never>(
  code: "validation_failed" | "not_found",
  message: string,
): RepairDeskOfflineResult<T> {
  return { ok: false, error: { code, message } };
}
