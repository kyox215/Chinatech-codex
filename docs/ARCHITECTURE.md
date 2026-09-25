# ChinaTech RepairDesk Architecture

Status: active
Owner: Architecture + Documentation / Integration Lead
Scope: current module boundaries, import rules, migration phases, and quality gates for RepairDesk.
Last reviewed: 2026-09-16 CEST by `TASK-20260915-002-experience-refactor-audit` (AI retirement and core-domain priorities)

## Order cost application boundary (2026-09-05 local candidate)

The local candidate removes the order-specific internal cost UI and direct application routes. New order payloads reject legacy cost fields before schema parsing, while historical cost tables, database triggers, and projection maintenance remain intact for audit continuity. Inventory purchase costs, procurement allocations, profit, export, backfill, and currency tools continue through their own feature gates and permissions. Removing the application entry points does not retire the database schema or historical data. This candidate has not been published.

This project is a modular Next.js App Router application. URLs stay in `src/app`, while business UI, data hooks, and server rules move into feature modules over time.

## Target Structure

```txt
src/
  app/                         # Next.js routes, metadata, layouts, route handlers only
  features/
    orders/
      screens/                 # route-level orchestration
      components/              # order-only display components
      forms/                   # order forms and dialogs
      api/                     # query keys and client API facade
      server/                  # order service/repository wrappers
      model/                   # schemas, rules, calculations
      testing/                 # order mock builders and handlers
    customers/
    inventory/
    messages/
  entities/
    order/                     # cross-feature order rules and formatting
    customer/
    device/
  shared/
    ui/                        # cross-domain UI only
    lib/                       # pure helpers: money, date, phone, env, result
    config/                    # routes, navigation, constants
    testing/                   # shared test render and builders
  server/
    api/                       # route dispatch, error handling, zod validation
    db/                        # Supabase admin/client
    observability/             # logging and future instrumentation
```

## Import Boundaries

- `src/app/*` imports feature screens or `server/api/*` route dispatchers only.
- Client components use `features/*/api` or `@/lib/repairdesk/api`; they never import `features/*/server` or `src/server/*`.
- `features/*/server/*` is server runtime only and can import repository/db modules.
- `shared/*` never imports `features/*`.
- Cross-feature usage goes through each feature's `index.ts`, not deep paths.
- `src/components/ui/*` remains the shadcn/Radix primitive layer. Business UI goes into feature folders unless it is genuinely shared.

### Order Data Roundtrip

- `features/settings/components/order-data-section.tsx` owns the Settings interaction only.
- `features/orders/model/order-data-contract.ts` is the single field and workbook-version contract.
- `features/orders/server/order-data-workbook.ts` owns XLSX creation, ZIP preflight, parsing, and formula rejection.
- `features/orders/server/order-data.service.ts` coordinates preview/apply; export, access, normalization, and persistence stay in separate server modules.
- `server/api/repairdesk-router.ts` is the only HTTP dispatch boundary. Multipart is accepted only for `orders/data/import/preview`.
- Business writes happen through the database batch RPC; client code never writes order import rows directly.
- See `docs/ORDER_DATA_ROUNDTRIP.md` for permissions, data lifecycle, limits, and rollback.
- See `docs/ORDER_INTERNAL_COSTS.md` for repair-line cost isolation, permissions, snapshots, and rollout order.

### Realtime And Intelligent Preload

- `features/realtime/model/query-freshness-coordinator.ts` owns cache epochs, cancellation, event
  coalescing, mutation guards, reconnect recovery, and store isolation.
- `features/*/api/query-options.ts` is the shared query contract used by screens and preload code.
- `features/preload/components/app-preload-bridge.tsx` performs bounded idle-time warming only after
  an active store is available.
- Realtime invalidation always wins over an older preload result; manual refresh and optimistic
  rollback use the same coordinator.
- Private metadata-only Broadcast is the fast path. A server-owned store/domain revision sentinel is
  the durable consistency path: supported visible routes read only that small version every 30 seconds
  and refresh business queries only when it changes.
- Order writes and order child-table writes bump the revision in the same database transaction.
  Version-locked edits remain fail-closed and show a proactive conflict before saving.
- See `docs/REALTIME_PRELOAD_COORDINATION.md` for the conflict matrix, flags, security boundary, and
  production activation gate.
- `docs/REALTIME_DATA_CONSISTENCY_DECLARATION.md` is the normative contract for future features.
- `docs/STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md` is the normative gate for shell
  bootstrap, startup request ownership, tenant cache cleanup, print capability and disabled recovery.

### Manual order notifications (2026-09-16 local candidate)

Both ordinary notification endpoints use `features/orders/server/order-notification.repository.ts`
and the service-only `repairdesk_record_order_notification` RPC. Requests carry the unchanged
user-seen version and a stable UUID operation key; the server never supplies a fresh version.
The database checks current actor, store and lifecycle, hashes the normalized complete intent,
then resolves exact replay before locking and checking the order version. Order, message,
timeline, audit and the existing mutation receipt commit together. Missing RPCs fail closed;
there is no multi-request persistence fallback.

