# RepairDesk Realtime And Offline Resilience Plan v2

Status: realtime local slices 1-6 complete; offline storage foundation and model-layer order autosave/outbox service boundary through Slice 7D are complete. Slice 8A new-order UI autosave and refresh recovery prompt is complete locally. Slice 8B desktop order detail inline-edit autosave and refresh recovery prompt is complete locally. Slice 9A DATA/SEC/QA outbox sync preflight and Slice 9B local update target identity contract are complete locally. Sync runner, production idempotency, attachment staging UI, mobile quick-action autosave, and encrypted sensitive vault value storage are still planned, not implemented.

Owner goal: multiple staff can see updates without refreshing, and order information entered during network loss must not disappear after page refresh. Device PIN/password/pattern values must be saved when needed for repair work, but handled as sensitive data.

## Executive Decision

Use three separate layers:

1. Realtime invalidation: server-origin Supabase Broadcast tells other open browsers that a store/domain changed. It never carries full records, entity ids, customer PII, unlock credentials, notes, payment details, signed URLs, or raw DTOs.
2. Offline order persistence: the browser stores order drafts and pending order operations locally before and after the user clicks save, so refresh/temporary network loss does not lose order intake work.
3. Sensitive Offline Vault: device unlock PIN/password/pattern values are allowed to be saved, but only in a separate encrypted local store and then synced through normal authorized server APIs. They are never sent through realtime payloads.

Realtime answers: "someone changed data; refetch authorized data."

Offline Outbox answers: "I changed data while offline; keep it locally until it can be safely submitted."

## Current Verified Realtime State

Completed locally:

- Event contract, sensitive payload rejection, safe store topic guard, and React Query invalidation map under `src/features/realtime/model`.
- Default-off Supabase Realtime client adapter and `useRepairDeskRealtime`.
- `RealtimeSyncProvider` and authenticated app-shell `RealtimeAppBridge`.
- Default-off server Broadcast emitter.
- Mutation integration after successful server writes for orders, customers, inventory, settings/templates, memberships/access requests, messages/notifications.
- Supabase private Broadcast/RLS migration draft and approval package.

Still blocked before production:

- Owner approval to apply any remote Supabase migration.
- Supabase Dashboard verification: Realtime `Allow public access` must be disabled before private-channel enablement.
- Non-production private-channel verification, cross-store isolation tests, and two-tab visual evidence.
- Production flags, deploy, push, and release approval.

## Product Requirements

### Primary Users

- Front desk staff creating repair orders while customers are present.
- Technicians editing device, fault, diagnosis, unlock, and repair notes.
- Store owner/admin monitoring orders, inventory, customers, and settings.

### Must-Have Outcomes

- Two users in the same active store see order/customer/inventory/settings changes without manual page refresh.
- Order intake information is autosaved locally while the user types.
- If the network drops and the page remains open, order data stays available.
- If the user refreshes the page before network recovery, order drafts and pending submissions can be restored from local browser storage.
- If the user clicks save while offline, the order becomes a local pending-sync order, not a fake server-saved order.
- Device PIN/password/pattern values are preserved when needed, but isolated from normal drafts, logs, realtime events, screenshots, and broad UI surfaces.
- Order detail relationships to customer, customer devices, customer contact snapshot, and customer activity context must survive offline refresh and sync without linking to the wrong customer or silently overwriting customer records.
- Server remains the source of truth. Local drafts and outbox items are temporary recovery mechanisms.

### Non-Goals For This Version

- No direct collaborative text editing, cursor sharing, or live field-level co-editing.
- No automatic WhatsApp/SMS send while offline.
- No offline automatic payment capture, inventory sale/deduction, role/member change, store settings change, or destructive action.
- No full-record realtime payloads.
- No order/customer/inventory identifiers on broad store-domain realtime channels.
- No claim that local browser storage is a permanent backup. It protects against normal refresh/network failure, not browser data deletion.

## Data Classification

Normal order draft fields can be saved in local order draft storage:

- Customer relationship intent: existing customer id, local new-customer id, or walk-in/no-linked-customer mode.
- Customer name and contact phone.
- Customer display snapshot captured at intake.
- Customer device relationship intent: existing device id or local new-device id.
- Device brand/model/color/capacity.
- IMEI/serial number.
- Fault description, intake notes, accessory notes, diagnosis draft.
- Repair items, quoted prices, deposit/finance draft, warranty draft.
- Order type/status draft.
- Local references to staged attachments.

Sensitive unlock fields must only use Sensitive Offline Vault:

- Device PIN.
- Device password/passcode.
- Unlock pattern/trajectory.
- Other values that allow access to customer device contents.

High-risk operations are not auto-executed from offline queue:

- Payments and payment state changes.
- Inventory sale/stock deduction.
- Customer-facing messages or WhatsApp/SMS.
- Store member/role/access changes.
- Store settings/workflow changes unless explicitly re-confirmed online.
- Delete/cancel/destructive actions.

