# Slice 9D Offline Sync Idempotency Approval Package

Status: draft / Owner approval required before schema, API, migration, production sync, or deployment
Task: TASK-20260706-001-realtime-updates-execution
Owner: Hexiang Huang / 鹤祥
Prepared by: Integration Lead
Prepared at: 2026-07-07 Europe/Rome

## Decision Required

Approve or reject the next implementation stage for server-side idempotency and a narrow offline order sync API.

Recommended option: approve a local-only Slice 9E implementation of server idempotency schema draft, service contract, Zod schemas, and tests. Production Supabase migration, deployment, push, and real customer-facing sync remain blocked until a later explicit approval.

Default if no decision: keep real offline network sync disabled. Local autosave and local outbox storage remain available, but no offline order create/update is submitted to the server automatically.

## Current Verified State

- Slice 8A/8B preserve non-sensitive order create/edit drafts in IndexedDB, scoped by store id and user id.
- Slice 9B added local outbox target identity for updates: update entries require `serverOrderId` and `baseUpdatedAt`.
- Slice 9C added a default-off local sync runner with injected handlers only. It blocks review-required relationships, unknown customer/device links, sensitive vault entries, attachment staging, missing update identity, and high-risk payload keys before any handler runs.
- No real RepairDesk API sync, server idempotency table, schema migration, production migration, deployment, push, Sensitive Vault value sync, attachment upload, payment/status/message automation, or realtime invalidation from offline sync has been enabled.

## Why The Existing Online API Is Not Enough

The current `orders/create` path is designed for online form submission:

- It may find an existing customer by `phone_raw` and merge contact phones.
- It may create a new customer, create a new device, create a repair order, and write an order event in one path.
- It accepts `device_unlock`, `status`, deposit/fault price values, and broad intake fields.

For offline replay this is too wide. A retried request, stale local draft, duplicate phone, or ambiguous local customer/device relationship could create duplicate records, silently link to the wrong customer, overwrite customer master data, or store sensitive values outside the intended vault.

Offline sync must use a server-controlled narrow contract with idempotency, ownership checks, relationship resolution, conflict classification, and redacted audit logging before it writes customer/device/order records.

## Scope For The Next Approved Slice

In scope for local Slice 9E after Owner approval:

- Add a draft migration file for a server-side operation/idempotency table, not applied to production.
- Add narrow offline order sync schemas and service contract.
- Add server-side idempotency helper around offline sync operations.
- Add tests for duplicate replay, request hash mismatch, stale update, cross-store denial, role denial, duplicate-customer review, and redacted logging.
- Keep the feature default-off and not wired to the real local runner until tests and review pass.

Out of scope until later explicit approval:

- Applying Supabase migration to production.
- Enabling real network sync from the local outbox runner.
- Deploying, pushing, or enabling environment flags.
- Syncing device PIN/password/pattern values.
- Uploading attachments.
- Sending WhatsApp/SMS/messages.
- Running payment, refund, status transition, approval, delete, merge, or destructive operations from offline replay.
- Broadcasting realtime invalidations from offline sync writes.

## Recommended Server Data Model

Create a new server-side operation log table. Name can be finalized in Slice 9E; recommended name:

`public.repairdesk_offline_operations`

Draft SQL, not executed:

```sql
create table if not exists public.repairdesk_offline_operations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  actor_id uuid not null references public.staff_profiles(id),
  operation_id text not null,
  operation_type text not null,
  request_hash text not null,
  target_entity_type text,
  target_entity_id text,
  status text not null,
  result_code text,
  response_summary jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint repairdesk_offline_operations_operation_id_length
    check (length(operation_id) between 8 and 128),
  constraint repairdesk_offline_operations_request_hash_format
    check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint repairdesk_offline_operations_type_check
    check (operation_type in ('order_create', 'order_update')),
  constraint repairdesk_offline_operations_status_check
    check (status in ('started', 'succeeded', 'failed', 'conflict', 'blocked')),
  constraint repairdesk_offline_operations_response_object
    check (jsonb_typeof(response_summary) = 'object')
);

create unique index if not exists repairdesk_offline_operations_key_uidx
  on public.repairdesk_offline_operations (store_id, actor_id, operation_type, operation_id);

create index if not exists repairdesk_offline_operations_store_created_idx
  on public.repairdesk_offline_operations (store_id, created_at desc);

create index if not exists repairdesk_offline_operations_expires_idx
  on public.repairdesk_offline_operations (expires_at);
```

