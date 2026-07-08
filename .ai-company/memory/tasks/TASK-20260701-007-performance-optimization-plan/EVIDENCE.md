# Evidence

Task ID: `TASK-20260701-007-performance-optimization-plan`

## Commands Run

- `git status --short`
- `nl -ba package.json | sed -n '1,180p'`
- `nl -ba src/app/providers.tsx | sed -n '1,220p'`
- `nl -ba src/lib/repairdesk/api.ts | sed -n '330,390p'`
- `rg -n "useQuery\\(|staleTime|refetchOnWindowFocus|keepPreviousData|prefetchQuery|invalidateQueries" src/features src/components src/app/providers.tsx src/lib/repairdesk/api.ts`
- `rg -n "from \\\"framer-motion\\\"|from 'framer-motion'|from \\\"recharts\\\"|from 'recharts'" src`
- `wc -l src/features/orders/screens/order-detail-screen.tsx src/features/orders/components/order-overview-tab.tsx src/features/inventory/screens/inventory-screen.tsx src/features/buyback/components/buyback-quote-workspace.tsx src/features/settings/screens/settings-screen.tsx src/features/orders/screens/order-list-screen.tsx src/features/dashboard/screens/dashboard-screen.tsx src/routes/orders.index.tsx`
- `nl -ba 'src/app/api/repairdesk/[...path]/route.ts' | sed -n '1,100p'`
- `nl -ba src/components/command-palette.tsx | sed -n '1,90p'`
- `nl -ba src/features/inventory/screens/inventory-screen.tsx | sed -n '155,195p'`
- `nl -ba src/features/settings/screens/settings-screen.tsx | sed -n '90,120p'`
- `npm run build` inside sandbox failed with Turbopack EPERM; rerun outside sandbox passed.
- `node -e ...` route timing against local production server before implementation.
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build` after implementation.
- `npx playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:3012/login screenshots/TASK-20260701-007-performance-optimization/login-production-1440.png`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/app-shell.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/repairdesk-smoke.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/visual-overflow.spec.ts`
- `npm run test -- src/lib/repairdesk/api.test.ts`
- `npx prettier --write src/lib/repairdesk/api.ts src/lib/repairdesk/api.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- non-sandbox `npm run build`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/repairdesk-smoke.spec.ts`
- `npx playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:3012/login screenshots/TASK-20260701-007-performance-optimization/api-timeout-login-1440.png`
- `npx prettier --write src/lib/repairdesk/types.ts src/lib/repairdesk/api.ts src/lib/repairdesk/api.test.ts src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-router.ts src/features/orders/api/query-keys.ts src/features/dashboard/screens/dashboard-screen.tsx`
- `npm run test -- src/lib/repairdesk/api.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build` inside sandbox failed with known Turbopack EPERM; rerun outside sandbox passed.
- `npm run agents:check`
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`
- `git diff --check -- src/lib/repairdesk/types.ts src/lib/repairdesk/api.ts src/lib/repairdesk/api.test.ts src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-router.ts src/features/orders/api/query-keys.ts src/features/dashboard/screens/dashboard-screen.tsx`
- `POST /api/repairdesk/dashboard/summary` against local E2E mock production preview.
- Playwright request monitor for `/` against local E2E mock production preview.
- `npx playwright screenshot --viewport-size=1440,900 http://127.0.0.1:3013/ screenshots/TASK-20260701-007-performance-optimization/dashboard-summary-1440.png`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3013 npx playwright test tests/e2e/repairdesk-smoke.spec.ts`
- `npx prettier --write src/lib/repairdesk/types.ts src/lib/repairdesk/api.ts src/lib/repairdesk/api.test.ts src/server/api/repairdesk-router.ts src/features/inventory/api/query-keys.ts src/features/inventory/screens/inventory-screen.tsx src/features/inventory/server/inventory.repository.ts src/features/inventory/server/inventory.service.ts src/features/inventory/testing/mock-api.ts src/lib/mock/api.ts`
- `npm run test -- src/lib/repairdesk/api.test.ts src/features/inventory/testing/mock-api.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build` inside sandbox failed with known Turbopack EPERM; rerun outside sandbox passed.
- `POST /api/repairdesk/inventory/summary` against local E2E mock production preview.
- Playwright request monitor for `/inventory` against local E2E mock production preview.
- `npx playwright screenshot --viewport-size=1440,900 http://127.0.0.1:3014/inventory screenshots/TASK-20260701-007-performance-optimization/inventory-summary-1440.png`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3014 npx playwright test tests/e2e/repairdesk-smoke.spec.ts`
- `npx prettier --write docs/PERFORMANCE_OPTIMIZATION_PLAN.md .ai-company/memory/ACTIVE_CONTEXT.md .ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/TASK.md .ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/EVIDENCE.md .ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/CHECKPOINTS.md .ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/HANDOFF.md .ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/MEMORY_DELTA.md`
- `npm run agents:check`
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`
- `git diff --check -- <Batch 4 files and closeout documents>`
- `lsof -nP -iTCP:3014 -sTCP:LISTEN`