## Order Detail Relationship Integrity

Order detail pages depend on more than the order row. They also show customer identity, customer contact data, linked customer devices, order/customer activity, attachments, payments, workflow state, and sometimes message history. Offline persistence must preserve this relationship graph without turning it into silent customer overwrites.

### Relationship Modes

Every offline order draft must record which customer relationship mode the user intended:

```text
existing_customer
new_customer_local
walk_in_snapshot_only
unknown_needs_review
```

`existing_customer`:

- Store `customerId`, `customerUpdatedAt` if available, and a read-only display snapshot used only for restoring the draft UI.
- On sync, server must verify the customer still belongs to the active store and the user can link orders to that customer.
- If the customer was merged, deleted, transferred, or no longer accessible, the outbox item becomes `blocked` or `needs_review`; do not link by phone/name fallback automatically.

`new_customer_local`:

- Store a `localCustomerId` and customer draft fields separately from the order draft.
- Sync order in dependency order: create/resolve customer first, then create order with the returned `customerId`.
- Use customer create `operationId` so retrying does not create duplicate customers.
- If the server finds a likely duplicate customer by phone/email/search rules, pause for review instead of silently creating or merging.

`walk_in_snapshot_only`:

- Store customer name/phone as an order intake snapshot only.
- Do not create or update a customer record unless the user explicitly chose to create/link a customer.

`unknown_needs_review`:

- Used when restore/sync cannot safely determine the original relationship.
- The order remains local/pending until a user selects a customer action.

### Order Snapshot Vs Customer Master

Keep two concepts separate:

```text
order customer snapshot
customer master profile
```

The order snapshot preserves what was captured at intake, such as the displayed customer name/phone and device description. The customer master profile is the current CRM/customer record.

Rules:

- Editing an order draft must not update the customer master profile unless the UI explicitly says "update customer profile."
- Customer profile changes from another user must not rewrite a pending offline order draft without a visible notice.
- Existing order details can display the latest customer profile, but the stored order snapshot should remain available for audit/history.
- Realtime order invalidation and customer invalidation can both refresh the page, but they must not auto-merge pending local draft fields.

### Linked Customer Device Rules

Order drafts must record device relationship intent:

```text
existing_customer_device
new_customer_device_local
order_snapshot_only
unknown_device_needs_review
```

Rules:

- If an existing customer device is selected, store `deviceId` and display snapshot. On sync, verify it still belongs to the selected customer/store.
- If a new device is added offline, create/upsert the customer device before linking it to the order, or create the order with a device snapshot only if the customer link is unresolved.
- Never link a device to a different customer just because the IMEI/serial/model looks similar.
- If device conflict is detected, pause for review.

### Customer Activity And History

Offline order drafts may restore a cached read-only view of customer history to help staff continue work, but this cache is not authoritative.

Rules:

- Customer history shown while offline must be labeled as last synced.
- Pending offline order/customer actions must not appear as completed customer activity until server sync succeeds.
- After sync, React Query invalidation must refresh order detail, customer detail, customer list, and relevant activity panels.
- If customer follow-up/message/payment state is pending separately, it must have its own outbox item and permission checks.

## Local Browser Storage Design

Use IndexedDB for structured local persistence. Do not use React state alone, because refresh loses it. Do not use only `localStorage`, because order drafts, attachments, retry metadata, and queue records are structured and may exceed small string-only storage needs.

Proposed stores:

```text
repairdesk_order_drafts
repairdesk_outbox
repairdesk_sensitive_vault
repairdesk_attachment_staging
repairdesk_sync_meta
```

### `repairdesk_order_drafts`

Purpose: autosave work in progress before the user clicks save.

Core fields:

```text
localDraftId
localOrderId
storeId
userId
mode: create | edit
serverOrderId?                 // edit mode only
baseUpdatedAt?                 // edit mode conflict check
draftPayload                   // no sensitive unlock values
customerLinkMode
customerLinkDraft              // id/snapshot/localCustomerId only; no silent profile overwrite
deviceLinkMode
deviceLinkDraft                // id/snapshot/localDeviceId only
hasSensitiveVaultEntry
attachmentStagingIds[]
createdAt
updatedAt
expiresAt
status: draft_local | promoted_to_outbox | discarded
```

Autosave triggers:

- Debounced save every 1-3 seconds after form changes.
- Save on field blur.
- Save before route change, refresh, or tab close where browser allows.
- Save when the app detects network/API failure.

### `repairdesk_outbox`

Purpose: record user-submitted operations that still need server confirmation.

Core fields:

```text
operationId                    // client UUID, required for idempotency
localOrderId
serverOrderId?                // required for update operations; never infer from phone/name
storeId
userId
domain: orders
action: create | update
payload                       // no sensitive unlock values
relationshipPlan              // customer/device dependency actions and review gates
baseUpdatedAt?                // required for edit operations
createdAtLocal
lastAttemptAt?
retryCount
status: pending_sync | syncing | synced | sync_failed | conflict | blocked | sensitive_locked
lastError?
sensitiveVaultEntryIds[]
attachmentStagingIds[]
```

