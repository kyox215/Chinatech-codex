import type {
  RepairDeskOfflineAttachmentStagingEntry,
  RepairDeskOfflineError,
  RepairDeskOfflineErrorCode,
  RepairDeskOfflineOrderDraft,
  RepairDeskOfflineOrderDraftStatus,
  RepairDeskOfflineOutboxEntry,
  RepairDeskOfflineOutboxStatus,
  RepairDeskOfflineResult,
  RepairDeskOfflineScope,
  RepairDeskOfflineSensitiveVaultEntry,
  RepairDeskOfflineSyncMeta,
} from "./offline-types";

export type RepairDeskOfflineStoreOperation<T> = Promise<RepairDeskOfflineResult<T>>;

export type RepairDeskOfflineHealth = {
  available: boolean;
  error?: RepairDeskOfflineError;
};

export type RepairDeskOfflineCleanupResult = {
  orderDrafts: number;
  sensitiveVaultEntries: number;
  attachmentStagingEntries: number;
};

export type RepairDeskOfflineStore = {
  healthCheck(): RepairDeskOfflineStoreOperation<RepairDeskOfflineHealth>;
  putOrderDraft(
    draft: RepairDeskOfflineOrderDraft,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineOrderDraft>;
  getOrderDraft(
    localDraftId: string,
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineOrderDraft | null>;
  listOrderDrafts(
    scope: RepairDeskOfflineScope & { status?: RepairDeskOfflineOrderDraftStatus },
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineOrderDraft[]>;
  deleteOrderDraft(
    localDraftId: string,
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<boolean>;
  putOutboxEntry(
    entry: RepairDeskOfflineOutboxEntry,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineOutboxEntry>;
  getOutboxEntry(
    operationId: string,
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineOutboxEntry | null>;
  listOutboxEntries(
    scope: RepairDeskOfflineScope & { status?: RepairDeskOfflineOutboxStatus },
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineOutboxEntry[]>;
  deleteOutboxEntry(
    operationId: string,
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<boolean>;
  putSensitiveVaultEntry(
    entry: RepairDeskOfflineSensitiveVaultEntry,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineSensitiveVaultEntry>;
  getSensitiveVaultEntry(
    vaultEntryId: string,
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineSensitiveVaultEntry | null>;
  listSensitiveVaultEntries(
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineSensitiveVaultEntry[]>;
  putAttachmentStagingEntry(
    entry: RepairDeskOfflineAttachmentStagingEntry,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineAttachmentStagingEntry>;
  listAttachmentStagingEntries(
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineAttachmentStagingEntry[]>;
  putSyncMeta(
    meta: RepairDeskOfflineSyncMeta,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineSyncMeta>;
  getSyncMeta(
    metaId: string,
    scope: RepairDeskOfflineScope,
  ): RepairDeskOfflineStoreOperation<RepairDeskOfflineSyncMeta | null>;
  cleanupExpired(nowIso: string): RepairDeskOfflineStoreOperation<RepairDeskOfflineCleanupResult>;
};

export type RepairDeskOfflineMemoryStoreOptions = {
  unavailable?: boolean;
  failWritesWith?: Extract<RepairDeskOfflineErrorCode, "quota_exceeded" | "storage_unavailable">;
};

const offlineSensitiveKeyFragments = [
  "pin",
  "password",
  "passcode",
  "unlock",
  "unlockvalue",
  "unlockpattern",
  "deviceunlock",
  "patterntrajectory",
] as const;

const disallowedSensitiveVaultStorageKeys = new Set([
  "encryptedvalue",
  "iv",
  "kdfparams",
  "rawvalue",
  "salt",
]);

const sensitiveVaultAllowedKeys = new Set([
  "vaultEntryId",
  "localOrderId",
  "operationId",
  "storeId",
  "userId",
  "fieldType",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "syncStatus",
]);

export function createRepairDeskOfflineMemoryStore(
  options: RepairDeskOfflineMemoryStoreOptions = {},
): RepairDeskOfflineStore {
  const orderDrafts = new Map<string, RepairDeskOfflineOrderDraft>();
  const outbox = new Map<string, RepairDeskOfflineOutboxEntry>();
  const sensitiveVault = new Map<string, RepairDeskOfflineSensitiveVaultEntry>();
  const attachments = new Map<string, RepairDeskOfflineAttachmentStagingEntry>();
  const syncMeta = new Map<string, RepairDeskOfflineSyncMeta>();

  function guardRead<T>(value: () => T): RepairDeskOfflineResult<T> {
    if (options.unavailable) {
      return failure("storage_unavailable", "RepairDesk offline storage is unavailable.");
    }
    return success(value());
  }

  function guardReadResult<T>(value: () => RepairDeskOfflineResult<T>): RepairDeskOfflineResult<T> {
    if (options.unavailable) {
      return failure("storage_unavailable", "RepairDesk offline storage is unavailable.");
    }
    return value();
  }

  function guardWrite<T>(value: () => RepairDeskOfflineResult<T>): RepairDeskOfflineResult<T> {
    if (options.unavailable) {
      return failure("storage_unavailable", "RepairDesk offline storage is unavailable.");
    }
    if (options.failWritesWith) {
      return failure(options.failWritesWith, offlineErrorMessage(options.failWritesWith));
    }
    return value();
  }

  return {
    async healthCheck() {
      if (options.unavailable) {
        return success({
          available: false,
          error: offlineError("storage_unavailable", "RepairDesk offline storage is unavailable."),
        });
      }
      return success({ available: true });
    },
    async putOrderDraft(draft) {
      return guardWrite(() => {
        const validation = validateOrderDraft(draft);
        if (!validation.ok) return validation;
        orderDrafts.set(draft.localDraftId, cloneOfflineValue(draft));
        return success(cloneOfflineValue(draft));
      });
    },
    async getOrderDraft(localDraftId, scope) {
      return guardReadResult(() => scopedRecord(orderDrafts.get(localDraftId), scope));
    },
    async listOrderDrafts(scope) {
      return guardRead(() =>
        Array.from(orderDrafts.values())
          .filter((draft) => matchesScope(draft, scope))
          .filter((draft) => !scope.status || draft.status === scope.status)
          .map(cloneOfflineValue),
      );
    },
    async deleteOrderDraft(localDraftId, scope) {
      return guardWrite(() => {
        const draft = orderDrafts.get(localDraftId);
        const scoped = scopedRecord(draft, scope);
        if (!scoped.ok) return scoped;
        if (!scoped.value) return success(false);
        return success(orderDrafts.delete(localDraftId));
      });
    },
    async putOutboxEntry(entry) {
      return guardWrite(() => {
        const validation = validateOutboxEntry(entry);
        if (!validation.ok) return validation;
        outbox.set(entry.operationId, cloneOfflineValue(entry));
        return success(cloneOfflineValue(entry));
      });
    },
    async getOutboxEntry(operationId, scope) {
      return guardReadResult(() => scopedRecord(outbox.get(operationId), scope));
    },
    async listOutboxEntries(scope) {
      return guardRead(() =>
        Array.from(outbox.values())
          .filter((entry) => matchesScope(entry, scope))
          .filter((entry) => !scope.status || entry.status === scope.status)
          .map(cloneOfflineValue),
      );
    },
    async deleteOutboxEntry(operationId, scope) {
      return guardWrite(() => {
        const entry = outbox.get(operationId);
        const scoped = scopedRecord(entry, scope);
        if (!scoped.ok) return scoped;
        if (!scoped.value) return success(false);
        return success(outbox.delete(operationId));
      });
    },
    async putSensitiveVaultEntry(entry) {
      return guardWrite(() => {
        const validation = validateSensitiveVaultEntry(entry);
        if (!validation.ok) return validation;
        sensitiveVault.set(entry.vaultEntryId, cloneOfflineValue(entry));
        return success(cloneOfflineValue(entry));
      });
    },
    async getSensitiveVaultEntry(vaultEntryId, scope) {
      return guardReadResult(() => scopedRecord(sensitiveVault.get(vaultEntryId), scope));
    },
    async listSensitiveVaultEntries(scope) {
      return guardRead(() =>
        Array.from(sensitiveVault.values())
          .filter((entry) => matchesScope(entry, scope))
          .map(cloneOfflineValue),
      );
    },
    async putAttachmentStagingEntry(entry) {
      return guardWrite(() => {
        const validation = validateAttachmentStagingEntry(entry);
        if (!validation.ok) return validation;
        attachments.set(entry.stagingId, cloneOfflineValue(entry));
        return success(cloneOfflineValue(entry));
      });
    },
    async listAttachmentStagingEntries(scope) {
      return guardRead(() =>
        Array.from(attachments.values())
          .filter((entry) => matchesScope(entry, scope))
          .map(cloneOfflineValue),
      );
    },
    async putSyncMeta(meta) {
      return guardWrite(() => {
        const validation = validateSyncMeta(meta);
        if (!validation.ok) return validation;
        syncMeta.set(meta.metaId, cloneOfflineValue(meta));
        return success(cloneOfflineValue(meta));
      });
    },
    async getSyncMeta(metaId, scope) {
      return guardReadResult(() => scopedRecord(syncMeta.get(metaId), scope));
    },
    async cleanupExpired(nowIso) {
      return guardWrite(() => {
        const now = Date.parse(nowIso);
        if (Number.isNaN(now))
          return failure("validation_failed", "Cleanup requires a valid ISO timestamp.");

        const orderDraftCount = deleteExpired(orderDrafts, now);
        const sensitiveVaultCount = deleteExpired(sensitiveVault, now);
        const attachmentCount = deleteExpired(attachments, now);

        return success({
          orderDrafts: orderDraftCount,
          sensitiveVaultEntries: sensitiveVaultCount,
          attachmentStagingEntries: attachmentCount,
        });
      });
    },
  };
}

export function containsOfflineSensitiveUnlockKey(input: unknown): boolean {
  if (Array.isArray(input)) return input.some((value) => containsOfflineSensitiveUnlockKey(value));
  if (!isRecord(input)) return false;

  return Object.entries(input).some(([key, value]) => {
    const normalized = normalizeOfflinePayloadKey(key);
    return (
      offlineSensitiveKeyFragments.some((fragment) => normalized.includes(fragment)) ||
      containsOfflineSensitiveUnlockKey(value)
    );
  });
}

export function validateOrderDraft(
  draft: RepairDeskOfflineOrderDraft,
): RepairDeskOfflineResult<RepairDeskOfflineOrderDraft> {
  const base = validateBaseRecord(draft);
  if (!base.ok) return base;
  if (!draft.localDraftId.trim())
    return failure("validation_failed", "Order draft id is required.");
  if (!draft.localOrderId.trim())
    return failure("validation_failed", "Local order id is required.");
  if (draft.promotedOperationId !== undefined && !draft.promotedOperationId.trim()) {
    return failure("validation_failed", "Promoted operation id cannot be blank.");
  }
  if (draft.status === "promoted_to_outbox" && !draft.promotedOperationId?.trim()) {
    return failure("validation_failed", "Promoted order drafts require an operation id.");
  }
  if (containsOfflineSensitiveUnlockKey(draft.draftPayload)) {
    return failure("validation_failed", "Order drafts must not contain raw device unlock secrets.");
  }
  if (!Array.isArray(draft.attachmentStagingIds)) {
    return failure("validation_failed", "Order draft attachment staging ids must be an array.");
  }
  return success(draft);
}

export function validateOutboxEntry(
  entry: RepairDeskOfflineOutboxEntry,
): RepairDeskOfflineResult<RepairDeskOfflineOutboxEntry> {
  const base = validateBaseRecord(entry);
  if (!base.ok) return base;
  if (!entry.operationId.trim())
    return failure("validation_failed", "Outbox operation id is required.");
  if (!entry.localOrderId.trim())
    return failure("validation_failed", "Outbox local order id is required.");
  if (containsOfflineSensitiveUnlockKey(entry.payload)) {
    return failure(
      "validation_failed",
      "Outbox payloads must not contain raw device unlock secrets.",
    );
  }
  if (entry.action === "update" && !entry.baseUpdatedAt) {
    return failure(
      "validation_failed",
      "Offline order updates require baseUpdatedAt for conflict checks.",
    );
  }
  if (entry.action === "update" && !entry.serverOrderId?.trim()) {
    return failure("validation_failed", "Offline order updates require a server order id.");
  }
  return success(entry);
}

export function validateSensitiveVaultEntry(
  entry: RepairDeskOfflineSensitiveVaultEntry,
): RepairDeskOfflineResult<RepairDeskOfflineSensitiveVaultEntry> {
  const base = validateBaseRecord(entry);
  if (!base.ok) return base;
  if (!entry.vaultEntryId.trim())
    return failure("validation_failed", "Sensitive vault entry id is required.");
  if (!entry.localOrderId.trim())
    return failure("validation_failed", "Sensitive vault local order id is required.");
  if (Object.keys(entry).some((key) => !sensitiveVaultAllowedKeys.has(key))) {
    return failure(
      "validation_failed",
      "Slice 7 sensitive vault records may contain metadata only.",
    );
  }
  if (
    containsDisallowedSensitiveVaultStorageKey(entry) ||
    containsOfflineSensitiveUnlockKey(entry)
  ) {
    return failure(
      "validation_failed",
      "Slice 7 sensitive vault records may contain metadata only.",
    );
  }
  return success(entry);
}

export function validateAttachmentStagingEntry(
  entry: RepairDeskOfflineAttachmentStagingEntry,
): RepairDeskOfflineResult<RepairDeskOfflineAttachmentStagingEntry> {
  const base = validateBaseRecord(entry);
  if (!base.ok) return base;
  if (!entry.stagingId.trim())
    return failure("validation_failed", "Attachment staging id is required.");
  if (!entry.localOrderId.trim())
    return failure("validation_failed", "Attachment local order id is required.");
  if (!entry.fileName.trim())
    return failure("validation_failed", "Attachment file name is required.");
  if (entry.sizeBytes < 0)
    return failure("validation_failed", "Attachment size cannot be negative.");
  return success(entry);
}

export function validateSyncMeta(
  meta: RepairDeskOfflineSyncMeta,
): RepairDeskOfflineResult<RepairDeskOfflineSyncMeta> {
  const base = validateBaseRecord(meta);
  if (!base.ok) return base;
  if (!meta.metaId.trim()) return failure("validation_failed", "Sync meta id is required.");
  if (meta.pendingCount < 0 || meta.conflictCount < 0) {
    return failure("validation_failed", "Sync meta counts cannot be negative.");
  }
  return success(meta);
}

function validateBaseRecord(record: { storeId: string; userId: string }) {
  if (!record.storeId?.trim())
    return failure("validation_failed", "Offline record store id is required.");
  if (!record.userId?.trim())
    return failure("validation_failed", "Offline record user id is required.");
  return success(record);
}

function matchesScope<T extends { storeId: string; userId: string }>(
  value: T,
  scope: RepairDeskOfflineScope,
) {
  return value.storeId === scope.storeId && value.userId === scope.userId;
}

function scopedRecord<T extends { storeId: string; userId: string }>(
  value: T | undefined,
  scope: RepairDeskOfflineScope,
): RepairDeskOfflineResult<T | null> {
  if (!value) return success(null);
  if (!matchesScope(value, scope)) {
    return failure(
      "context_mismatch",
      "Offline record does not belong to the active store/user context.",
    );
  }
  return success(cloneOfflineValue(value));
}

function deleteExpired<T extends { expiresAt: string }>(values: Map<string, T>, now: number) {
  let count = 0;
  for (const [key, value] of values.entries()) {
    const expiresAt = Date.parse(value.expiresAt);
    if (!Number.isNaN(expiresAt) && expiresAt <= now) {
      values.delete(key);
      count += 1;
    }
  }
  return count;
}

function cloneNullable<T>(value: T | undefined) {
  return value ? cloneOfflineValue(value) : null;
}

function cloneOfflineValue<T>(value: T): T {
  return structuredClone(value);
}

function success<T>(value: T): RepairDeskOfflineResult<T> {
  return { ok: true, value };
}

function failure<T = never>(
  code: RepairDeskOfflineErrorCode,
  message: string,
): RepairDeskOfflineResult<T> {
  return { ok: false, error: offlineError(code, message) };
}

function offlineError(code: RepairDeskOfflineErrorCode, message: string): RepairDeskOfflineError {
  return { code, message };
}

function offlineErrorMessage(code: RepairDeskOfflineErrorCode) {
  switch (code) {
    case "quota_exceeded":
      return "RepairDesk offline storage quota was exceeded.";
    case "storage_unavailable":
      return "RepairDesk offline storage is unavailable.";
    case "context_mismatch":
      return "RepairDesk offline record does not belong to the active store/user context.";
    case "migration_failed":
      return "RepairDesk offline storage migration failed.";
    case "version_blocked":
      return "RepairDesk offline storage upgrade is blocked by another open tab.";
    case "unknown_error":
      return "RepairDesk offline storage failed.";
    case "transaction_failed":
      return "RepairDesk offline storage transaction failed.";
    case "not_found":
      return "RepairDesk offline record was not found.";
    case "validation_failed":
      return "RepairDesk offline record failed validation.";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOfflinePayloadKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsDisallowedSensitiveVaultStorageKey(input: unknown): boolean {
  if (Array.isArray(input))
    return input.some((value) => containsDisallowedSensitiveVaultStorageKey(value));
  if (!isRecord(input)) return false;

  return Object.entries(input).some(([key, value]) => {
    const normalized = normalizeOfflinePayloadKey(key);
    return (
      disallowedSensitiveVaultStorageKeys.has(normalized) ||
      containsDisallowedSensitiveVaultStorageKey(value)
    );
  });
}