Data rules:

- The table stores hashes and metadata only. It must not store full request payloads, raw customer names, phone numbers, IMEI/serial values, notes, unlock secrets, message bodies, signed URLs, or attachment names.
- `request_hash` is a server-computed HMAC or equivalent keyed digest over canonicalized allowlisted sync input. Do not use a bare enumerable hash for PII-bearing payloads.
- `request_hash` is not part of the unique key. Different payloads with the same operation key must hit the existing operation row and return conflict, not create a second operation row.
- Same `(store_id, actor_id, operation_type, operation_id)` with the same `request_hash` returns the previous result without creating duplicate records.
- Same key with a different `request_hash` is a conflict and must not write business data.
- `response_summary` may contain metadata such as `{ "serverOrderId": "...", "updatedAt": "...", "relationshipMode": "existing_customer" }`, but must not contain PII or secrets.
- `expires_at` allows later cleanup after retention review. Cleanup job is out of scope for Slice 9E.
- The migration must enable RLS, revoke `anon`/`authenticated` direct table access, and grant only service-role/server access unless a later policy is explicitly approved.
- No browser client read/write path is allowed for the operation table in the first implementation.

## Narrow API Contract

Recommended router paths, final naming can change:

- `offline/orders/create`
- `offline/orders/update`

Common request envelope:

```ts
type OfflineSyncEnvelope<TPayload> = {
  operationId: string;
  baseClientCreatedAt: string;
  payload: TPayload;
};
```

Server-derived fields:

- `storeId` from `actor.storeId`
- `actorId` from `actor.id`
- `role` from actor membership
- request IP hash from the request actor context when available

Never accept client-supplied `storeId`, `userId`, `actorId`, role, or store name for authorization.

Hard rule: these paths must be new narrow offline sync paths. They must not call the current broad `orders/create`, `order/update`, or `order/patch` contracts directly because those online paths can perform phone-based customer lookup/merge, customer master edits, device creation, unlock-value writes, finance changes, and broad form updates that are not safe for replay.

### Offline Order Create Payload

Allowed fields:

- Relationship plan:
  - existing customer id plus expected customer updated time, or local new customer snapshot requiring duplicate review.
  - existing device id linked to that customer, or local new device snapshot.
- Order intake:
  - order type.
  - issue description.
  - safe accessory/internal notes already allowed by offline draft policy.
  - fault price rows and deposit amount only if the same server validation as online create is applied.
  - warranty fields only if existing order warranty validation is reused.

Rejected fields in initial network sync:

- `device_unlock`, PIN, password, pattern, recovery codes.
- attachment blobs, filenames, signed URLs, storage paths.
- payment collection/refund/adjustment actions.
- WhatsApp/SMS/message body/template send actions.
- status transition, approval, workflow transition, delete, merge, inventory mutation, supplier mutation.
- raw customer master updates unless explicitly part of relationship creation and duplicate review has passed.

### Offline Order Update Payload

Required:

- `serverOrderId`
- `baseUpdatedAt`
- allowlisted changes only

Allowed initial update changes:

- `issue_description`
- `diagnosis_result`
- `accessory_notes`
- safe device snapshot fields: `device_brand`, `device_model`, `device_imei`, `device_notes`
- warranty text/months/reason if existing server warranty rules are reused

Rejected in initial update sync:

- customer name/phone master edits until a dedicated relationship-safe path exists.
- device unlock fields.
- finance/payment changes.
- status, approval, workflow transitions.
- attachments, messages, WhatsApp/SMS.
- delete, merge, transfer, inventory mutations.

## Customer And Device Relationship Rules