Outbox rules:

- A create order operation uses `operationId` so retrying after refresh does not create duplicate orders.
- An edit order operation must include `serverOrderId` and `baseUpdatedAt`/`expected_updated_at` so the sync runner updates the exact server order and the server can reject stale overwrites.
- The UI must not label an outbox item as saved to the system until the server returns success.

### `repairdesk_sensitive_vault`

Purpose: save required device unlock data without mixing it into ordinary drafts.

Core fields:

```text
vaultEntryId
localOrderId
operationId?
storeId
userId
fieldType: pin | password | pattern | other_unlock
encryptedValue
iv
salt
kdfParams
createdAt
updatedAt
expiresAt
syncStatus: local_only | pending_sync | synced | failed | expired
```

Security model:

- Encrypt with Web Crypto API using an authenticated encryption mode such as AES-GCM.
- Derive or unwrap the local encryption key from a user-entered local protection code or an equivalent reviewed key-management design.
- Do not store the raw protection code.
- Do not store the decryption key next to the encrypted value.
- If the protection code is forgotten, unsynced sensitive values may be unrecoverable; the UI must say this clearly.
- Delete local encrypted values after successful server sync unless the user explicitly keeps an unsynced draft.

### `repairdesk_attachment_staging`

Purpose: preserve selected photos/files while offline or before upload completes.

Rules:

- Store compressed previews and metadata when possible.
- Large files may fail due browser quota; show a blocking warning if the attachment cannot be staged.
- Upload only after online health check and authorization refresh.
- Delete local staged blobs after successful server upload.

### `repairdesk_sync_meta`

Purpose: track app-level sync state.

Core fields:

```text
storeId
userId
onlineState: online | degraded | offline | reconnecting
lastApiHealthOkAt
lastOutboxRunAt
lastRealtimeEventAt
pendingCount
conflictCount
storageWarning?
```

## User Flows

### Online Order Create

1. Staff opens new order form.
2. Form autosaves to `repairdesk_order_drafts`.
3. Staff clicks save.
4. Client sends create request with `operationId`.
5. Server creates order once, audits once, and emits realtime invalidation after success.
6. Client replaces local draft with real `orderId`/order number.
7. Local draft, outbox entry, staged attachments, and synced sensitive vault entries are cleaned up.

### Offline Order Create With Refresh

1. Staff fills new order while network drops.
2. Form continues autosaving to IndexedDB.
3. Staff refreshes before network returns.
4. App shell loads from normal app/cache where available.
5. New order screen shows "found local unsynced order draft."
6. Staff can continue editing.
7. On save, operation moves to `repairdesk_outbox`.
8. When API health check succeeds, the app resolves customer/device dependencies first.
9. The app submits the order operation and replaces local temp order with server order.

### Offline Existing Order Edit

1. Staff opens an existing order with `updated_at`.
2. Edits autosave locally with `baseUpdatedAt`.
3. If offline save is clicked, the update enters outbox.
4. On sync, server checks `expected_updated_at`.
5. If server has a newer version, the item becomes `conflict`; do not overwrite.
6. UI shows local changes vs latest server version and requires manual resolution.

### Offline Order With Existing Customer

1. Staff selects an existing customer while online or from a cached search result.
2. Draft stores `customerId`, customer display snapshot, and known `customerUpdatedAt`.
3. If the page refreshes offline, the selected customer remains visible as a draft relationship.
4. On sync, server verifies the customer still exists, belongs to the store, and can be linked.
5. If verification passes, create/update order with that customer id.
6. If verification fails, the order remains pending with `needs_review`; do not match by name/phone automatically.

### Offline Order With New Customer

1. Staff enters a new customer during order intake.
2. Draft stores a local customer record with `localCustomerId`.
3. Outbox sync creates or resolves the customer before creating the order.
4. If duplicate customer risk appears, the item pauses for user review.
5. After the customer is resolved, the order sync uses the real `customerId`.
6. Query invalidation refreshes orders and customers after success.

### Device PIN/Password While Offline

1. Staff selects unlock method and enters PIN/password/pattern.
2. UI asks whether to save device unlock information for repair work.
3. If offline sensitive save is enabled, value is encrypted into `repairdesk_sensitive_vault`.
4. The normal order draft stores only `hasSensitiveVaultEntry: true`.
5. After refresh, the app can show that sensitive unlock data exists, but it remains locked until local protection code is entered.
6. On sync, sensitive value is submitted only through normal authorized order APIs, never realtime.
7. After confirmed server save, local encrypted value is deleted.

### Network Recovery

