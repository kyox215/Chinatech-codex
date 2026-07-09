# RepairDesk Mobile Performance And Touch Response Plan

Task ID: `TASK-20260709-019-mobile-performance-touch-plan`
Status: proposed
Date: 2026-07-09
Owner: Hexiang Huang / 鹤祥

## Goal

Improve RepairDesk mobile loading, touch response, scroll smoothness, and frame-rate stability on the daily shop workflows without a rewrite.

This plan is mobile-specific. It builds on the previous general performance work in `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`, which already introduced shared React Query cache defaults, request timeout/cancellation, command palette lazy loading, and aggregate APIs for dashboard, inventory, and orders queue.

## Scope

In scope:

- Mobile hot paths: `/orders`, `/orders/new`, `/orders/[id]`, `/customers`, `/buyback`, `/inventory`, and global mobile shell actions.
- Touch response: tap-to-feedback latency, scroll/tap conflict, sticky headers, bottom action bars, mobile sheets, keypad, camera/scanner entry points.
- Smoothness: long tasks, avoidable re-renders, list animation cost, layout shift from measured floating headers, heavy dialogs, camera/scanner/print import surfaces.
- Measurement and regression gates for mobile viewport `390x844`, `430x932`, and tablet `768x1024`.

Out of scope for the first implementation batch:

- Production deployment.
- Database migrations or indexes.
- Permission, payment, customer notification, or tenant-isolation behavior changes.
- New production monitoring SDKs or paid services without explicit owner approval.
- Deleting legacy `src/routes/*` cleanup debt.

## Current Evidence

- App Router entries are thin and import feature screens directly, for example `src/app/orders/page.tsx` imports `OrderListScreen`, and `src/app/orders/[id]/page.tsx` imports `OrderDetailScreen`.
- Shared React Query defaults already live in `src/lib/query-performance.ts` and are applied in `src/app/providers.tsx`.
- Mobile shell excludes the global dock on order workspace routes in `src/components/mobile-workspace-dock.tsx`, reducing bottom-action conflicts on order flows.
- Touch-safe dropdown behavior exists in `src/shared/lib/touch-safe-dropdown-trigger.ts` and is used by new-order device/fault selectors.
- Mobile keyboard helpers exist in `src/shared/lib/mobile-input.ts`.
- Current mobile overflow guard exists in `tests/e2e/visual-overflow.spec.ts`.
- Mobile专项 tests already cover dropdown drag-vs-tap, money keypad, and phone lookup stability.
- High-risk large screens remain concentrated in `src/features/orders/screens/order-detail-screen.tsx`, `src/features/orders/screens/order-list-screen.tsx`, `src/features/inventory/screens/inventory-screen.tsx`, and `src/features/buyback/screens/buyback-screen.tsx`.
- Worktree is currently dirty with unrelated kiosk, print, settings, API, and task-memory changes. Any implementation must stage only scoped files.

## Success Budgets

Collect a baseline before claiming improvement.

| Area | Target |
| --- | --- |
| Tap to visible feedback | under 100 ms for buttons/cards, under 150 ms for sheets/dialog shell |
| Interaction to next paint / INP-style local metric | under 200 ms on common actions |
| Scroll smoothness | no repeated long tasks over 50 ms while scrolling common mobile lists |
| Mobile route first usable | keep previous general target: under 2.5 s cold local production build, under 1.5 s warm cache |
| Route switch with cached data | under 300 ms perceived transition |
| Layout stability | no header/body overlap; `document.documentElement.scrollWidth <= window.innerWidth` |
| Touch correctness | drag must not trigger tap-only menus; bottom bars must not cover primary content |

## Execution Plan

### Phase 0 - Mobile Baseline

Purpose: measure real bottlenecks before editing code.

Work:

- Run production build and local preview.
- Collect mobile traces for `/orders`, `/orders/new`, one `/orders/[id]`, `/customers`, `/buyback`, and `/inventory`.
- Capture: route timing, API requests, long tasks, tap-to-feedback on major buttons, sheet open time, list scroll smoothness, and layout overflow.
- Record screenshots for the final mobile state if implementation follows.

Exit criteria:

- Baseline table exists.
- Top 3 mobile bottlenecks are evidence-based, not guessed.

### Phase 1 - Low-Risk Touch Response

Purpose: make taps feel immediate without changing business behavior.

Work:

- Add immediate pressed/pending states to high-frequency mobile actions where missing.
- Audit `onClick` paths that perform heavy synchronous work before visible feedback.
- Extend the existing `useTouchSafeDropdownTrigger` pattern only where drag/tap conflict is observed.
- Confirm all mobile buttons and list cards have safe hit areas and `touch-manipulation` where appropriate.
- Keep inputs at mobile-safe font sizes and preserve virtual money keypad behavior.

Exit criteria:

- Tap feedback appears before network or heavy computation.
- Existing touch专项 tests pass or are extended.

### Phase 2 - Mobile List And Detail Rendering

Purpose: reduce main-thread work during mobile list render, scroll, and detail open.

Work:

- Review `OrderMobileCard` and customer/buyback/inventory mobile cards for avoidable recalculation and unstable props.
- Reduce or disable staggered list animations on dense mobile lists when item count is high.
- Memoize pure card components only after confirming prop stability.
- Keep mobile detail Floating Card measurement, but ensure resize observers do not trigger repeated layout updates.
- Defer non-visible detail sections such as full timeline, photo preview, print, and secondary dialogs until opened.

Exit criteria:

- Mobile lists scroll without repeated long tasks.
- Detail open keeps first meaningful content fast and stable.

### Phase 3 - Heavy Surface Lazy Loading

Purpose: keep mobile first interaction light.

Work:

- Dynamic-load camera/scanner, print/export, import preview, quote workspace, and photo preview surfaces where they are not needed for first paint.
- Keep an immediate lightweight sheet/dialog shell so the user sees feedback instantly.
- Confirm lazy loading does not create blank sheets or delayed close behavior.

Exit criteria:

- Build output does not regress.
- Camera/scanner/print/quote flows still open and close correctly on mobile.

### Phase 4 - API And Data Shape Review

Purpose: avoid mobile UI waiting for unnecessary data.

Work:

- Confirm orders queue summary, inventory summary, and dashboard summary remain the preferred hot paths.
- Review customer/buyback/inventory list payloads for fields unused by mobile cards.
- Keep search debounced/deferred; do not refetch on every raw keystroke.
- Add request timing evidence only locally or in non-sensitive logs; do not expose PII.

Exit criteria:

- Hot mobile lists fetch only useful data or have a documented reason for larger payloads.
- Tenant isolation and service authorization stay unchanged.

### Phase 5 - Mobile Verification Gate

Required commands for implementation:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `git diff --check -- <touched files>`

Required browser checks:

- `tests/e2e/visual-overflow.spec.ts`
- `tests/e2e/new-order-mobile-dropdown-scroll.spec.ts` with `REPAIRDESK_E2E_ORDER_AUDIT=1`
- `tests/e2e/mobile-input-keyboard.spec.ts` with `REPAIRDESK_E2E_ORDER_AUDIT=1`
- `tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts` with `REPAIRDESK_E2E_ORDER_AUDIT=1`
- Manual or Playwright screenshots at `390x844` and `430x932` for touched pages.

Acceptance:

- No page-level horizontal overflow.
- No visible text/control overlap.
- No bottom action bar covering primary actions.
- Touch drag does not trigger tap-only menus.
- Tap feedback appears quickly before async work completes.
- Screenshots or no-screenshot reason are recorded.

## Recommended First Batch

Start with a narrow, reversible batch:

1. Collect mobile baseline traces for `/orders`, `/orders/new`, `/orders/[id]`, `/customers`, `/buyback`, and `/inventory`.
2. Fix only the top 2-3 measured mobile interaction bottlenecks.
3. Prefer local card/render/lazy-load changes before API or architecture changes.
4. Run the mobile verification gate and capture screenshots.

This is the safest first batch because it does not require database work, production deployment, new dependencies, or permission changes.

## Rollback

- Touch-state changes: revert the touched component files.
- Animation changes: restore previous `framer-motion` variants or remove the conditional mobile reduction.
- Lazy-load changes: revert dynamic imports to direct imports.
- API shape changes: keep old endpoint contracts until all callers are migrated; otherwise revert the API/client pair together.

## Approval Points

Owner approval is required before:

- Production deployment.
- Adding monitoring SDKs, paid tools, or new production dependencies.
- Database migrations or indexes.
- Permission, payment, customer communication, or tenant-isolation behavior changes.
- Deleting legacy `src/routes/*` files.