## Verified Facts

- `package.json` defines `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run check`.
- The app uses Next, React, React Query, Supabase, Framer Motion, Recharts, Vitest, and Playwright.
- `src/app/providers.tsx` creates a default `QueryClient` without shared `defaultOptions`.
- The authenticated shell mounts `CommandPalette` globally through `Providers`.
- `CommandPalette` only fetches recent orders when open, but the component and command UI are still part of the global provider tree.
- API calls go through `requestJson` in `src/lib/repairdesk/api.ts`; there is no timeout, abort wiring, request timing, or request id metadata in that wrapper.
- The RepairDesk API route is `dynamic = "force-dynamic"`, so authenticated tenant API server caching should not be the first assumed fix.
- Current query usage mixes query key factories and raw broad keys such as `["orders"]`, `["order-stats"]`, `["customers"]`, and `["customer-detail"]`.
- Some pages have stale times, but dashboard stats, dashboard recent orders, settings queries, inventory stats/list, buyback list/stats, message template queries, and repairdesk options need policy review.
- `recharts` is imported by chart components; `framer-motion` is imported by shell and multiple feature screens.
- Large file counts show that order detail, order overview, inventory, buyback quote, and settings require phased refactors rather than one-shot changes.

## Batch 1 Implementation Evidence

Files added:

- `src/lib/query-performance.ts`
- `src/components/use-command-palette.ts`

Main files touched:

- `src/app/providers.tsx`
- `src/components/command-palette.tsx`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/screens/order-task-screen.tsx`
- `src/features/customers/screens/customer-list-screen.tsx`
- `src/features/customers/screens/customer-detail-screen.tsx`
- `src/features/dashboard/screens/dashboard-screen.tsx`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/features/buyback/screens/buyback-screen.tsx`
- `src/features/settings/screens/settings-screen.tsx`
- `src/features/messages/screens/messages-screen.tsx`
- `src/features/stores/api/use-store-shell-context.ts`
- `src/features/auth/screens/onboarding-screen.tsx`

Observed effects:

- `Providers` now creates a `QueryClient` with shared conservative defaults.
- `CommandPalette` body is dynamically imported and only rendered when opened; the keyboard hook lives in a lightweight separate file.
- Query stale times are centralized through `CACHE_TIMES`.
- Raw invalidation scan for `invalidateQueries({ queryKey: [` returned no remaining matches in `src/features`, `src/components`, `src/app`, or `src/lib`.
- Inventory and buyback search filters now use `useDeferredValue` before hitting list queries.
- Recharts was not changed because no current feature page imports `Sparkline` or `src/components/ui/chart.tsx`.

Baseline:

- Initial sandbox `npm run build` failed due Turbopack local process/port EPERM.
- Initial non-sandbox `npm run build` passed: compiled in 5.4s, TypeScript 9.2s.
- Initial unauthenticated route timings: protected business routes returned 307 to `/login` in 2-61ms. `/login` initially returned 500 because the old production server could not find `.next/build-manifest.json`; after rebuild/restart this resolved.

After implementation:

- Route timings against local production server:
  - `/` -> 307 in 55ms.
  - `/orders` -> 307 in 4ms.
  - `/orders/new` -> 307 in 3ms.
  - `/customers` -> 307 in 2ms.
  - `/inventory` -> 307 in 3ms.
  - `/buyback` -> 307 in 2ms.
  - `/settings` -> 307 in 2ms.
  - `/messages` -> 307 in 2ms.
  - `/login` -> 200 in 17ms.
- Final non-sandbox `npm run build` passed: compiled in 4.3s, TypeScript 9.7s.
- `npm run typecheck` passed.
- `npm run lint` passed after fixing one Prettier indentation issue.
- `npm run test` passed: 41 files, 247 tests.
- `repairdesk-smoke.spec.ts` passed: 4 tests.
- `visual-overflow.spec.ts` passed: 6 tests.
- `app-shell.spec.ts` was executed but 2 tests skipped because protected routes redirect to login in this unauthenticated environment.

## Batch 2 Implementation Evidence

Files added:

- `src/lib/repairdesk/api.test.ts`

Main files touched:

- `src/lib/repairdesk/api.ts`
- `src/components/command-palette.tsx`
- `src/features/dashboard/screens/dashboard-screen.tsx`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/screens/order-task-screen.tsx`
- `src/features/customers/screens/customer-list-screen.tsx`
- `src/features/customers/screens/customer-detail-screen.tsx`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/features/buyback/screens/buyback-screen.tsx`
- `src/features/settings/screens/settings-screen.tsx`
- `src/features/messages/screens/messages-screen.tsx`
- `src/features/stores/api/use-store-shell-context.ts`
- `src/features/auth/screens/onboarding-screen.tsx`

Observed effects:

- `src/lib/repairdesk/api.ts` now has `RepairDeskRequestOptions` with optional `signal` and `timeoutMs`.
- All RepairDesk client requests have a default 30-second timeout and return a friendly Chinese timeout error.
- Read-heavy hot path queries pass React Query `signal` into API functions, allowing abandoned reads to be cancelled.
- Mutations were not wired to cancellation signals to avoid interrupting submit/payment/update style operations.
- `src/lib/repairdesk/api.test.ts` covers successful response unwrapping and timeout error conversion.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts` passed: 1 file, 2 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 249 tests.
- non-sandbox `npm run build` passed: compiled in 4.0s, TypeScript 8.3s.
- Local production route timing after Batch 2:
  - `/` -> 307 in 23ms.
  - `/orders` -> 307 in 3ms.
  - `/orders/new` -> 307 in 2ms.
  - `/customers` -> 307 in 2ms.
  - `/inventory` -> 307 in 2ms.
  - `/buyback` -> 307 in 1ms.
  - `/settings` -> 307 in 1ms.
  - `/messages` -> 307 in 1ms.
  - `/login` -> 200 in 4ms.
- `repairdesk-smoke.spec.ts` passed after Batch 2: 4 tests.

## Batch 3 Implementation Evidence

Files touched:

- `src/lib/repairdesk/types.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/api.test.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/api/repairdesk-router.ts`
- `src/features/orders/api/query-keys.ts`
- `src/features/dashboard/screens/dashboard-screen.tsx`

Observed effects:

- `dashboard/summary` now aggregates recent orders and order stats in one API response while preserving the existing `orders/list-page` and `order-stats` endpoints.
- The aggregate endpoint uses partial-failure handling: if recent orders or stats fails alone, it returns the available data with safe fallback values and `partialErrors`.
- Dashboard now uses `getDashboardSummary({ pageSize: RECENT_PAGE_SIZE })` and `ordersKeys.dashboardSummary(...)`, so it no longer schedules separate Dashboard recent-orders and stats business queries.
- API client tests now cover the new aggregate endpoint path.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts` passed: 1 file, 3 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 250 tests.
- Sandbox `npm run build` failed with the known Turbopack local port EPERM; non-sandbox `npm run build` passed: compiled in 4.0s, TypeScript 8.7s.
- `npm run agents:check` passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` passed: 11 checks, 0 warnings, 0 errors.
- Scoped `git diff --check` passed.
- Local E2E mock production preview `POST /api/repairdesk/dashboard/summary` returned 200 with `recentOrders` and `stats`.
- Playwright request monitoring on `/` recorded RepairDesk API requests: `["onboarding/status","dashboard/summary"]`.
- `repairdesk-smoke.spec.ts` passed in ordinary protected-route preview mode: 4 tests.

Known verification note:

- `repairdesk-smoke.spec.ts` fails in E2E bypass/authenticated mock mode because its helper uses broad text locators that resolve to multiple visible elements after login. The same smoke test passes in ordinary protected-route preview mode.

## Batch 4 Implementation Evidence

Files touched:

- `src/lib/repairdesk/types.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/api.test.ts`
- `src/server/api/repairdesk-router.ts`
- `src/features/inventory/api/query-keys.ts`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/inventory/server/inventory.service.ts`
- `src/features/inventory/testing/mock-api.ts`
- `src/lib/mock/api.ts`

Observed effects:

- `inventory/summary` now aggregates filtered inventory list data and global inventory stats in one API response while preserving the existing `inventory/list`, `inventory/list-page`, and `inventory/stats` endpoints.
- The repository-level summary path reads inventory once, filters the list result for the page, and builds stats from the same full inventory set. This avoids the old page pattern where `inventory/list` and `inventory/stats` each triggered broad inventory reads.
- Inventory now uses `getInventorySummary(filters)` and `inventoryKeys.summary(filters)`, so it no longer schedules separate list and stats business queries on first load.
- The shared server-side inventory filter helper now includes `statuses`, preserving list filtering inside the summary endpoint.
- Mock API support was updated so E2E mode can return the same summary shape.
- API client tests now cover the new aggregate endpoint path.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts src/features/inventory/testing/mock-api.test.ts` passed: 2 files, 10 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 251 tests.
- Sandbox `npm run build` failed with the known Turbopack local port EPERM; non-sandbox `npm run build` passed: compiled in 4.1s, TypeScript 8.8s.
- `npm run agents:check` passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` passed: 11 checks, 0 warnings, 0 errors.
- Scoped `git diff --check` passed.
- `lsof -nP -iTCP:3014 -sTCP:LISTEN` returned no listener after preview shutdown.
- Local E2E mock production preview `POST /api/repairdesk/inventory/summary` returned 200 with filtered `list.total: 1` for `search: "iphone"` and global `stats.total: 3`.
- Playwright request monitoring on `/inventory` recorded RepairDesk API requests: `["onboarding/status","inventory/summary"]`.
- `repairdesk-smoke.spec.ts` passed in ordinary protected-route preview mode: 4 tests.

## Batch 5 Implementation Evidence

Files touched:

- `src/lib/repairdesk/types.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/api.test.ts`
- `src/server/api/repairdesk-router.ts`
- `src/features/orders/api/query-keys.ts`
- `src/features/orders/screens/order-list-screen.tsx`

Observed effects:

- `orders/queue-summary` now aggregates the order queue page list, workflow configuration, and RepairDesk filter options in one API response while preserving the existing `orders/list-page`, `order-workflow`, and `options` endpoints.
- The aggregate endpoint keeps the list read as the required page data. Workflow and options failures are downgraded to fallback values with `partialErrors`, so a supporting read cannot blank the order queue.
- Orders list now uses `getOrderQueueSummary(...)` and `ordersKeys.queueSummary(...)`, so it no longer schedules separate list, workflow, and options business queries on first load.
- API client tests now cover the new aggregate endpoint path.

Verification:

- `npm run test -- src/lib/repairdesk/api.test.ts` passed: 1 file, 5 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 42 files, 252 tests.
- Sandbox `npm run build` failed with the known Turbopack local port EPERM; non-sandbox `npm run build` passed: compiled in 3.3s, TypeScript 8.2s.
- `npm run agents:check` passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` passed: 11 checks, 0 warnings, 0 errors.
- Scoped `git diff --check` passed.
- `lsof -nP -iTCP:3015 -sTCP:LISTEN` returned no listener after preview shutdown.
- Local E2E mock production preview `POST /api/repairdesk/orders/queue-summary` returned 200 with `list.total: 48`, `workflow.statuses.length: 15`, `options.suppliers.length: 3`, and `options.technicians.length: 5`.
- Playwright request monitoring on `/orders` recorded RepairDesk API requests: `["onboarding/status","orders/queue-summary"]`.
- `repairdesk-smoke.spec.ts` passed in ordinary protected-route preview mode: 4 tests.

Known verification note:

- `repairdesk-smoke.spec.ts` fails in E2E bypass/authenticated mock mode because its helper uses broad text locators that resolve to multiple visible elements after login. The same smoke test passes in ordinary protected-route preview mode.

## Dirty Worktree Constraint

`git status --short` shows many existing modified/untracked files from prior work. Batch 1 intentionally avoided staging, commits, production deployment, database changes, new dependencies, or blanket cleanup.

Some files touched by this task already had unrelated WIP from earlier tasks, so final review should use the scoped file list above rather than assuming whole-file diffs are purely this batch.

## Visual Evidence

Screenshot:

- `screenshots/TASK-20260701-007-performance-optimization/login-production-1440.png`
- `screenshots/TASK-20260701-007-performance-optimization/api-timeout-login-1440.png`
- `screenshots/TASK-20260701-007-performance-optimization/dashboard-summary-1440.png`
- `screenshots/TASK-20260701-007-performance-optimization/inventory-summary-1440.png`
- `screenshots/TASK-20260701-007-performance-optimization/orders-queue-summary-1440.png`

The Batch 3 screenshot uses local E2E mock/bypass mode so the visible Dashboard can be captured without production credentials. Ordinary protected-route smoke still passes separately without exposing credentials.
The Batch 4 screenshot uses local E2E mock/bypass mode so the visible Inventory page can be captured without production credentials. Ordinary protected-route smoke still passes separately without exposing credentials.
The Batch 5 screenshot uses local E2E mock/bypass mode so the visible Orders page can be captured without production credentials. Ordinary protected-route smoke still passes separately without exposing credentials.