1. Browser online event or request success marks "possible recovery."
2. App pings a RepairDesk API health/session endpoint; do not rely only on `navigator.onLine`.
3. App refreshes auth/session and store context.
4. App validates current user/store matches outbox records.
5. App runs outbox in deterministic order.
6. Successful records are cleaned up and React Query invalidation runs.
7. Failed/conflict/sensitive-locked records remain visible with user action.

## UI Requirements

Global status:

- `已同步`
- `本机已保存`
- `离线，已保存在本机`
- `待同步 N 条`
- `正在同步`
- `同步失败`
- `需要处理冲突`
- `有敏感信息待解锁`

Order list:

- Show pending local orders with a temporary local number and clear "仅此设备可见/待同步" label.
- Do not mix pending local orders into reports, revenue, payment totals, or customer-facing documents until server sync succeeds.

Order form:

- Show last local autosave time.
- Show server sync state separately.
- Sensitive fields default masked.
- "Show PIN/password" requires explicit click and should be auditable server-side when reading synced data.

Conflict screen:

- Show server latest summary and local pending changes.
- Offer: keep server version, copy local text into current form, retry after manual merge, or discard local changes.
- Do not auto-merge sensitive unlock values.

## Server/API Requirements

- Add `operationId` support to create/update endpoints before enabling offline outbox sync.
- Make create order idempotent per `storeId + userId + operationId` or an equivalent approved unique constraint/storage mechanism.
- Add or reuse idempotency for offline-created customer records that are dependencies of offline-created orders.
- Existing order updates must keep using `expected_updated_at`/version checks.
- Customer and customer-device dependency sync must verify store ownership and relationship ownership server-side before linking to an order.
- Linking by fallback phone/name is forbidden unless the user explicitly reviews and confirms the match.
- Server must validate store membership, role, object ownership, field permissions, and sensitive-field permission independently from the client.
- Realtime broadcast must happen only after server commit/audit success.
- Realtime payloads remain metadata-only and must never include sensitive vault contents.
- Audit logs for unlock data must record action and actor, not the unlock value itself.

## Realtime Event Payload

```ts
type RepairDeskRealtimeEvent = {
  schemaVersion: 1;
  eventId: string;
  emittedAt: string;
  storeId: string;
  domain: "orders" | "customers" | "inventory" | "settings";
  mutation:
    | "created"
    | "updated"
    | "deleted"
    | "transitioned"
    | "settings_updated"
    | "membership_changed"
    | "workflow_changed";
  queryGroups: RepairDeskRealtimeQueryGroup[];
};
```

Payload denylist:

- Customer full phone/email/address.
- Device unlock method, PIN, pattern, password, passcode trajectory.
- Payment card/bank data or full finance payload.
- Attachment signed URLs or private storage paths.
- Raw notes that may contain PII.
- Service role keys, JWTs, cookies, or internal errors.
- `orderId`, `customerId`, `deviceId`, `inventoryItemId`, `entityId`, or `related` on broad store-domain channels.

## Query Invalidation Map

orders:

- `created`, `updated`, `deleted`, `transitioned`, `workflow_changed`
- invalidate semantic group `orders.all`
- optionally invalidate `customers.all` when server knows an order mutation affects customer surfaces, without broadcasting the customer id

customers:

- `created`, `updated`, `deleted`
- invalidate semantic group `customers.all`
- optionally invalidate `orders.all` when linked order surfaces are affected, without broadcasting the order id

inventory:

- `created`, `updated`, `deleted`, `transitioned`
- invalidate semantic group `inventory.all`

settings/messages:

- `workflow_changed`, `updated`
- invalidate semantic groups `settings.store`, `settings.templates`, `orders.workflow`, `orders.options`, and `orders.all` when relevant

stores:

- membership/context changes invalidate store context and members keys; force resubscribe to the active store channel

## Implementation Roadmap

### Slice 1 - Event Types And Invalidation

Status: complete.

Files completed:

- `src/features/realtime/model/realtime-events.ts`
- `src/features/realtime/model/query-invalidation-map.ts`

### Slice 2 - Client Subscription Shell

Status: complete.

Files completed:

- `src/features/realtime/api/realtime-client.ts`
- `src/features/realtime/api/use-repairdesk-realtime.ts`

### Slice 3 - RealtimeSyncProvider And Query Invalidation Wiring

Status: complete.

Files completed:

- `src/features/realtime/components/realtime-sync-provider.tsx`

### Slice 4 - App Shell Mount Strategy

Status: complete.

The authenticated app shell mounts `RealtimeAppBridge`; login and onboarding are outside realtime wiring. The bridge remains default-off unless `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED === "1"`.

### Slice 5A - Server Broadcast Emitter

Status: complete.

Files completed:

- `src/features/realtime/server/realtime-broadcast.ts`

### Slice 5B/5C - Mutation Integration

Status: complete for current router mutation coverage except store creation/switch/onboarding identity flows where cross-user broadcast is not yet required. All wired paths remain default-off and metadata-only.

