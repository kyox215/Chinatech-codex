# Evidence Index — TASK-20260709-012-phone-lookup-mobile-stability

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | owner reported first phone digit causes mobile lookup/keypad position jump | owner screenshots and request | observed | 2026-07-09T11:22:12Z | CEO-Orchestrator |
| E-002 | code | lookup popover now opens only when search threshold is met | `src/features/orders/forms/customer-intake-lookup.tsx`; `src/features/orders/forms/customer-phone-lookup.tsx` | implemented | 2026-07-09T11:22:12Z | CEO-Orchestrator |
| E-003 | test | 1/2 digit phone input stays closed; 3 digits opens; 2 text chars still search | `npx vitest run src/features/orders/forms/customer-lookup-mobile-stability.test.tsx` | passed, 1 file / 3 tests | 2026-07-09T11:17:32Z | CEO-Orchestrator |
| E-004 | lint | changed files pass static lint | `npx eslint tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts src/features/orders/forms/customer-intake-lookup.tsx src/features/orders/forms/customer-phone-lookup.tsx src/features/orders/forms/customer-lookup-mobile-stability.test.tsx` | passed | 2026-07-09T11:18Z | CEO-Orchestrator |
| E-005 | typecheck | project typecheck passes with current worktree | `npm run typecheck` | passed | 2026-07-09T11:19Z | CEO-Orchestrator |
| E-006 | test | full unit/model/component suite passes | `npm run test` | passed, 94 files / 626 tests | 2026-07-09T11:20Z | CEO-Orchestrator |
| E-007 | lint | full project lint passes with current worktree | `npm run lint` | passed | 2026-07-09T11:21Z | CEO-Orchestrator |
| E-008 | visual-blocker | mobile Playwright screenshot verification could not run | `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts`; retry with `127.0.0.1:3012` | blocked: `listen EPERM` local port binding denied by sandbox | 2026-07-09T11:19Z | CEO-Orchestrator |
| E-009 | build-blocker | production build could not run in sandbox | `npm run build` | blocked: Turbopack internal local port binding denied; unsandboxed retry rejected by policy | 2026-07-09T11:20Z | CEO-Orchestrator |
| E-010 | build | production build passed after running outside the restrictive sandbox | `npm run build` | passed | 2026-07-09T12:13Z | CEO-Orchestrator |
| E-011 | visual | mobile Playwright phone lookup stability spec passed and generated screenshots | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 PLAYWRIGHT_WEBSERVER_COMMAND='npm run dev -- -H 127.0.0.1 -p 3012' REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts` | passed, 1 test | 2026-07-09T12:14Z | CEO-Orchestrator |
| E-012 | screenshot | first digit phone lookup remains stable without opening the results popover | `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-first-digit-stable-chromium.png` | captured | 2026-07-09T12:14Z | CEO-Orchestrator |
| E-013 | screenshot | 3-digit phone lookup can open the upward/stable results state | `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-three-digits-popover-chromium.png` | captured | 2026-07-09T12:14Z | CEO-Orchestrator |

Do not record secrets or unsupported passed claims. Earlier screenshot blockage was due sandbox port binding; the visual check later passed outside the restrictive sandbox.
