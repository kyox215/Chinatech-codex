export const repairDeskOfflineStoreNames = [
  "repairdesk_order_drafts",
  "repairdesk_outbox",
  "repairdesk_sensitive_vault",
  "repairdesk_attachment_staging",
  "repairdesk_sync_meta",
] as const;

export const REPAIRDESK_OFFLINE_DATABASE_NAME = "repairdesk_offline";
export const REPAIRDESK_OFFLINE_SCHEMA_VERSION = 1 as const;

export type RepairDeskOfflineStoreName = (typeof repairDeskOfflineStoreNames)[number];

export const repairDeskOfflineStoreKeyPaths = {
  repairdesk_order_drafts: "localDraftId",
  repairdesk_outbox: "operationId",
  repairdesk_sensitive_vault: "vaultEntryId",
  repairdesk_attachment_staging: "stagingId",
  repairdesk_sync_meta: "metaId",
} as const satisfies Record<RepairDeskOfflineStoreName, string>;

export type RepairDeskOfflineStoreIndexDefinition = {
  name: string;
  keyPath: string | string[];
};

export const repairDeskOfflineStoreIndexes = {
  repairdesk_order_drafts: [
    { name: "by_scope", keyPath: ["storeId", "userId"] },
    { name: "by_scope_status", keyPath: ["storeId", "userId", "status"] },
    { name: "by_expires_at", keyPath: "expiresAt" },
  ],
  repairdesk_outbox: [
    { name: "by_scope", keyPath: ["storeId", "userId"] },
    { name: "by_scope_status", keyPath: ["storeId", "userId", "status"] },
  ],
  repairdesk_sensitive_vault: [
    { name: "by_scope", keyPath: ["storeId", "userId"] },
    { name: "by_expires_at", keyPath: "expiresAt" },
  ],
  repairdesk_attachment_staging: [
    { name: "by_scope", keyPath: ["storeId", "userId"] },
    { name: "by_expires_at", keyPath: "expiresAt" },
  ],
  repairdesk_sync_meta: [],
} as const satisfies Record<
  RepairDeskOfflineStoreName,
  readonly RepairDeskOfflineStoreIndexDefinition[]
>;

export type RepairDeskOfflineResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RepairDeskOfflineError };

export type RepairDeskOfflineErrorCode =
  | "storage_unavailable"
  | "quota_exceeded"
  | "context_mismatch"
  | "migration_failed"
  | "transaction_failed"
  | "version_blocked"
  | "unknown_error"
  | "validation_failed"
  | "not_found";

export type RepairDeskOfflineError = {
  code: RepairDeskOfflineErrorCode;
  message: string;
};

export type RepairDeskOfflineSafeRecord = Record<string, unknown>;

export type RepairDeskOfflineOrderDraftStatus = "draft_local" | "promoted_to_outbox" | "discarded";

export type RepairDeskOfflineOrderDraftMode = "create" | "edit";

export type RepairDeskOfflineCustomerLinkMode =
  | "existing_customer"
  | "new_customer_local"
  | "walk_in_snapshot_only"
  | "unknown_needs_review";

export type RepairDeskOfflineDeviceLinkMode =
  | "existing_customer_device"
  | "new_customer_device_local"
  | "order_snapshot_only"
  | "unknown_device_needs_review";

export type RepairDeskOfflineCustomerLinkDraft = {
  customerId?: string;
  customerUpdatedAt?: string;
  localCustomerId?: string;
  snapshot?: RepairDeskOfflineSafeRecord;
};

export type RepairDeskOfflineDeviceLinkDraft = {
  deviceId?: string;
  localDeviceId?: string;
  snapshot?: RepairDeskOfflineSafeRecord;
};

export type RepairDeskOfflineOrderDraft = {
  localDraftId: string;
  localOrderId: string;
  storeId: string;
  userId: string;
  mode: RepairDeskOfflineOrderDraftMode;
  serverOrderId?: string;
  baseUpdatedAt?: string;
  promotedOperationId?: string;
  draftPayload: RepairDeskOfflineSafeRecord;
  customerLinkMode: RepairDeskOfflineCustomerLinkMode;
  customerLinkDraft?: RepairDeskOfflineCustomerLinkDraft;
  deviceLinkMode: RepairDeskOfflineDeviceLinkMode;
  deviceLinkDraft?: RepairDeskOfflineDeviceLinkDraft;
  requiresReview?: boolean;
  reviewReason?: string;
  hasSensitiveVaultEntry: boolean;
  attachmentStagingIds: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  status: RepairDeskOfflineOrderDraftStatus;
};

export type RepairDeskOfflineOutboxStatus =
  | "pending_sync"
  | "syncing"
  | "synced"
  | "sync_failed"
  | "conflict"
  | "blocked"
  | "sensitive_locked";

export type RepairDeskOfflineOutboxDomain = "orders";
export type RepairDeskOfflineOutboxAction = "create" | "update";

export type RepairDeskOfflineRelationshipPlan = {
  customerLinkMode: RepairDeskOfflineCustomerLinkMode;
  customerLinkDraft?: RepairDeskOfflineCustomerLinkDraft;
  deviceLinkMode: RepairDeskOfflineDeviceLinkMode;
  deviceLinkDraft?: RepairDeskOfflineDeviceLinkDraft;
  requiresReview?: boolean;
  reviewReason?: string;
};

export type RepairDeskOfflineOutboxEntry = {
  operationId: string;
  localOrderId: string;
  serverOrderId?: string;
  storeId: string;
  userId: string;
  domain: RepairDeskOfflineOutboxDomain;
  action: RepairDeskOfflineOutboxAction;
  payload: RepairDeskOfflineSafeRecord;
  relationshipPlan: RepairDeskOfflineRelationshipPlan;
  baseUpdatedAt?: string;
  createdAtLocal: string;
  lastAttemptAt?: string;
  retryCount: number;
  status: RepairDeskOfflineOutboxStatus;
  lastError?: string;
  sensitiveVaultEntryIds: string[];
  attachmentStagingIds: string[];
};

export type RepairDeskOfflineSensitiveVaultFieldType =
  | "pin"
  | "password"
  | "pattern"
  | "other_unlock";

export type RepairDeskOfflineSensitiveVaultStatus =
  | "local_only"
  | "pending_sync"
  | "synced"
  | "failed"
  | "expired";

export type RepairDeskOfflineSensitiveVaultEntry = {
  vaultEntryId: string;
  localOrderId: string;
  operationId?: string;
  storeId: string;
  userId: string;
  fieldType: RepairDeskOfflineSensitiveVaultFieldType;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  syncStatus: RepairDeskOfflineSensitiveVaultStatus;
};

export type RepairDeskOfflineAttachmentStatus =
  | "local_only"
  | "pending_upload"
  | "uploaded"
  | "failed"
  | "expired";

export type RepairDeskOfflineAttachmentStagingEntry = {
  stagingId: string;
  localOrderId: string;
  storeId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewObjectKey?: string;
  blobObjectKey?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  status: RepairDeskOfflineAttachmentStatus;
};

export type RepairDeskOfflineOnlineState = "online" | "degraded" | "offline" | "reconnecting";

export type RepairDeskOfflineSyncMeta = {
  metaId: string;
  storeId: string;
  userId: string;
  onlineState: RepairDeskOfflineOnlineState;
  lastApiHealthOkAt?: string;
  lastOutboxRunAt?: string;
  lastRealtimeEventAt?: string;
  pendingCount: number;
  conflictCount: number;
  storageWarning?: string;
  updatedAt: string;
};

export type RepairDeskOfflineScope = {
  storeId: string;
  userId: string;
};