### Slice 6 - Supabase Private Realtime Authorization Approval Package

Status: complete as local draft, not applied.

Files completed:

- `supabase/migrations/20260706133632_repairdesk_realtime_private_broadcast_authorization.sql`
- `.ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution/SUPABASE_REALTIME_APPROVAL_PACKAGE.md`
- `src/features/realtime/server/realtime-migration-policy.test.ts`

### Slice 7 - Offline Storage Foundation

Status: complete locally through Slice 7C.

Goal:

- Add a dedicated offline persistence module for IndexedDB schema/versioning, storage health checks, quotas/errors, and cleanup.

Likely files:

- `src/features/offline/model/offline-store.ts`
- `src/features/offline/model/offline-types.ts`
- `src/features/offline/model/offline-store.test.ts`
- `src/features/offline/model/offline-indexeddb.ts`
- `src/features/offline/model/offline-indexeddb-store.ts`
- `src/features/offline/model/offline-indexeddb*.test.ts`

Exit criteria:

- Can create/read/update/delete order drafts, outbox entries, sync metadata, attachment staging metadata, and sensitive vault metadata in tests.
- Storage unavailable/quota errors return explicit UI-safe error states.

### Slice 7D - Offline Order Autosave/Outbox Service Boundary

Status: complete locally as model-layer boundary, not wired to UI or network sync.

Files completed:

- `src/features/offline/model/offline-order-service.ts`
- `src/features/offline/model/offline-order-service.test.ts`

Implemented boundary:

- Autosave creates and updates local order drafts with scoped `storeId/userId`, deterministic local ids, relationship intent, attachment metadata references, expiry, and `draft_local` status.
- Autosave update preserves `createdAt` and `localOrderId` while advancing `updatedAt`.
- Draft discard marks `discarded` and active draft listing only returns `draft_local`.
- Queueing a draft creates a local outbox entry only for `orders` `create/update`; edit queueing requires `serverOrderId` and `baseUpdatedAt`.
- Draft queueing copies relationship intent, attachment ids, and sensitive vault metadata ids, but never runs sync/API/network calls.
- `promotedOperationId` records the queued operation on the draft so repeated queueing with the same operation id is idempotent and does not duplicate outbox entries.
- Unknown customer/device relationship modes become local outbox `blocked` instead of `pending_sync`.
- Drafts with sensitive vault metadata but no vault entry ids become `sensitive_locked` instead of `pending_sync`.
- Service-layer payload allowlists reject full-form spreads, high-risk offline actions, raw unlock fields, and unsupported customer/device snapshots before reaching the lower-level store.
- Import-boundary tests confirm no UI/API/realtime/Supabase/network dependency in the service.

Exit criteria:

- Local model tests prove create/update/discard/restore/list/queue behavior.
- Queueing remains local only and does not claim Slice 8 UI refresh recovery, Slice 9 network sync/server idempotency, or Slice 10 encrypted vault value storage.

### Slice 8 - Order Autosave Drafts

Status: partially complete locally. Slice 8A new-order page autosave/refresh recovery is complete. Slice 8B desktop order detail inline-edit autosave/refresh recovery is complete locally. Mobile quick-action autosave and all high-risk offline actions remain planned or explicitly online-only.

Goal:

- New order and order edit forms autosave all non-sensitive order fields locally.
- Refresh/page close recovery restores drafts.

Likely files:

- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/api/use-new-order-offline-autosave.ts`
- `src/features/orders/model/new-order-offline-draft.ts`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/model/*`
- `src/features/offline/*`

Slice 8A completed:

- `src/features/orders/model/new-order-offline-draft.ts` maps `NewOrderFormState` into allowlisted non-sensitive offline draft payload and relationship metadata.
- `src/features/orders/api/use-new-order-offline-autosave.ts` creates a scoped IndexedDB offline service from `activeStore.id + userId`, checks storage health, debounces autosave, lists restorable create drafts, restores drafts, discards drafts, and clears the current local draft after successful online create.
- `src/features/orders/screens/new-order-screen.tsx` shows a local-only autosave status, a refresh recovery card, discard confirmation, and storage unavailable/error notices without labeling local drafts as system orders.
- `src/features/orders/forms/new-order-customer-device-section.tsx` warns that phone unlock PIN/password/pattern is not saved in ordinary local drafts.
- `src/lib/repairdesk/types.ts`, `src/features/platform/server/platform.repository.ts`, and `src/server/api/repairdesk-router.ts` expose `OnboardingStatus.userId` so local drafts are scoped by stable user id, not display name/email.
- Slice 8A does not call `queueDraftForSync`, does not create outbox entries, does not enable network sync, and does not persist sensitive unlock values.

Slice 8A verification:

