# RepairDesk Performance Optimization Plan

Task ID: `TASK-20260701-007-performance-optimization-plan`
Status: batch 5 implemented and verified
Date: 2026-07-01
Owner: Hexiang Huang / 鹤祥

## 1. Goal

Optimize the perceived loading speed and response speed of the daily RepairDesk paths without a big-bang rewrite.

Primary business target:

- Front desk can open the dashboard, order queue, new order form, customer list, inventory, and buyback pages faster.
- Common actions such as search, route switch, order status update, dialog open, and detail preview should feel immediate after the first load.
- Implementation must preserve current RepairOS UI language, permissions, tenant isolation, order flows, inventory flows, and existing dirty-worktree changes.

## 2. Scope

In scope:

- Common-page first load and route transition performance.
- React Query cache policy, query key consistency, request dedupe, and invalidation precision.
- Lazy loading of heavy global or rarely used UI such as command search, charts, camera/scanner/import/print dialogs, and dense workspaces.
- API response shape and list endpoint efficiency where backward compatible.
- Component split plan for oversized screens that currently increase review and runtime risk.
- Verification gates for desktop and mobile.

Out of scope for the first implementation pass:

- Production deployment.
- Destructive cleanup.
- Payment, permission, or external customer-message behavior changes.
- Database index or schema migrations unless separately approved.
- New production dependencies unless separately approved.

## 3. Current Evidence

The repo is a Next.js App Router app with React Query and Supabase-facing API routes:

- `package.json` uses Next `^16.2.6`, React `^19.2.0`, `@tanstack/react-query`, Supabase, Framer Motion, Recharts, Playwright, Vitest, and the full `npm run check` gate.
- `src/app/providers.tsx` creates `new QueryClient()` with no shared defaults and mounts the app shell, `CommandPalette`, PWA service worker, and toaster for all authenticated pages.
- `src/components/command-palette.tsx` queries recent orders only when open, but the component and command UI still mount globally through `Providers`.
- `src/app/api/repairdesk/[...path]/route.ts` is `dynamic = "force-dynamic"` and routes all API calls through `handleRepairDeskGet` / `handleRepairDeskPost`; server caching is therefore not the main first step for authenticated tenant data.
- `src/lib/repairdesk/api.ts` wraps fetch through `requestJson`, but currently has no timeout, abort wiring, lightweight request timing, or request-id metadata.
- `src/features/orders/screens/order-list-screen.tsx` already has some stale times for workflow and list pages, but repairdesk options have no stale time and some mutations still invalidate broad raw keys such as `["orders"]` and `["order-stats"]`.
- `src/features/dashboard/screens/dashboard-screen.tsx` loads recent orders and order stats as two independent queries without stale times.
- `src/features/inventory/screens/inventory-screen.tsx` fetches stats and list separately; list disables focus refetch but has no stale time and search changes directly affect list filters.
- `src/features/settings/screens/settings-screen.tsx` loads settings, store context, members, and workflow; only workflow currently has a stale time.
- Heavy dependencies are imported by common screens and shell-related UI: `framer-motion` appears across shell and feature screens; `recharts` is imported by `src/components/sparkline.tsx` and `src/components/ui/chart.tsx`.
- Large implementation surfaces need phased refactors:
  - `src/features/orders/screens/order-detail-screen.tsx`: 3413 lines.
  - `src/features/orders/components/order-overview-tab.tsx`: 1831 lines.
  - `src/features/inventory/screens/inventory-screen.tsx`: 2752 lines.
  - `src/features/buyback/components/buyback-quote-workspace.tsx`: 2435 lines.
  - `src/features/settings/screens/settings-screen.tsx`: 1465 lines.

## 4. Risk And Autonomy

Current planning work is `R1 / L2`: documentation only, reversible, no runtime behavior change.

Recommended implementation work is mostly `R2 / L2`:

- Query cache and lazy-loading changes are reversible but can cause stale UI if invalidation is wrong.
- Component splits are reversible but can break dialogs, mobile layouts, or mutation flows if too broad.
- API response consolidation is higher risk because route contracts can affect multiple pages.

Approval required before:

- Adding database indexes or migrations.
- Adding bundle analyzer, monitoring SDKs, or other production dependencies.
- Changing permission, payment, customer notification, or production deployment behavior.
- Removing legacy files if there is uncertainty about active imports.

