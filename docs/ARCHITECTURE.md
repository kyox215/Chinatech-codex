# ChinaTech RepairDesk Architecture

Status: active
Owner: Architecture + Documentation / Integration Lead
Scope: current module boundaries, import rules, migration phases, and quality gates for RepairDesk.
Last reviewed: 2026-07-12 CEST by `TASK-20260712-002-mobile-interaction-click-reliability`

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

### Realtime And Intelligent Preload

- `features/realtime/model/query-freshness-coordinator.ts` owns cache epochs, cancellation, event
  coalescing, mutation guards, reconnect recovery, and store isolation.
- `features/*/api/query-options.ts` is the shared query contract used by screens and preload code.
- `features/preload/components/app-preload-bridge.tsx` performs bounded idle-time warming only after
  an active store is available.
- Realtime invalidation always wins over an older preload result; manual refresh and optimistic
  rollback use the same coordinator.
- See `docs/REALTIME_PRELOAD_COORDINATION.md` for the conflict matrix, flags, security boundary, and
  production activation gate.

## Legacy Route Migration Status

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
3. Customers: split list/detail screens into customer hero, device tab, order tab, message tab, marketing tab, follow-up tab.
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