- `npm run test -- src/features/orders/api/use-new-order-offline-autosave.test.tsx src/features/orders/model/new-order-offline-draft.test.ts src/features/offline/model/offline-order-service.test.ts` passed.
- `npm run test` passed.
- `npm run typecheck` passed.
- `npm run lint -- src/features/orders/api/use-new-order-offline-autosave.ts src/features/orders/api/use-new-order-offline-autosave.test.tsx src/features/orders/model/new-order-offline-draft.ts src/features/orders/model/new-order-offline-draft.test.ts src/features/orders/screens/new-order-screen.tsx src/features/orders/forms/new-order-customer-device-section.tsx src/features/offline/model/offline-order-service.ts src/lib/repairdesk/types.ts src/features/platform/server/platform.repository.ts src/server/api/repairdesk-router.ts` passed.
- `npm run build` passed outside sandbox after the sandboxed Turbopack build failed on local port binding.
- UI evidence: `artifacts/screenshots/slice8a-orders-new-restore-mobile.png`.

Slice 8B completed:

- DATA/SEC/QA read-only subagents reviewed the order detail/edit autosave scope before implementation. Findings incorporated: do not spread `UpdateOrderInput` into local storage, do not store `device_unlock`/PIN/password/pattern, require `serverOrderId` + `baseUpdatedAt`, restore only same store/user/order/version, block stale-version restore, do not enable outbox sync, do not modify database schema.
- `src/features/orders/model/edit-order-offline-draft.ts` maps `UpdateOrderInput` into an allowlisted non-sensitive edit draft payload and relationship metadata using the current order/customer/device ids. It omits `device_unlock`, messages, payment actions, attachment content, status transitions, approval actions, and outbox operation metadata.
- `src/features/orders/api/use-edit-order-offline-autosave.ts` creates a scoped IndexedDB offline service from active store + user id, checks storage health, debounces edit autosave, filters restorable drafts by `mode === "edit"` and current `serverOrderId`, detects stale `baseUpdatedAt`, restores safe fields, discards prompt/current drafts, and clears the current local edit draft after successful online save or cancel.
- `src/features/orders/screens/order-detail-screen.tsx` wires the hook into the desktop order detail inline-edit flow and shows local-only saved/unavailable/restore/conflict notices without rendering draft contents.
- `src/features/orders/components/order-overview-tab.tsx` warns beside the phone unlock editor that phone password/PIN/pattern is not saved into ordinary local drafts.
- `src/features/offline/model/offline-order-service.ts` allowlist now accepts edit-specific safe fields `deviceNotes` and `diagnosisResult` while retaining the raw unlock/high-risk action rejection boundary.
- `src/features/stores/model/store-shell-context.ts` exposes `userId` from onboarding status so detail/edit drafts can use the same store/user scope as new-order drafts.
- Slice 8B does not call `queueDraftForSync`, does not create outbox entries, does not enable network sync, does not persist sensitive unlock values, and does not alter production database schema.

Slice 8B verification:

- DATA/SEC/QA read-only review completed before implementation; all blocking controls were added to mapper/hook/UI/tests.
- `npm run test -- src/features/orders/model/edit-order-offline-draft.test.ts src/features/orders/api/use-edit-order-offline-autosave.test.tsx src/features/offline/model/offline-order-service.test.ts src/features/stores/model/store-shell-context.test.ts` passed: 4 files, 24 tests.
- `npm run test` passed: 71 files, 440 tests.
- `npm run typecheck` passed.
- `npm run lint -- src/features/orders/model/edit-order-offline-draft.ts src/features/orders/model/edit-order-offline-draft.test.ts src/features/orders/api/use-edit-order-offline-autosave.ts src/features/orders/api/use-edit-order-offline-autosave.test.tsx src/features/orders/screens/order-detail-screen.tsx src/features/orders/components/order-overview-tab.tsx src/features/offline/model/offline-order-service.ts src/features/stores/model/store-shell-context.ts src/features/stores/model/store-shell-context.test.ts` passed.
- `npm run build` passed outside sandbox after the sandboxed Turbopack build failed on local port binding.
- `git diff --check` passed.
- UI evidence: `artifacts/screenshots/slice8b-order-detail-edit-autosave-notice.png`. The full-page screenshot was intentionally overwritten with the same safe notice crop because the order detail page displays existing customer/device data and phone unlock pattern; do not store or report screenshots that expose those values. A reload restore-prompt screenshot was not produced because the local e2e bypass uses system actor without stable user id scope; restore/conflict behavior is covered by hook tests.

Remaining Slice 8 exit criteria:

- New order form autosaves after edits.
- Refresh restores draft.
- Local draft can be discarded.
- Local draft is not counted as server order.
- Desktop order detail inline-edit forms autosave non-sensitive fields without overwriting server data.
- Mobile quick-action autosave remains out of scope; payment, status transition, approval, WhatsApp/SMS, attachment capture/upload, and phone unlock values remain online-only or planned for later controlled slices.

### Slice 9 - Order Outbox And Idempotent Sync