No sub-agents were spawned for this plan because the user asked for a plan, not a delegated multi-agent execution, and the scope is still a single planning artifact. If implementation is approved, QA/security or architecture review can be split into read-only sub-agent work packages.

## 5. Success Targets

These are proposed budgets for implementation and verification. Baseline measurements must be collected before claiming improvement.

- Dashboard, orders list, customers, inventory, buyback, settings first usable route: target under 2.5s cold local production build, under 1.5s warm cache.
- Route switch after data is cached: target under 300ms perceived transition.
- Common list API p95 in local/staging-like environment: target under 500-800ms depending on data size.
- Dialog open after route is loaded: target under 150ms for simple dialogs; lazy heavy dialogs may show immediate shell plus loading body.
- Search typing should not refetch on every raw keystroke; target debounced or deferred behavior.
- Bundle goal: keep shell bundle stable or smaller; move Recharts and heavy rarely used workspaces out of first route where possible.

## 6. Execution Roadmap

### Phase 0 - Baseline And Budgets

Purpose: measure before changing.

Work:

- Run production build and record route/build output.
- Start local production server and collect browser timings for `/`, `/orders`, `/orders/new`, `/customers`, `/inventory`, `/buyback`, `/settings`, and one representative `/orders/[id]`.
- Record API timings for dashboard stats, order list page, order workflow/options, customer list, inventory stats/list, store settings/context, and message templates.
- Save evidence in the task folder before implementation.

Exit criteria:

- Baseline table exists with route timing, API timing, bundle/build notes, and known blockers.
- Top 3 implementation targets are confirmed from evidence.

### Phase 1 - Low-Risk Client Cache And Invalidation Wins

Purpose: reduce duplicate network work and avoid unnecessary refetches.

Work:

- Add conservative React Query defaults in `src/app/providers.tsx`: short default `staleTime`, longer `gcTime`, and `refetchOnWindowFocus: false` unless a page explicitly needs focus refresh.
- Add or normalize stale times for static-ish data: workflow, repairdesk options, store settings, store context, store members, message templates, dashboard stats, inventory stats.
- Replace broad raw invalidations such as `["orders"]`, `["order-stats"]`, `["customers"]`, and `["customer-detail"]` with query key factories where possible.
- Keep mutation success behavior explicit: create/update order invalidates precise list/detail/stats keys; settings mutations invalidate only affected settings/workflow/store keys.
- Apply `keepPreviousData` or equivalent placeholder behavior to paged lists where it is not already used.

Exit criteria:

- Common pages perform fewer repeat requests during route switches and window focus.
- Create/update workflows still show fresh data after mutation.
- Tests and browser smoke pass.

### Phase 2 - First-Load Bundle Reduction

Purpose: make the authenticated shell and first route lighter.

Work:

- Lazy-load the command palette body so authenticated pages do not pay full command/search UI cost before the user opens it.
- Keep command open instant by rendering the dialog shell immediately and loading order search content on demand.
- Dynamic-load Recharts-based components such as `Sparkline` or chart wrappers only where charts are visible.
- Lazy-load heavy optional surfaces: scanner/camera, print/export, import preview, quote subflows, and dense mutation dialogs.
- Prefer local component-level dynamic imports before introducing new dependencies.

Exit criteria:

- Production build confirms shell or page chunks do not regress.
- Command palette, chart pages, and lazy dialogs still work on desktop and mobile.

### Phase 3 - API And Data Shape Optimization

Purpose: improve response speed without changing business behavior.

Work:

- Review list endpoints for field projection and pagination; avoid sending full DTOs when the page uses a subset.
- Dashboard: consider a lightweight dashboard summary endpoint that returns recent orders plus stats in one response, or otherwise add stale times to prevent repeated duplicate calls.
- Orders list: keep workflow counts efficient; if counts are expensive, return them with the page result or cache them server-side only where safe for tenant data.
- Inventory: debounce or defer search, then review whether list and stats can avoid duplicate broad reads.
- Add abort/timeout wiring to `requestJson` or query functions if implementation evidence shows hanging requests.
- Consider non-PII request timing headers or client performance marks for local diagnosis.

