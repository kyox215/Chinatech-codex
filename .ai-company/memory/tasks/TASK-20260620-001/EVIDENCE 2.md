# EVIDENCE — TASK-20260620-001

## Code Evidence

- `src/features/orders/model/order-workflow.ts`: added manual transition action helper.
- `src/features/orders/screens/order-detail-screen.tsx`: desktop inline transition panel and all-enabled-status action list.
- `src/features/orders/server/order.repository.ts`: manual transition target validation for `transitionOrder`.
- `src/features/orders/testing/mock-api.ts`: mock manual transition validation.
- `src/features/orders/model/order-workflow.test.ts`: model coverage for all enabled manual statuses.
- `src/features/orders/testing/mock-api.test.ts`: mock transition timeline coverage.
- `tests/e2e/order-desktop-ui-audit.spec.ts`: desktop expectation changed from transition Dialog to inline panel.

## Verification

| Evidence ID | Type | Claim supported | Source / command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | task | owner goal and acceptance recorded | `TASK.md` | observed | 2026-06-20T00:17:58+02:00 | Integration Lead / CEO Agent |
| E-002 | static | workflow helper offers every enabled non-current concrete status | `src/features/orders/model/order-workflow.ts`; `src/features/orders/model/order-workflow.test.ts` | implemented and covered | 2026-06-19T22:19:48Z | Integration Lead / CEO Agent |
| E-003 | static | manual transition backend validates target enabled/current-state, not configured next-step edges | `src/features/orders/server/order.repository.ts`; `src/features/orders/testing/mock-api.ts` | implemented | 2026-06-19T22:19:48Z | Integration Lead / CEO Agent |
| E-004 | static | transition writes `status_changed` timeline event | `src/features/orders/server/order.repository.ts`; `src/features/orders/testing/mock-api.ts`; `src/features/orders/testing/mock-api.test.ts` | implemented and covered | 2026-06-19T22:19:48Z | Integration Lead / CEO Agent |
| E-005 | static | desktop order detail uses inline transition panel instead of desktop status Dialog | `src/features/orders/screens/order-detail-screen.tsx`; `tests/e2e/order-desktop-ui-audit.spec.ts` | implemented; no `data-order-desktop-transition-dialog` remains | 2026-06-19T22:19:48Z | Integration Lead / CEO Agent |
| E-006 | test | targeted order workflow/model and mock API tests pass | `npx vitest run src/features/orders/model/order-workflow.test.ts src/features/orders/testing/mock-api.test.ts` | passed; 2 files / 35 tests | 2026-06-19T22:19:48Z | Integration Lead / CEO Agent |
| E-007 | validation | typecheck passes | `npm run typecheck` | passed | 2026-06-19T22:19:48Z | Integration Lead / CEO Agent |
| E-008 | validation | lint passes after formatting | `npm run lint` | passed | 2026-06-19T22:20:10Z | Integration Lead / CEO Agent |
| E-009 | validation | full Vitest suite passes | `npm run test` | passed; 38 files / 228 tests | 2026-06-19T22:21:25Z | Integration Lead / CEO Agent |
| E-010 | e2e | desktop order detail transition flow uses inline panel and no status-flow Dialog | targeted non-sandbox Playwright: `REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx playwright test tests/e2e/order-desktop-ui-audit.spec.ts` with matching webServer env | passed; 3 desktop viewport tests | 2026-06-19T22:27:00Z | Integration Lead / CEO Agent |
| E-011 | e2e | broader desktop E2E suite is mostly green but has unrelated platform timeout | non-sandbox `npm run test:e2e:desktop` after clearing stale servers | 8 passed; 1 `/platform` dialog overflow test timed out at `networkidle` for 1440px | 2026-06-19T22:26:00Z | Integration Lead / CEO Agent |
| E-012 | validation | production build passes outside sandbox | non-sandbox `npm run build` | passed; 15 static pages generated | 2026-06-19T22:28:00Z | Integration Lead / CEO Agent |
| E-013 | validation | agent rule checks pass | `npm run agents:check` | passed | 2026-06-19T22:28:00Z | Integration Lead / CEO Agent |
| E-014 | environment | first E2E failure was caused by stale local Next server chunks, not target assertion failure | local API probe returned `Failed to load chunk server/chunks/src_lib_mock_api...`; stale node servers were stopped and targeted E2E rerun passed | classified | 2026-06-19T22:25:30Z | Integration Lead / CEO Agent |
| E-015 | preview | local E2E-bypass preview proved old Dialog removal and option count | Local E2E-bypass preview on port 3020 plus Playwright check | `/orders/ord_1` loaded; clicking `流转` showed `[data-order-desktop-transition-panel="true"]`; old `状态流转` Dialog count was 0; transition option buttons count was 15; document width was `1280/1280` | 2026-06-20T00:17:58+02:00 | Integration Lead / CEO Agent |
| E-016 | api | API transition writes timeline event for arbitrary enabled status | Local API check against port 3020 | `ord_2` transitioned from `rework` to `parts_arrived`; detail returned `status=parts_arrived` and a `status_changed` event `{ from: "rework", to: "parts_arrived" }` | 2026-06-20T00:17:58+02:00 | Integration Lead / CEO Agent |