Order information must not be saved without its related customer/device integrity. Required server behavior:

1. Existing customer link:
   - Verify customer exists in `actor.storeId`.
   - Verify optional `customerUpdatedAt` if provided. If changed, return `conflict` or `blocked_review`, not silent overwrite.
   - Do not update customer name/phone from offline order create unless a separate approved customer update operation exists.

2. New customer local snapshot:
   - Normalize phone on the server.
   - Search same-store duplicate candidates by normalized phone and configured matching rules.
   - If exactly safe to create, create customer once inside the idempotent operation.
   - If duplicate/ambiguous, return `blocked_review`; local outbox stays review-required.
   - Do not auto-merge offline local customer into an existing customer based only on a broad phone match.

3. Existing device link:
   - Verify device exists in the same store.
   - Verify `device.customer_id === resolvedCustomerId`.
   - If not, return `blocked_review`; never relink device silently.

4. New device local snapshot:
   - Create after customer resolution.
   - Link to the resolved customer id.
   - Save only non-sensitive device metadata.

5. Order create:
   - Create order only after customer and device are resolved.
   - Write an operation result with `serverOrderId` and `updatedAt`.
   - If event writing fails after order write, operation result must reflect failure mode and not cause duplicate order on retry. Slice 9E must define whether this uses one transaction/RPC or compensating retry-safe event creation.

DATA gate for Slice 9E:

- Before writing implementation, choose one data-write model:
  - preferred: a Postgres RPC/transaction that locks the operation row and writes customer/device/order/event/result atomically; or
  - acceptable only with explicit review: a service-layer lock pattern with documented partial-failure recovery for every write step.
- If this choice is not made, Slice 9E may draft schemas/tests but must not implement real business writes.

## Conflict And Replay Logic

Server operation flow:

1. Authenticate and resolve active store.
2. Check permission for the requested operation.
3. Validate payload through narrow schema.
4. Compute canonical `request_hash`.
5. In one transaction or lock-equivalent sequence:
   - Insert operation row as `started` for first request.
   - If operation row exists with same hash and `succeeded`, return stored `response_summary`.
   - If operation row exists with same hash and `conflict`/`blocked`, return same classification.
   - If operation row exists with different hash, return conflict and do not write business data.
   - Execute relationship and order write.
   - Mark operation row `succeeded`, `conflict`, or `blocked`.

Concurrency rule:

- Parallel submits for the same operation key must serialize through database uniqueness and row-level lock, advisory lock, RPC transaction, or another reviewed server-side mechanism. Ten concurrent identical requests must produce one business write and nine idempotent replays.
- `started` rows must have a recovery rule. If using a single transaction/RPC, failed writes should roll back the `started` row. If using a multi-step service flow, stale `started` rows must be detectable, non-PII, and recoverable without duplicate business writes.
- Canonical request hashing must be stable across object key order and `undefined` normalization. Extra fields must be rejected before hashing and before any business write.

Stable server result codes:

| Server code | Local runner mapping |
|---|---|
| `synced` | mark outbox item `synced` and store returned `serverOrderId`/`updatedAt` metadata |
| `idempotent_replay` | mark outbox item `synced` using stored operation result |
| `idempotency_conflict` | mark outbox item `conflict` |
| `stale_version` | mark outbox item `conflict` |
| `needs_review` | mark outbox item `blocked` |
| `blocked_operation` | mark outbox item `blocked` |
| `unauthorized` / `forbidden` | mark outbox item `blocked` and require user/admin action |
| `retryable_error` | keep item retryable as `sync_failed` with generic error text |

Retry behavior:

- Network retry with same operation id and same payload must be safe and must not create duplicate customer/device/order rows.
- Retry after a server conflict must remain conflict until manual action changes the local outbox state.
- Retry after a temporary server error may remain `sync_failed` locally and be retried with backoff.

## Security Rules