Exit criteria:

- Fewer or smaller API responses on hot paths.
- API contract changes are backward compatible and covered by tests.
- No permission, tenant, or RLS boundary is weakened.

### Phase 4 - Large-Screen Component Splits

Purpose: reduce review risk and make future performance work safer.

Work packages:

- Split `order-detail-screen.tsx` into a controller hook/model layer, tab containers, mutation hooks, and lazy dialog components.
- Split `order-overview-tab.tsx` into finance, customer/device, workflow, history, and action sections.
- Split `inventory-screen.tsx` into list controller, KPI/header, detail drawer/dialog, import flow, and transaction/action dialogs.
- Split `buyback-quote-workspace.tsx` into quote state/model, step components, estimate summary, proof/capture, and inventory handoff.
- Treat `src/routes/orders.index.tsx` as legacy cleanup debt only after active route checks confirm it is not used.

Exit criteria:

- Each split has no business behavior change.
- Existing tests pass after each small package.
- Mobile RepairOS detail standards remain intact.

### Phase 5 - Monitoring And Guardrails

Purpose: prevent performance regressions.

Work:

- Add a lightweight performance report template to task evidence.
- Add Playwright route smoke checks that record or assert acceptable route readiness for the most common pages.
- Add bundle-size/build-output review to the delivery checklist.
- Consider Vercel Speed Insights or another production monitor only after owner approval.

Exit criteria:

- Future UI/API changes have a repeatable performance gate.
- Performance regressions are visible before push/deploy.

## 7. Recommended First Implementation Batch

If the owner approves execution, start with this narrow batch:

1. Phase 0 baseline collection.
2. React Query default options plus stale-time normalization for workflow/options/settings/dashboard/inventory.
3. Precise invalidation cleanup for orders, customers, settings, and inventory.
4. Lazy-load command palette body and Recharts chart components.
5. Verify with lint, typecheck, tests, build, and browser smoke on dashboard/orders/customers/inventory/buyback/settings.

Reason: this batch is high-impact, reversible, does not require database migration, does not add dependencies, and targets the common paths first.

## 8. Verification Matrix

