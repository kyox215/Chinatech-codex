# Evidence Index - TASK-20260709-015-phone-keypad-bottom-dock

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | owner reported phone virtual keypad still appears above the lower dock area | owner screenshot and message | observed | 2026-07-09T12:57:49Z | CEO-Orchestrator |
| E-002 | root-cause | phone keypad still used Radix Popover instead of fixed dock | `src/components/orders/phone-keypad-input.tsx` before change | confirmed | 2026-07-09T12:50Z | CEO-Orchestrator |
| E-003 | code | phone keypad migrated to shared fixed bottom dock | `src/components/orders/phone-keypad-input.tsx` | implemented | 2026-07-09T12:53Z | CEO-Orchestrator |
| E-004 | test | component test asserts phone keypad renders inside fixed `data-virtual-keyboard-dock` | `src/components/orders/phone-keypad-input.test.tsx` | implemented | 2026-07-09T12:54Z | CEO-Orchestrator |
| E-005 | test | mobile e2e asserts phone keypad is fixed and lower-screen docked | `tests/e2e/mobile-input-keyboard.spec.ts`; `tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts` | implemented | 2026-07-09T12:54Z | CEO-Orchestrator |
| E-006 | test | focused keypad and lookup tests pass | `npx vitest run src/components/orders/phone-keypad-input.test.tsx src/components/orders/money-keypad-input.test.tsx src/features/orders/components/device-unlock-fields.test.tsx src/features/orders/forms/customer-lookup-mobile-stability.test.tsx src/features/orders/components/order-option-pickers.test.tsx` | passed, 5 files / 11 tests | 2026-07-09T12:55Z | CEO-Orchestrator |
| E-007 | lint | changed phone keypad and e2e files pass targeted ESLint | `npx eslint src/components/orders/phone-keypad-input.tsx src/components/orders/phone-keypad-input.test.tsx tests/e2e/mobile-input-keyboard.spec.ts tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts` | passed | 2026-07-09T12:55Z | CEO-Orchestrator |
| E-008 | typecheck | full TypeScript check passes | `npm run typecheck` | passed | 2026-07-09T12:55Z | CEO-Orchestrator |
| E-009 | diff | tracked diff has no whitespace errors | `git diff --check` | passed | 2026-07-09T12:55Z | CEO-Orchestrator |
| E-010 | visual | mobile Playwright confirms phone keypad uses fixed bottom dock | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 PLAYWRIGHT_WEBSERVER_COMMAND='npm run dev -- -H 127.0.0.1 -p 3012' REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/mobile-input-keyboard.spec.ts tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts` | passed, 2 tests | 2026-07-09T12:56Z | CEO-Orchestrator |
| E-011 | lint | full project ESLint passes | `npm run lint` | passed | 2026-07-09T12:56Z | CEO-Orchestrator |
| E-012 | test | full Vitest suite passes | `npm run test` | passed, 97 files / 637 tests | 2026-07-09T12:56Z | CEO-Orchestrator |
| E-013 | build | production build passes outside restrictive sandbox | `npm run build` | passed | 2026-07-09T12:57Z | CEO-Orchestrator |
| E-014 | screenshot | phone keypad screenshot shows bottom-docked keypad surface | `screenshots/TASK-20260709-009-customer-phone-name-keypad/phone-keypad-chromium.png` | captured | 2026-07-09T12:57Z | CEO-Orchestrator |
| E-015 | screenshot | phone search result state remains usable with bottom dock | `screenshots/TASK-20260709-009-customer-phone-name-keypad/new-order-customer-phone-results-chromium.png` | captured | 2026-07-09T12:57Z | CEO-Orchestrator |
| E-016 | screenshot | first digit state remains stable | `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-first-digit-stable-chromium.png` | captured | 2026-07-09T12:57Z | CEO-Orchestrator |
| E-017 | screenshot | 3-digit lookup state remains usable with bottom dock | `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-three-digits-popover-chromium.png` | captured | 2026-07-09T12:57Z | CEO-Orchestrator |
| E-018 | rebase | phone keypad fix rebased on latest `origin/main` after schema reconcile closeout | `git merge-base --is-ancestor origin/main HEAD`; `git log --oneline origin/main..HEAD` | passed; one local commit | 2026-07-09T13:08Z | CEO-Orchestrator |
| E-019 | lint | post-rebase full project ESLint passes | `npm run lint` | passed | 2026-07-09T13:09Z | CEO-Orchestrator |
| E-020 | typecheck | post-rebase full TypeScript check passes | `npm run typecheck` | passed | 2026-07-09T13:09Z | CEO-Orchestrator |
| E-021 | test | post-rebase focused keypad and lookup tests pass | `npx vitest run src/components/orders/phone-keypad-input.test.tsx src/components/orders/money-keypad-input.test.tsx src/features/orders/components/device-unlock-fields.test.tsx src/features/orders/forms/customer-lookup-mobile-stability.test.tsx src/features/orders/components/order-option-pickers.test.tsx` | passed, 5 files / 11 tests | 2026-07-09T13:09Z | CEO-Orchestrator |
| E-022 | build | post-rebase production build passes outside restrictive sandbox | `npm run build` | passed | 2026-07-09T13:09Z | CEO-Orchestrator |
| E-023 | release | scoped phone keypad fix pushed to `main` | `git push origin HEAD:main` | pushed `83f157b7..c316e953` | 2026-07-09T13:10Z | CEO-Orchestrator |

Build and Playwright required non-sandbox execution because the default sandbox denies local process or port binding. This is an environment restriction, not an application failure.