Status: started. Slice 9A read-only preflight, Slice 9B local update target identity contract, and Slice 9C default-off local outbox sync runner skeleton are complete locally. Real network sync, server idempotency, production schema changes, and endpoint changes are still planned and approval-gated where applicable.

Goal:

- User-submitted offline order create/update operations persist to outbox and sync after API health check.
- Order sync resolves customer and device relationship dependencies without linking to the wrong customer or silently overwriting customer master data.

Likely files:

- `src/features/offline/model/offline-outbox-sync-runner.ts`
- `src/features/offline/model/offline-outbox-sync-runner.test.ts`
- `src/lib/repairdesk/api.ts`
- `src/server/api/repairdesk-router.ts`
- server-side idempotency support if not already present

Slice 9A completed:

- DATA/SEC/QA read-only subagents reviewed the outbox sync path before implementation.
- DATA confirmed current local outbox entries did not yet carry `serverOrderId`; full sync must not use broad create/update APIs that can silently create/link customers by phone or mutate customer master profiles.
- SEC allowed local-only preparation but blocked production sync, migrations, deployment, Sensitive Vault value storage, attachment staging, and high-risk operations until explicit controls and Owner approval exist.
- QA confirmed the smallest safe local slice is an injected/default-off outbox sync contract or narrower local contract with focused tests; full Slice 9 cannot be claimed until durable server idempotency, relationship dependency resolution, conflict classification, and UI state tests exist.

Slice 9B completed:

- `RepairDeskOfflineOutboxEntry` now includes `serverOrderId?: string`.
- `validateOutboxEntry()` rejects `action === "update"` entries without a non-blank `serverOrderId`.
- `buildOutboxEntry()` copies `draft.serverOrderId` into update outbox entries and fails edit queueing if the server target id is missing.
- Memory and IndexedDB outbox tests cover stale update metadata, missing server order id rejection, and valid update entries with `serverOrderId`.
- Service tests confirm edit draft autosave rejects missing server order id and queued update outbox entries preserve `serverOrderId` with `baseUpdatedAt`.
- Slice 9B is local model/test only. It does not submit outbox records, change server APIs, add idempotency tables, apply migrations, deploy, push, or persist Sensitive Vault values.

Slice 9C completed:

- DATA/SEC/QA read-only subagents reviewed the local runner boundary before and during implementation. Findings incorporated: default-off runner, injected preflight/handler only, pending-only processing, deterministic `createdAtLocal + operationId` order, no real API imports, no production sync, no broad payload output, no Sensitive Vault/attachment/status/payment/message auto-run, and no full Slice 9 claim.
- Added `src/features/offline/model/offline-outbox-sync-runner.ts`.
- Added `src/features/offline/model/offline-outbox-sync-runner.test.ts`.
- Runner defaults to disabled and requires injected API health plus active store/user scope checks before processing local pending entries.
- Runner reads only scoped `pending_sync` entries, ignores existing `syncing`/non-pending records, prevents overlapping runs, and processes at most `maxEntries`.
- Runner blocks review-required, unknown relationship, sensitive-vault, attachment-staging, update-without-identity, and high-risk payload-key entries before any injected handler is called.
- Runner transitions local metadata only: `pending_sync -> syncing -> synced | sync_failed | conflict | blocked`, increments `retryCount` only for attempted entries, records `lastAttemptAt`, stores generic `lastError`, and updates `sync_meta` counts/online state.
- Static import tests confirm the runner does not import `fetch`, RepairDesk API clients, Supabase/realtime, server modules, network primitives, or order UI screens.
- Slice 9C remains model/test only. It does not submit to real RepairDesk APIs, implement server idempotency, create dependency customer/device records, apply migrations, deploy, push, persist Sensitive Vault values, upload attachments, or emit realtime invalidations.

Next Slice 9D candidate:

- Define the server idempotency and narrow offline sync API approval package before any real network execution.
- Keep create/update execution disabled until server idempotency, role/store/object ownership checks, relationship resolver semantics, duplicate-customer review, stale conflict handling, and redacted audit tests are approved and implemented.

Slice 9D started:

- Drafted `.ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution/OFFLINE_SYNC_IDEMPOTENCY_APPROVAL_PACKAGE.md`.
- Scope is approval-package only: no migration file, schema application, server endpoint, runner network wiring, production change, deployment, or push.
- The package requires a server-side operation/idempotency table, narrow `offline/orders/create` and `offline/orders/update` contracts, request hashing, duplicate replay handling, same-operation/different-payload conflict handling, store/user/role/object checks, customer/device relationship resolution, stale update conflicts, and redacted audit/operation metadata.
- The package preserves the Owner requirement that order information and related customer/device data must not be lost or mis-linked, while keeping device PIN/password/pattern in a separate future Sensitive Vault path rather than ordinary drafts/outbox/API payloads.
- DATA/SEC/QA read-only Slice 9D reviews were spawned and must be integrated before 9D is considered verified.

Exit criteria:

- Offline create order becomes pending local order.
- Network recovery submits once.
- Duplicate retries with the same `operationId` do not create duplicate orders.
- Offline new customer + order sync creates/resolves customer once, then links the order to the resolved customer id.
- Existing customer link verifies store/customer ownership before sync.
- Duplicate customer risk pauses for review instead of auto-merging.
- Offline edit conflict does not overwrite newer server data.

### Slice 10 - Sensitive Offline Vault

Status: planned, requires SEC review before implementation.

Goal:

- Save device PIN/password/pattern values locally when needed without placing them in normal drafts, realtime, logs, screenshots, or broad UI surfaces.

Likely files:

- `src/features/offline/model/sensitive-vault.ts`
- `src/features/orders/components/*unlock*`
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`

Exit criteria:

- Sensitive value is encrypted before storage.
- Refresh shows locked sensitive data exists.
- Unlock requires local protection code or approved equivalent.
- Successful server sync deletes local encrypted value.
- Tests confirm normal drafts/outbox/realtime payloads do not contain raw unlock values.

### Slice 11 - Attachment Staging

Status: planned.

Goal:

- Preserve photos/attachments selected during offline order intake, with quota-aware warnings.

Exit criteria:

- Staged attachment survives refresh when browser storage accepts it.
- User sees clear warning when attachment is too large or storage fails.
- Successful upload deletes local staged copy.

### Slice 12 - Realtime/Offline UX And Diagnostics

Status: planned.

Goal:

- Show sync status, pending count, last local save time, conflict count, and admin diagnostics.

Exit criteria:

- AppBar or compact status surface shows sync state.
- Order list displays pending local orders clearly.
- Admin/debug view can show current realtime status and outbox summary without exposing sensitive values.

### Slice 13 - Browser Verification

Status: planned after non-production enablement.

Two contexts/tabs:

- User A and B on order list.
- A updates status.
- B sees list/detail refresh without manual page reload.
- B editing form gets conflict/sync notice, not silent overwrite.
- User A disconnects, creates order, refreshes, restores draft, reconnects, syncs once.
- User A enters device PIN offline, refreshes, unlocks local vault, syncs, and local encrypted value is deleted.
- Cross-store user never receives event.

## Test And Evidence Matrix

Unit tests:

- Realtime event parser and denylist.
- Query invalidation mapping.
- IndexedDB store wrapper.
- Outbox state transitions.
- Operation idempotency helpers.
- Sensitive vault encryption/decryption wrapper and redaction.

Integration tests:

- Create order offline -> pending outbox -> sync once.
- Create order offline with existing customer -> verify customer relationship before order sync.
- Create order offline with new customer -> create/resolve customer once, then create order once.
- Duplicate customer candidate -> pauses for review and does not auto-link by phone/name.
- Existing customer deleted/merged/no access -> outbox item becomes blocked/needs_review.
- Edit existing order offline -> conflict if `updated_at` changed.
- Customer profile updated by another user while order draft is pending -> order draft is preserved and user sees a customer-change notice.
- Sensitive fields never appear in normal draft/outbox/realtime payload/log test fixtures.
- Attachment staging success and quota failure paths.

E2E/manual tests:

- Two-tab same-store realtime refresh.
- Cross-store isolation.
- Offline refresh recovery.
- Browser storage unavailable/private mode warning.
- Clear browser data makes local draft unavailable and UI explains why.

Visual evidence:

- Sync status indicator.
- Pending local order in order list.
- Restored draft prompt.
- Conflict screen.
- Sensitive vault locked state.

## Rollback Strategy

Realtime rollback:

- Disable `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED`.
- Disable `REPAIRDESK_REALTIME_BROADCAST_ENABLED`.
- Revert or drop Realtime RLS policy only if it blocks legitimate private-channel access and Owner approves.

Offline feature rollback:

- Disable offline draft/outbox feature flag.
- Keep read-only recovery screen for existing local records so user can export/copy pending work before cleanup.
- Do not silently delete local drafts during rollback.

Sensitive vault rollback:

- Disable new sensitive offline saves.
- Keep a one-time recovery/decrypt/export path for already-created vault entries until they are synced or discarded.
- Never migrate encrypted local values into normal drafts.

## Approval And Stop Conditions

Owner approval required before:

- Applying any remote Supabase migration.
- Changing Supabase Dashboard Realtime settings.
- Enabling realtime flags in production.
- Adding production schema changes for idempotency/operation tracking.
- Enabling offline sensitive vault for production users.
- Deploy, push, or public release.

Stop immediately if:

- A proposed realtime payload needs entity ids or sensitive fields.
- Sensitive unlock values would be stored outside vault or logged.
- Outbox could auto-run payments, messages, inventory sales, member changes, or destructive actions.
- Browser storage errors cannot be surfaced clearly to users.
- Conflict handling would overwrite newer server data.

## References

- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Realtime Broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- MDN IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- MDN Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- MDN Window online event: https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event