The notification dialog freezes its version, selected quote, recipient and content once edited,
opened externally or submitted. A clean, unopened session may rebase as server/store identity
loads. Dirty conflicts require explicit reload; an uncertain response preserves the complete
original request and key for recovery. Definite validation/permission rejections permit explicit
reload. Quote confirmation still uses the existing dedicated quote RPC.
Opening the external chat preserves `noopener,noreferrer`; a null window handle does not
prove that the popup was blocked. The UI reports an opening attempt and requires a separate
manual confirmation before any notification mutation.

A manual confirmation records an employee assertion, not external delivery. Ordinary notifications
cannot perform approval, completed or cancelled transitions. A completed order may receive a
no-transition confirmation without rewriting terminal facts. The selected recipient is retained
in the store/order-scoped message event, so later customer edits do not rewrite contact history;
body remains in the message log. Audit summaries, command receipts and metadata broadcasts do
not duplicate the phone/body. Deploy both forward notification migrations before matched BFF/UI.
See the experience audit report for local validation and remaining release constraints.

### Customer write consistency (2026-09-16 local candidate)

Customer and device editors carry the database `updated_at` value unchanged through the API.
Creation has a separate input contract; edits and device deletion require the version the user
actually saw. Single-row writes bind store, entity and expected version in the database condition;
device writes also bind the customer. Missing versions are not replaced with the current time.

`repairdesk_replace_customer_tags` locks the customer, verifies the actor/store/version and every
tag, then replaces assignments and advances the customer version in one transaction. Its public
execute surface is service-role only. Customer/device CAS payloads use `nextCustomerWriteVersion`
to advance beyond the frozen expected timestamp, including future clocks and microsecond tails;
the original expected string remains unchanged in the database condition. Global timestamp triggers
are deliberately absent so legacy bulk-import timestamps and rollback checks remain compatible.
Six customer-related tables advance durable revisions. Customer/device identities also advance the
orders revision, with a consistent orders-then-customers lock order. Inactive-store cleanup must not
recreate revision rows. Metadata-only events remain the fast path; customer routes observe both
customers and orders revisions because their read model includes order history and balances.

`repairdesk_delete_customer_device` verifies the active actor/store, locks the device, checks its
expected version and rejects any same-store linked repair order before deletion. The row lock
serializes against concurrent foreign-key references; a separate preflight count is insufficient
because the legacy foreign key can otherwise clear an order's device link during deletion.

The customer editor wrapper preserves a dirty draft when the remote version changes, pauses save,
and requires an explicit reload before replacing that draft. This timestamp CAS contract does not
provide a command replay ledger: an uncertain network retry can return a version conflict and
requires loading the saved record. Phone uniqueness across concurrent edits to different customers
is a separate unresolved constraint.

Release order is all four new migrations with writes paused, migration/ACL verification, then the
matching BFF and clients. The fourth migration removes the first migration's global timestamp
triggers; do not expose the intermediate schema to legacy imports. Old clients missing
versions must fail closed rather than fall back to unconditional writes. This local candidate and
its scoped SQL/UI evidence do not certify the historical migration baseline or production rollout;
see the [refactor release notes](REFACTOR_RELEASE_2026-09-16.md).

### AI assistant retirement (2026-09-16 local candidate)

The Owner requested full removal of the in-product AI assistant. This local batch removes assistant UI, provider request paths, client/BFF dispatch, usage settings, cloud vision and maintenance cron. Local IMEI/barcode/OCR capture remains a supported inventory/order capability; image validation and local recognition must live outside the retired assistant feature.

Historical SQL migrations, usage tables/records and inventory `ai_confirmed` provenance remain compatible. No database DROP or remote cleanup is part of source removal. Before release, prove that historical `reserved` AI usage requests cannot keep a store lifecycle fence active: the old fence does not ignore expiry, and the retired cron previously settled stale reservations. Verify or drain these using a separately reviewed operational procedure; do not infer production state from local tests.

The historical `AI_ASSISTANT_*` documents below are reference records, not active rollout instructions. Implementation and current verification status: [refactor release notes](REFACTOR_RELEASE_2026-09-16.md).

## Legacy Route Migration Status

2026-09-25 remediation: the Owner requested remediation of all audit findings and subsequent push/deploy. Fresh source/config scans found no live imports of the six legacy routes; all six were unchanged in Git before removal and were backed up with SHA-256 evidence. They have now been removed locally under TASK-20260925-003. The App Router remains the sole route entry. Final release remains subject to the current task gates. See [retirement manifest](../artifacts/audit-remediation-20260925/retired-routes.json).

The following June record is historical; its pending-deletion state is superseded by the local removal above.


Current verified state as of 2026-06-20 CEST by `TASK-20260620-002`:

