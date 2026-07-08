# Memory Delta

Task ID: `TASK-20260701-007-performance-optimization-plan`

## Add

- For RepairDesk performance work in this repo, default to staged hot-path optimization:
  1. collect route/API/build baselines;
  2. tune React Query defaults, stale times, and invalidation precision;
  3. lazy-load global/heavy optional UI such as command palette body, charts, scanner/camera/import/print flows;
  4. optimize API response shapes only with backward-compatible tests;
  5. split oversized screens in small validated packages.
- Current high-yield files for a first implementation pass:
  - `src/app/providers.tsx`
  - `src/components/command-palette.tsx`
  - `src/lib/repairdesk/api.ts`
  - `src/features/orders/screens/order-list-screen.tsx`
  - `src/features/dashboard/screens/dashboard-screen.tsx`
  - `src/features/inventory/screens/inventory-screen.tsx`
  - `src/features/settings/screens/settings-screen.tsx`
  - chart wrappers under `src/components/sparkline.tsx` and `src/components/ui/chart.tsx`
- Avoid one-shot refactors of `order-detail-screen.tsx`, `order-overview-tab.tsx`, `inventory-screen.tsx`, and `buyback-quote-workspace.tsx`; split them into controller/model/components/dialog packages first.
- Batch 1 implementation created `src/lib/query-performance.ts` as the shared cache policy surface and `src/components/use-command-palette.ts` as the lightweight command shortcut hook.
- `src/app/providers.tsx` should keep command palette body dynamically imported so the authenticated app shell does not pay full command/search UI cost before open.
- Query invalidation should prefer existing factories such as `ordersKeys`, `customersKeys`, `inventoryKeys`, `messageSettingsKeys`, `storesKeys`, and `platformKeys`; do not reintroduce raw `["order-stats"]` or `["customer-detail"]` keys.
- In unauthenticated local production verification, protected business routes are expected to 307 to `/login`; use smoke/overflow tests and screenshots that do not require secrets unless a valid test session is explicitly provided.
- Batch 2 added `RepairDeskRequestOptions` to `src/lib/repairdesk/api.ts`; future read-heavy API wrappers should accept and pass `{ signal }` so React Query can cancel abandoned reads.
- Keep submit/update/payment/notification mutations out of automatic cancellation unless a specific UX flow proves it is safe to abort them.
- Default RepairDesk API timeout is 30 seconds; use a longer explicit `timeoutMs` only for known long-running upload/import flows.
- Batch 3 added `dashboard/summary` as the Dashboard aggregate API path. For similar future hot paths, prefer backward-compatible aggregate read endpoints that preserve the old endpoints and include partial-failure fallback rather than making one failed subread blank the page.
- Dashboard verification can use E2E mock/bypass mode for the visible page screenshot, but ordinary protected-route smoke should still be run separately because the current smoke spec has broad text locators that fail after login in strict mode.
- Batch 4 added `inventory/summary` as the Inventory aggregate API path. For inventory-like pages, prefer repository-level aggregate reads that build the filtered list and global stats from one source read while keeping old endpoints intact.
- Batch 5 added `orders/queue-summary` as the Orders list aggregate API path. For page-support reads such as workflow/options, keep the main list as required data and downgrade support failures to `partialErrors` plus safe fallbacks.

## Do Not Add

- Do not claim performance improvements before Phase 0 baselines exist.
- Do not add database indexes, monitoring SDKs, or bundle-analysis dependencies without explicit owner approval.
- Do not use blanket `git clean` or broad deletion in this dirty checkout.
- Do not treat single-run build timing changes as stable performance proof; use them only as local evidence alongside code-level bundle/request reductions.