Required commands for implementation batches:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff --check -- <touched files>`

Browser checks:

- Desktop 1440px: `/`, `/orders`, `/orders/new`, `/customers`, `/inventory`, `/buyback`, `/settings`.
- Mobile 390px: `/orders/new`, `/orders/[id]` if test data exists, `/inventory`, `/buyback`, `/customers`.
- Check no blank screen, no overlapping text, no layout shift from lazy components, no broken dialogs.

API checks:

- `/api/repairdesk/orders/list-page`
- `/api/repairdesk/order-stats`
- `/api/repairdesk/order-workflow`
- `/api/repairdesk/repairdesk-options`
- `/api/repairdesk/customers/list-page`
- `/api/repairdesk/inventory/list`
- `/api/repairdesk/inventory/stats`
- `/api/repairdesk/settings/store`
- `/api/repairdesk/stores/context`

Business regression checks:

- Create order.
- Open order detail.
- Advance safe status transition.
- Record or view payment state.
- Search customers.
- Open inventory item detail.
- Buyback quote to inventory handoff if that flow is touched.

## 9. Rollback Plan

- Query/cache changes: revert touched provider/query/invalidation files.
- Lazy imports: revert dynamic import wrappers to direct imports.
- API shape changes: keep old endpoint contract until all callers are migrated; revert route/controller changes if tests or browser checks fail.
- Database indexes/migrations: require separate migration rollback plan before execution.
- Component splits: each split must be isolated so a failed package can be reverted without undoing unrelated batches.

## 10. Architecture Decision Draft

Decision: optimize RepairDesk through progressive hot-path improvements instead of a repo-wide rewrite.

Status: proposed.

Preferred option:

- Measure hot paths.
- Apply reversible client cache and bundle-split improvements.
- Then optimize API response shapes and large components in separate batches.

Rejected option:

- Large one-shot refactor of all RepairDesk screens and API routes.

Reason:

- The repo has many active uncommitted changes and large business-critical files. A staged plan gives measurable wins while protecting order, customer, inventory, buyback, and settings workflows.

Review trigger:

- If Phase 0 shows the main bottleneck is database latency rather than client bundle/query behavior, reclassify the next phase and prepare a data-migration review before adding indexes.

## 11. Batch 1 Implementation Result

Implemented on 2026-07-01:

- Added `src/lib/query-performance.ts` for shared React Query defaults and cache time constants.
- Added `src/components/use-command-palette.ts` and dynamically loaded `CommandPalette` from `src/app/providers.tsx`.
- Centralized stale times across dashboard, orders, customers, inventory, buyback, settings, messages, onboarding, and shell context queries.
- Replaced raw order/customer invalidation strings with query key factories.
- Added `keepPreviousData` to key list queries where useful.
- Added `useDeferredValue` for inventory and buyback search filters.

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 41 files, 247 tests.
- Non-sandbox `npm run build` passed.
- `repairdesk-smoke.spec.ts` passed: 4 tests.
- `visual-overflow.spec.ts` passed: 6 tests.
- Screenshot: `screenshots/TASK-20260701-007-performance-optimization/login-production-1440.png`.

Notes:

- Protected business routes redirect to `/login` without a valid session, so route timings currently measure middleware/login behavior rather than authenticated data waterfalls.
- Recharts was not changed because the chart modules are not currently imported by active feature pages.
- API response shape, request timeout policy, database indexes, monitoring SDKs, and production deployment remain future phases.

## 12. Batch 2 Implementation Result

Implemented on 2026-07-02:

- Added `RepairDeskRequestOptions` to `src/lib/repairdesk/api.ts`.
- Added a default 30-second timeout for `/api/repairdesk/*` requests.
- Added friendly Chinese timeout error handling.
- Wired React Query `signal` into read-heavy hot path queries so abandoned reads can be cancelled.
- Added `src/lib/repairdesk/api.test.ts` for response unwrapping and timeout behavior.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 249 tests.
- Non-sandbox `npm run build` passed.
- `repairdesk-smoke.spec.ts` passed: 4 tests.
- Screenshot: `screenshots/TASK-20260701-007-performance-optimization/api-timeout-login-1440.png`.

Notes:

- Mutations were intentionally left out of React Query cancellation wiring to avoid aborting submitted business actions.
- Database index review remains a future phase and requires separate owner approval.

## 13. Batch 3 Implementation Result

Implemented on 2026-07-02:

- Added a backward-compatible `dashboard/summary` POST endpoint that returns recent orders and order stats together.
- Kept existing `orders/list-page` and `order-stats` endpoints unchanged for other callers.
- Updated Dashboard to use one React Query request through `getDashboardSummary` instead of separate recent-order and stats queries.
- Added partial-failure handling in the aggregate endpoint: if either recent orders or stats fails, the endpoint returns the available side plus safe fallback data and a `partialErrors` marker.
- Added `DashboardSummary` / `DashboardSummaryInput` types and a `ordersKeys.dashboardSummary()` query key.
- Extended `src/lib/repairdesk/api.test.ts` to cover the aggregate API client path.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts` passed: 1 file, 3 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 250 tests.
- Sandbox `npm run build` failed with the known Turbopack local port EPERM; non-sandbox `npm run build` passed: compiled in 4.0s, TypeScript 8.7s.
- `npm run agents:check` passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` passed.
- Scoped `git diff --check` passed for Batch 3 files.
- Local E2E mock production preview returned 200 for `POST /api/repairdesk/dashboard/summary` and included `recentOrders` plus `stats`.
- Playwright request monitoring on `/` saw only `onboarding/status` and `dashboard/summary` RepairDesk API calls for the Dashboard route, confirming the dashboard business data waterfall is now one aggregate call.
- `repairdesk-smoke.spec.ts` passed in ordinary protected-route preview mode: 4 tests.
- Screenshot: `screenshots/TASK-20260701-007-performance-optimization/dashboard-summary-1440.png`.

Notes:

- Running `repairdesk-smoke.spec.ts` against E2E bypass/authenticated mock mode fails because the old smoke helper uses broad `getByText()` locators that match multiple visible labels after login; ordinary protected-route smoke passes. This is a test assertion issue, not a Batch 3 runtime regression.
- The local mock order repository normalizes page sizes to a minimum of 10, so the dashboard request asks for 6 but receives 10 recent mock rows, matching the previous `listOrdersPage({ pageSize: 6 })` behavior.
- No database migration, new dependency, production deployment, permission, payment, or customer-notification behavior changed.

## 14. Batch 4 Implementation Result

Implemented on 2026-07-02:

- Added a backward-compatible `inventory/summary` POST endpoint that returns inventory list data and global inventory stats together.
- Kept existing `inventory/list`, `inventory/list-page`, and `inventory/stats` endpoints unchanged for other callers.
- Added repository-level `getInventorySummary()` so the inventory page can reuse one inventory read for both filtered list output and global stats instead of doing a duplicate broad read.
- Updated Inventory to use one React Query request through `getInventorySummary(filters)` and `inventoryKeys.summary(filters)`.
- Added `InventorySummary` types and matching mock API support.
- Added the missing `statuses` filter to the shared server-side inventory filter helper so summary filtering preserves existing list behavior.
- Extended `src/lib/repairdesk/api.test.ts` to cover the aggregate API client path.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts src/features/inventory/testing/mock-api.test.ts` passed: 2 files, 10 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 251 tests.
- Sandbox `npm run build` failed with the known Turbopack local port EPERM; non-sandbox `npm run build` passed: compiled in 4.1s, TypeScript 8.8s.
- `npm run agents:check` passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` passed.
- Scoped `git diff --check` passed for Batch 4 files and closeout documents.
- Local E2E mock production preview returned 200 for `POST /api/repairdesk/inventory/summary` and included a filtered `list` plus global `stats`.
- Playwright request monitoring on `/inventory` saw only `onboarding/status` and `inventory/summary` RepairDesk API calls for the Inventory route, confirming the page business data waterfall is now one aggregate call.
- `repairdesk-smoke.spec.ts` passed in ordinary protected-route preview mode: 4 tests.
- Screenshot: `screenshots/TASK-20260701-007-performance-optimization/inventory-summary-1440.png`.

Notes:

- Inventory summary stats remain global while the list honors filters/search, matching the previous page behavior.
- No database migration, new dependency, production deployment, permission, payment, or customer-notification behavior changed.

## 15. Batch 5 Implementation Result

Implemented on 2026-07-02:

- Added a backward-compatible `orders/queue-summary` POST endpoint that returns the order page list, workflow configuration, and filter options together.
- Kept existing `orders/list-page`, `order-workflow`, and `options` endpoints unchanged for other callers.
- Updated Orders list to use one React Query request through `getOrderQueueSummary(...)` and `ordersKeys.queueSummary(...)` instead of separate list, workflow, and options queries on first load.
- Added `OrderQueueSummary` / `OrderQueueSummaryInput` types.
- Added partial-failure handling for workflow/options: if either supporting read fails, the route still returns the order list plus safe fallback values and a `partialErrors` marker.
- Extended `src/lib/repairdesk/api.test.ts` to cover the aggregate API client path.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts` passed: 1 file, 5 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 252 tests.
- Sandbox `npm run build` failed with the known Turbopack local port EPERM; non-sandbox `npm run build` passed: compiled in 3.3s, TypeScript 8.2s.
- `npm run agents:check` passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` passed.
- Scoped `git diff --check` passed for Batch 5 files and closeout documents.
- Local E2E mock production preview returned 200 for `POST /api/repairdesk/orders/queue-summary` with `list.total: 48`, `workflow.statuses.length: 15`, `options.suppliers.length: 3`, and `options.technicians.length: 5`.
- Playwright request monitoring on `/orders` saw only `onboarding/status` and `orders/queue-summary` RepairDesk API calls for the Orders route, confirming the page business data waterfall is now one aggregate call.
- `repairdesk-smoke.spec.ts` passed in ordinary protected-route preview mode: 4 tests.
- Screenshot: `screenshots/TASK-20260701-007-performance-optimization/orders-queue-summary-1440.png`.

Notes:

- Running `repairdesk-smoke.spec.ts` against E2E bypass/authenticated mock mode still fails because the old smoke helper uses broad `getByText()` locators that match multiple visible labels after login; ordinary protected-route smoke passes. This is a test assertion issue, not a Batch 5 runtime regression.
- No database migration, new dependency, production deployment, permission, payment, or customer-notification behavior changed.