- Default deny. Every offline sync path must require authenticated actor, active store membership, and explicit permission.
- Viewer role must not create or update orders.
- Store id, actor id, and role are server-derived only.
- Object-level checks are required for every `serverOrderId`, customer id, and device id.
- The create path must call the equivalent of `order:create` permission checks before writing.
- The update path must classify each allowed field and call the equivalent of `order:update_intake` or `order:update_repair` permission checks with `scopeSatisfied` derived from server-read object ownership. It must not rely on a client-supplied role or scope.
- Slice 9E tests must exercise the actual permission assertion path, including viewer denial and cross-role denial for fields outside the actor's allowed scope.
- Client-side local blocking is defense-in-depth only; server must re-check sensitive fields, high-risk operation keys, store ownership, and stale versions.
- Error responses must use stable codes and generic user messages. Do not echo PII, unlock data, notes, payload snippets, SQL errors, or stack traces.
- Audit logs must record actor, store, operation id, operation type, target type/id when known, result, and error code. Audit metadata must be sanitized and should include request hash but not raw payload.
- Operation table and audit logs must not contain PIN/password/pattern, full customer phone, email, IMEI/serial, notes, message body, attachment name, signed URL, or raw local draft payload.

Minimum authorization matrix:

| Sync action | Required server gate |
|---|---|
| Offline order create | authenticated actor, active store, non-viewer role, `order:create`, store membership active |
| Offline order update | authenticated actor, active store, order belongs to store, `serverOrderId`, `baseUpdatedAt`, field-level `order:update_intake` / `order:update_repair` |
| Existing customer link | customer belongs to actor store; no phone/name fallback |
| Existing device link | device belongs to actor store and resolved customer |
| New customer/device dependency | duplicate candidate or ambiguity returns `blocked_review` |
| Payment/message/WhatsApp/SMS/attachment/status/delete/merge | rejected in the first network sync |

## Offline Refresh And Local Preservation Logic

When the browser remains open but network is down:

- Drafts and outbox entries stay in IndexedDB under `repairdesk_offline`, scoped by store id and user id.
- New order/edit drafts are kept as local drafts until promoted to outbox.
- Outbox entries keep `operationId`, `localOrderId`, `relationshipPlan`, payload, status, retry count, and timestamps.
- Refreshing the page should not delete IndexedDB entries. The UI can restore drafts/outbox status after store/user scope is available.
- Data can still be lost if the browser clears site data, private/incognito storage expires, the user uses a different browser/device, quota eviction happens, or the app changes storage schema without migration. The UI must warn when storage is unavailable or quota is exceeded.

When network returns:

- The local runner may process only `pending_sync` entries after API health and active scope checks.
- The first real sync must remain default-off until server idempotency and narrow API are implemented.
- `synced` entries should retain minimal local metadata long enough for user confirmation, then be eligible for cleanup.
- `conflict`, `blocked`, and `sensitive_locked` entries must not be auto-deleted.

## Device PIN / Password / Pattern Plan

The Owner requirement is to preserve device PIN/password/pattern when needed, but not in normal drafts or outbox payloads.

Required design for Slice 10:

- Store sensitive unlock values only in `repairdesk_sensitive_vault`.
- Encrypt before local persistence using an approved local protection mechanism.
- Reference vault entries from drafts/outbox by `sensitiveVaultEntryIds`, not by raw value.
- Show UI that a protected value exists without displaying it by default.
- Require local unlock/confirmation before revealing or syncing sensitive values.
- Delete or expire local vault values after successful approved server save.
- Exclude sensitive values from realtime events, audit payloads, screenshots, ordinary local drafts, ordinary outbox payloads, operation table rows, logs, and test fixtures.

Until Slice 10 is approved and implemented, outbox entries with `sensitiveVaultEntryIds` remain `sensitive_locked` or `blocked` and must not sync.

## Validation Matrix Required Before Real Sync

Slice 9E local tests:

- Duplicate `operationId` + identical payload returns the same result and creates one order.
- Duplicate `operationId` + different payload returns conflict and creates no second order.
- Ten parallel duplicate requests create one business record and return one stored result.
- Same operation id from a different actor or store does not replay another actor/store result.
- Canonical request hash is stable for key order and undefined normalization.
- Extra unexpected payload fields are rejected before hash/write.
- Operation id length and format are validated before any operation row or business row is written.
- Create with existing customer verifies store ownership.
- Create with existing device verifies same store and same customer.
- Create with ambiguous duplicate customer returns `blocked_review`.
- Update requires `serverOrderId` and `baseUpdatedAt`.
- Update with stale `baseUpdatedAt` returns conflict and does not overwrite server data.
- Viewer or missing active store is denied.
- Cross-store order/customer/device ids are denied.
- Sensitive/high-risk keys in request are rejected server-side.
- Audit and operation rows contain operation metadata and hash, not PII or secrets.
- Partial-write failure is covered: order/customer/device/event/operation finalize failure cannot create duplicate business rows on retry.

Later Slice 9F integration tests:

- Local outbox runner calls the narrow API only when feature flag is enabled.
- Network failure leaves entry retryable.
- Server conflict maps local entry to `conflict`.
- Server blocked review maps local entry to `blocked`.
- Successful create stores returned `serverOrderId`.
- Successful update does not alter customer/device master data outside the approved fields.
- Realtime invalidation after offline sync is disabled until a separate approved slice.

Manual/browser verification before production enablement:

- Two tabs/users see no duplicate order after reconnect retry.
- Offline create survives page refresh and later syncs once.
- Offline edit conflict does not overwrite newer server data.
- Duplicate customer risk pauses for review.
- Storage unavailable/quota warnings are visible.
- No screenshot or logs expose customer PII or unlock data.

## Migration And Release Plan

Stage 1, approved local work only:

- Add migration draft and tests.
- Do not run against production.
- Run local/static validation and targeted tests.
- Include validation queries for table existence, constraints, indexes, RLS, grants, duplicate operation keys, and JSON metadata redaction.
- Include a query or automated assertion proving operation/audit JSON keys do not include `phone`, `email`, `imei`, `serial`, `unlock`, `password`, `pin`, `storage_path`, `signed_url`, or `message_body`.
- Build evidence must be reported honestly. Current sandbox Turbopack port-binding failure is an environment-limited build evidence gap; it is not proof of code failure and not proof of build pass.

Stage 2, Owner approval required:

- Run `supabase db push --linked --dry-run` or equivalent migration preflight.
- Review lock/index risks and rollback constraints.
- Confirm backup/restore expectations.
- Apply migration only after explicit Owner approval.

Stage 3, Owner approval required:

- Enable server API flag in a non-production or controlled environment.
- Run narrow two-user/two-tab sync tests.
- Observe audit logs and operation rows.

Stage 4, Owner approval required:

- Enable production sync gradually.
- Keep kill switch available.
- Monitor duplicate order/customer/device creation, conflict rate, blocked review rate, and sync failures.

Rollback:

- Disable offline sync feature flag and keep local outbox entries intact.
- Do not delete the operation table during rollback.
- If schema was applied, leave compatible table in place until verified safe cleanup.
- If data anomaly is found, stop runner first, preserve operation rows and audit evidence, then repair with an incident plan.
- A production backup/restore expectation must be recorded before applying the migration. Backup existence alone is not enough; the restore path and responsible operator must be known.

## Acceptance Criteria For Approving Slice 9E

- Owner confirms local schema/API/test implementation may begin.
- Approval explicitly excludes production migration, deploy, push, environment flag enablement, and customer-facing sync.
- DATA/SEC/QA review comments are incorporated or recorded as deferred.
- Main thread remains sole writer.
- Sub-agents remain read-only unless a later task explicitly grants scoped write.

## Open Questions For Later, Not Blocking This Package

- Exact retention period for operation rows: default proposal is 90 days.
- Whether order create/update should be implemented through a Postgres RPC transaction or service-layer lock pattern.
- Whether offline create should allow initial finance fields or defer all finance edits to online-only paths.
- Manual review UI design for `blocked_review` customer/device conflicts.
- Cross-device offline draft sync is not supported by local IndexedDB; it would require a separate authenticated cloud draft design.
