# Evidence Index — TASK-20260717-165957-task

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | implementation task exists | `TASK.md` | observed | 2026-07-17 | CEO-Orchestrator |
| E-002 | source | client request timeout is now distinguishable by type | `src/lib/repairdesk/api.ts` | `RepairDeskRequestTimeoutError` added | 2026-07-17 | Integration Lead |
| E-003 | source | create request carries `operation_id` and status endpoint exists | `src/lib/repairdesk/types.ts`; `src/lib/repairdesk/api.ts`; `src/server/api/repairdesk-schemas.ts` | verified | 2026-07-17 | Integration Lead |
| E-004 | source | server stores and replays create operation id through `order_events.payload` | `src/features/orders/server/order.repository.ts` | verified | 2026-07-17 | Integration Lead |
| E-005 | source | router skips duplicate audit/realtime on idempotent replay | `src/server/api/repairdesk-router.ts` | verified | 2026-07-17 | Integration Lead |
| E-006 | source | front end enters confirming/uncertain state after timeout and blocks repeat submit | `src/features/orders/screens/new-order-screen.tsx`; `src/features/orders/forms/new-order-submit-bar.tsx` | verified | 2026-07-17 | Integration Lead |
| E-007 | test | focused API/router/repository/new-order tests | `npx vitest run src/lib/repairdesk/api.test.ts src/features/realtime/server/realtime-router-integration.test.ts src/features/orders/server/order.repository.test.ts src/features/orders/model/new-order-form.test.ts src/features/orders/api/use-new-order-offline-autosave.test.tsx` | 5 files / 89 tests PASS | 2026-07-17 | Integration Lead |
| E-008 | test | lint | `npm run lint` | PASS | 2026-07-17 | Integration Lead |
| E-009 | test | typecheck | `npm run typecheck` | PASS | 2026-07-17 | Integration Lead |
| E-010 | test | build | `npm run build` | PASS after non-sandbox rerun; sandbox failed on Turbopack port-binding permission | 2026-07-17 | Integration Lead |
| E-011 | test | full unit suite | `npm run test` | 153 files / 1091 tests PASS | 2026-07-17 | Integration Lead |
| E-012 | e2e | mobile new-order interaction regression | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3127 PLAYWRIGHT_REUSE_EXISTING_SERVER=1 REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx playwright test tests/e2e/new-order-mobile-dropdown-scroll.spec.ts` | 1/1 PASS | 2026-07-17 | Integration Lead |
| E-013 | e2e | primary route overflow matrix including `/orders/new` | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3127 PLAYWRIGHT_REUSE_EXISTING_SERVER=1 REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx playwright test tests/e2e/visual-overflow.spec.ts` | 7/7 PASS | 2026-07-17 | Integration Lead |
| E-014 | visual | desktop and mobile screenshots of `/orders/new` | `screenshots/TASK-20260717-165957-order-create-recovery/` | captured and inspected | 2026-07-17 | Integration Lead |

Do not record secrets or unsupported passed claims. Prefer stable paths, commit IDs, test reports, screenshots, or concise log references.
