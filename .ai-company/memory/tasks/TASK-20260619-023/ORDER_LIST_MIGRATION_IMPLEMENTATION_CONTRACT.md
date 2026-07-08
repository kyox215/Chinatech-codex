# Order List Legacy Route Migration Implementation Contract

- Task: `TASK-20260619-023`
- Status: implementation contract ready; business code not modified
- Owner: Integration Lead / CEO Agent
- Departments: INT, ARCH, FE, QA, DOC
- Date: 2026-06-19 CEST

## Goal

Prepare the next code task to remove the only verified live `@/routes` dependency:

```txt
src/features/orders/screens/order-list-screen.tsx
  -> "@/routes/orders.index"
```

This contract is intentionally planning-only. It does not edit business code,
delete route files, change dependencies, stage, commit, push, deploy, or touch
production data.

## Current Facts

| Area | Verified fact | Evidence |
|---|---|---|
| Legacy source | `src/routes/orders.index.tsx` is a client component with 1826 lines. | `wc -l src/routes/orders.index.tsx` |
| Active wrapper | `src/features/orders/screens/order-list-screen.tsx` imports `OrdersListPage` from `@/routes/orders.index` and returns it. | file read |
| App route | `src/app/orders/page.tsx` is already a thin App Router page importing `OrderListScreen`. | file read |
| Local components in legacy file | `FiltersPanel`, `FilterGroup`, `EmptyOrdersState`, `DesktopOrderQueueRow`, `OrdersErrorState`, `MobileOrdersFloatingHeader`, `PaginationBar`, and `OrderStatusFilterControls` are local to the legacy route file. | structure scan |
| Local utilities in legacy file | `buildOrdersCsv`, `escapeCsvCell`, and `formatCsvDate` are local pure-ish export helpers. | structure scan |
| Existing reusable feature assets | `OrderMobileCard`, `OrderListPrintSheet`, `OrderDetailScreen`, `NewOrderScreen`, and `ordersKeys` already live under `src/features/orders`. | file reads |
| Data access | The list uses `listOrderWorkflow`, `listOrdersPage`, `getRepairDeskOptions`, `transitionOrder`, and `batchTransition` from `@/lib/repairdesk/api`. | import and API scans |
| Query keys | The legacy file uses `ordersKeys.workflow()`, but still uses raw keys for page list (`["orders", "page", ...]`), options (`["repairdesk-options"]`), and invalidation (`["orders"]`, `["order-stats"]`). | query-key scan |
| Side effects | The list mutates `document.body.dataset.mobileWorkspaceActive`, uses `ResizeObserver`, listens to `resize`, `afterprint`, and `REPAIRDESK_NEW_ORDER_EVENT`, calls `window.print()`, and creates a CSV download with `Blob`/`URL`. | source scan |

## Structure Map

| Lines | Responsibility | Migration target |
|---|---|---|
| 1-103 | imports and constants | distribute to target feature files |
| 104-120 | `ORDER_LIST_PAGE_SIZE`, `orderStageHints`, `ActiveFilterChip` | screen/model helper |
| 122-312 | `FiltersPanel` | `src/features/orders/components/order-list-filters.tsx` |
| 314-323 | `FilterGroup` | same as filter component or local private helper |
| 325-356 | `EmptyOrdersState` | `src/features/orders/components/order-list-states.tsx` |
| 358-591 | desktop grid and `DesktopOrderQueueRow` | `src/features/orders/components/order-list-desktop-row.tsx` |
| 593-606 | `OrdersErrorState` | `src/features/orders/components/order-list-states.tsx` |
| 608-811 | `MobileOrdersFloatingHeader` | `src/features/orders/components/order-list-mobile-header.tsx` |
| 813-1545 | `OrdersListPage` state, data fetching, mutations, rendering, dialogs | `src/features/orders/screens/order-list-screen.tsx` |
| 1548-1609 | CSV export helpers | `src/features/orders/model/order-list-export.ts` |
| 1611-1659 | `PaginationBar` | `src/features/orders/components/order-list-states.tsx` or `order-list-pagination.tsx` |
| 1661-1826 | `OrderStatusFilterControls` | `src/features/orders/components/order-list-filters.tsx` |

## Recommended Implementation Option

Use a behavior-preserving staged migration, not a redesign.

The implementation task should extract the legacy route into feature-owned files,
then replace the 5-line wrapper in `src/features/orders/screens/order-list-screen.tsx`
with the real feature screen. Leave `src/routes/orders.index.tsx` untouched until a
separate cleanup task proves there are zero live `@/routes` imports and all code
gates pass.

## Work Packages For The Code Task

### WP-01 Pure Export Helper

- Owner: FE
- Allowed files:
  - `src/features/orders/model/order-list-export.ts`
  - `src/features/orders/model/order-list-export.test.ts`
- Move:
  - `buildOrdersCsv`
  - `escapeCsvCell`
  - `formatCsvDate`
- Validation:
  - Unit test CSV escaping, empty values, quote escaping, multiline cells, and date formatting shape.
- Exit criteria:
  - Helper exports are covered by tests and no UI behavior changes are introduced.

### WP-02 Presentational Components

