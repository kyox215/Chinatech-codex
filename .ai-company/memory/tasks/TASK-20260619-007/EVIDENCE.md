# Evidence — TASK-20260619-007

## E-001 — Files changed

- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/forms/new-order-fault-diagnosis-section.tsx`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/lib/ui-patterns.ts`
- `src/lib/component-patterns.ts`
- `screenshots/new-order-dialog-1440.png`
- `.ai-company/memory/tasks/TASK-20260619-007/*`
- `.ai-company/memory/ACTIVE_CONTEXT.md`

## E-002 — Static and unit verification

- `npx eslint src/features/orders/screens/new-order-screen.tsx src/features/orders/forms/new-order-fault-diagnosis-section.tsx src/features/orders/forms/new-order-quotation-section.tsx src/lib/ui-patterns.ts src/lib/component-patterns.ts` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test` — passed: 37 test files, 220 tests.

## E-003 — Build verification

- Initial sandboxed `npm run build` failed with Turbopack `Operation not permitted` while binding a port.
- Non-sandbox rerun was blocked by stale `.next/dev/lock`; no Next/Turbopack build process was running.
- Removed generated stale lock `.next/dev/lock`.
- Final `npm run build` — passed.

## E-004 — E2E and browser verification

- First `npm run test:e2e:desktop` exposed that the three-column breakpoint was too early: `/orders/new` overflowed at 1024px and 1280px.
- Adjusted the workspace grid to two columns at 1024px, compact three columns at 1280px, and wider three columns at 1536px+.
- Targeted E2E:
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3011 PLAYWRIGHT_WEBSERVER_COMMAND='REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npm run build && REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx next start -p 3011' REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx playwright test tests/e2e/business-desktop-overflow.spec.ts -g "business routes render"` — passed 3 tests.
- Browser metrics from local preview `http://127.0.0.1:3011/orders`:
  - 1024px: columns 2, grid 884, dialog 992, section widths 436/436/436, documentWidth 1024.
  - 1280px: columns 3, grid 1140, dialog 1248, section widths 346/454/316, documentWidth 1280.
  - 1440px: columns 3, grid 1292, dialog 1400, section widths 394/516/359, documentWidth 1440.
- Screenshot saved at `screenshots/new-order-dialog-1440.png`.

## E-005 — Known out-of-scope E2E failures

The full desktop E2E run also reported unrelated existing failures in order detail audit selectors and a `/settings` network-idle timeout. These were not caused by the new order form changes and were not modified in this task.