- `src/app/*` is the current route layer.
- `src/routes/` still exists for legacy compatibility and must not be used for new route work.
- Active source has no verified live `@/routes` imports: `rg -n 'from "@/routes|@/routes' src` returns no matches.
- `TASK-20260619-025` moved the order-list behavior into `src/features/orders/screens`, `src/features/orders/components`, and `src/features/orders/model`.
- `TASK-20260620-002` classified all six remaining `src/routes/*` files as delete-ready after Owner approval and post-deletion validation. No legacy route files were deleted by that classification task.
- `TASK-20260620-003` produced the approval-gated deletion preflight contract and green non-destructive baseline. It does not grant deletion approval.
- `CONFLICT-20260619-004` is mitigated, not fully closed, until the approved deletion cleanup removes the legacy files and validation passes.

Migration order:

1. Preserve zero live `@/routes` imports.
2. Do not add new work under `src/routes/`.
3. Delete the classified `src/routes/*` files only through a separate Owner-approved scoped cleanup task, following `TASK-20260620-003/LEGACY_ROUTES_DELETION_PREFLIGHT_CONTRACT.md`.
4. Continue splitting oversized order-list modules by feature responsibility during later UI refactors.

## Migration Phases

1. Infrastructure: feature folders, query key factories, zod API router, tests, Storybook, CI.
2. Orders: split list/detail/new-order screens into hero, tabs, forms, dialogs, print sheet, approval dialog, and payment dialog.
3. Customers: split list/detail screens into customer hero plus five stable groups: overview, orders, devices, follow-ups (including messages/timeline), and profile.
4. Data layer: move legacy repository functions from `src/server/repairdesk-repository.ts` into feature repositories.
5. Mock layer: split `src/lib/mock/api.ts` into feature-specific testing handlers/builders.

## File Size Budget

- screen: 350 lines maximum
- form/dialog: 300 lines maximum
- presentational component: 220 lines maximum
- service/repository: 450 lines maximum

If a file crosses the budget, split by responsibility rather than by arbitrary sections.

## Quality Gates

Use:

```bash
npm run check
```

This runs lint, typecheck, unit tests, and build. E2E is intentionally separate:

```bash
npm run test:e2e
```

The strict mock-backed shell and mobile interaction regression is:

```bash
npm run test:e2e:interactions:mock
```

Storybook is for reusable states of business components:

```bash
npm run storybook
```

## Security And Reliability Hardening — 2026-07-10

- The public API surface remains the single Next.js BFF route. Customer list/detail/search/device reads now enforce the centralized server permission matrix before repository access.
- `technician` and `viewer` customer reads remain fail closed until a stable object-scope resolver exists. A display name is not an authorization key.
- Supabase email verification trusts canonical `email_confirmed_at` or server-controlled claims only; user-editable metadata is never authorization evidence.
- Order, inventory and legacy customer compatibility reads use deterministic batches beyond PostgREST's 1000-row response cap. This is a correctness bridge, not the final high-performance SQL pagination design.
- Payment recording is designed as an additive immutable ledger plus a service-role-only, security-invoker RPC. It locks the store-scoped idempotency key and order, then writes balance, ledger, event and audit in one transaction.
- Rollout order for code that requires a new RPC is database expand first, catalog/grant/PostgREST visibility verification second, and application deployment last. A caller must never deploy before its required RPC.
- Existing page layout and UI are unchanged by TASK-009. UI work from TASK-010 is an independent change set and must not be staged with this release.
- Production database application still follows the Database Application Gate. A migration that passes targeted schema-clone tests is not automatically safe to apply when linked security or recovery gates fail.

## Store Memos — 2026-07-27

- `/memos` is a thin App Router entry that renders `features/memos/screens`; contracts, query keys,
  UI, server policy, repository, service and mock parity remain inside the feature boundary.
- All reads and writes pass through the existing RepairDesk BFF. Client code does not access Supabase
  tables directly. Every repository query is store-scoped, and every mutation uses the typed,
  service-role-only `repairdesk_mutate_store_memo_rpc`.
- `store_memos` is the business table. `store_memo_operation_receipts` is durable mutation
  idempotency metadata. A generic PII-free hashed-scope limiter counts BFF read/write attempts outside
  tenant export data. Same-store membership foreign keys prevent cross-store actors and
  assignees; lifecycle fences and the dynamic purge/restore catalog continue to own store deletion.
- Memo authorization is server-owned and non-grantable: owners/managers manage all rows;
  technicians/sales edit body text only on rows they created and transition rows they created or own;
  viewers are read-only. Multi-store users require an explicit current-store selection. A platform
  administrator without an active membership does not gain memo access.
- `memos` is a route-and-capability-aware Realtime domain. Broadcast payloads contain invalidation
  metadata only; query caches are invalidated under `memosKeys.store(storeId)`. Hard deletion does not
  advance the memo revision or emit a Broadcast.
- Rollout is fail closed behind `REPAIRDESK_MEMOS_ENABLED=1` plus an exact UUID store allowlist. See
  `docs/STORE_MEMOS.md` for API, release, rollback and operational evidence.