- Owner: FE
- Allowed files:
  - `src/features/orders/components/order-list-filters.tsx`
  - `src/features/orders/components/order-list-desktop-row.tsx`
  - `src/features/orders/components/order-list-mobile-header.tsx`
  - `src/features/orders/components/order-list-states.tsx`
- Move:
  - `FiltersPanel`
  - `FilterGroup`
  - `DesktopOrderQueueRow`
  - `MobileOrdersFloatingHeader`
  - `EmptyOrdersState`
  - `OrdersErrorState`
  - `PaginationBar`
  - `OrderStatusFilterControls`
- Keep:
  - `OrderMobileCard` in `order-list-items.tsx`
  - `OrderListPrintSheet` in `order-list-print-sheet.tsx`
- Validation:
  - Typecheck props after extraction.
  - Do not introduce new business logic into presentational components beyond existing callback props.
- Exit criteria:
  - Components compile as feature-owned imports and keep line counts near documented budgets.

### WP-03 Feature Screen Container

- Owner: FE
- Allowed files:
  - `src/features/orders/screens/order-list-screen.tsx`
  - `src/features/orders/api/query-keys.ts` only if query-key factories are added.
- Move:
  - State orchestration from `OrdersListPage`.
  - Queries and mutations.
  - dialog orchestration for `NewOrderScreen` and `OrderDetailScreen`.
  - print/export handlers and event listeners.
- Required improvements:
  - Remove `import OrdersListPage from "@/routes/orders.index"`.
  - Prefer feature query-key factories. At minimum, use `ordersKeys.workflow()` and `ordersKeys.options()` consistently; if needed, add `ordersKeys.page(...)` and `ordersKeys.stats()`.
  - Preserve current raw invalidation aliases where other screens still rely on them, unless a broader query-key cleanup is explicitly in scope.
- Exit criteria:
  - `rg -n 'from "@/routes|@/routes' src` has no active-source hits.

### WP-04 Validation

- Owner: QA + Integration Lead
- Required commands:
  - `rg -n 'from "@/routes|@/routes' src`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- UI/browser checks after code implementation:
  - `/orders` desktop list renders.
  - `/orders` mobile width does not overflow.
  - search/filter sheet opens and closes.
  - new order dialog opens.
  - detail dialog opens from a desktop row.
  - CSV/print buttons do not crash on an empty selection path.
- Exit criteria:
  - All applicable gates pass, or any failure is classified with evidence as pre-existing or environment-specific.

### WP-05 Legacy Route Cleanup Readiness

- Owner: ARCH + QA
- Scope:
  - Do not delete `src/routes/*` in the same implementation task unless explicitly approved.
  - After zero live `@/routes` imports and full code gates pass, start a separate cleanup task to classify/delete legacy route files.

## File Ownership

Allowed for the later implementation task:

- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/components/order-list-filters.tsx`
- `src/features/orders/components/order-list-desktop-row.tsx`
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/components/order-list-states.tsx`
- `src/features/orders/model/order-list-export.ts`
- `src/features/orders/model/order-list-export.test.ts`
- `src/features/orders/api/query-keys.ts`

Forbidden unless separately approved:

- `src/routes/*` deletion.
- `src/lib/repairdesk/api.ts` contract changes.
- `src/features/orders/server/*`.
- Supabase migrations.
- order workflow/status model changes.
- payment, permission, tenant isolation, customer communication, or production data changes.
- dependency changes.
- stage/commit/push/deploy.

## Architecture Decision

Recommended option: feature-owned extraction with behavior preservation.

Rejected for now:

- Big-bang redesign of the order list UI: unnecessary risk for removing one import.
- Direct one-file copy into `order-list-screen.tsx`: easiest mechanically, but it preserves a 1800+ line high-blast-radius screen and violates the architecture file-size direction.
- Deleting `src/routes/*` in the same task: cleanup should wait until imports and full gates prove the route is dead.

## Risk Classification

- This planning task: R1 / L2, docs and memory only.
- Later implementation task: likely R2 / L2 if it stays behavior-preserving and local to feature-owned order-list files.
- Escalate to owner approval if the implementation changes API payloads, order workflow semantics, customer data handling, permissions, payment behavior, dependencies, production data, route deletion, or deployment.

## Rollback And Pause Conditions

Rollback for implementation:

- Revert only the implementation task files.
- Restore `src/features/orders/screens/order-list-screen.tsx` wrapper import if needed.
- Leave unrelated dirty worktree files untouched.

Pause and reclassify if:

- Type extraction reveals hidden dependency on `src/routes/*` beyond the wrapper.
- Server/API contract changes become necessary.
- `OrderDetailScreen` or `NewOrderScreen` behavior must change.
- Query invalidation changes break detail/new-order/dashboard data freshness.
- Full app gates fail in a way not attributable to unrelated pre-existing worktree state.

## Acceptance Evidence For The Later Code Task

- `rg -n 'from "@/routes|@/routes' src` returns no active source hits.
- `/orders` remains served by `src/app/orders/page.tsx` -> `OrderListScreen`.
- The order list still supports: search, workflow group filters, filter sheet, desktop row click, mobile cards, new-order dialog, detail dialog, single/bulk transitions, print, CSV export, loading, empty, error, and pagination states.
- Full code gates pass or are classified with evidence.
