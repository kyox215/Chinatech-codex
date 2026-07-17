# Evidence Index — TASK-20260717-163954-task

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-17T16:39:54Z | CEO-Orchestrator |
| E-002 | source | client create has a 30-second timeout and aborts only the browser fetch | `src/lib/repairdesk/api.ts:681` | verified | 2026-07-17 | Integration Lead |
| E-003 | source | desktop/mobile share one mutation; pending disables the only submit action and error is toast-only | `src/features/orders/screens/new-order-screen.tsx:327`; `src/features/orders/forms/new-order-submit-bar.tsx:81` | verified | 2026-07-17 | Integration Lead |
| E-004 | source | online create sequentially resolves status/settings/customer/device/number/order/event without one transaction | `src/features/orders/server/order.repository.ts:3700` | verified | 2026-07-17 | API/Data reviewer |
| E-005 | source | order result is followed by an awaited, independently failing audit insert | `src/server/api/repairdesk-router.ts:2072`; `src/server/audit.ts:56` | verified | 2026-07-17 | API/Data reviewer |
| E-006 | source | online create schema and request have no idempotency/operation key | `src/server/api/repairdesk-schemas.ts:477`; `src/lib/repairdesk/api.ts:1044` | verified | 2026-07-17 | Integration Lead |
| E-007 | source | PWA service worker does not intercept POST requests | `public/sw.js:25` | verified; cache is not the primary cause | 2026-07-17 | Integration Lead |
| E-008 | runtime | current production deployment matches main SHA and recent create requests are HTTP 200 with no 4xx/error log | Vercel read-only runtime/deployment inspection | verified for observed window; phase duration absent | 2026-07-17 | Integration Lead |
| E-009 | data | recent production aggregate did not reveal duplicate create, missing create event, or missing audit anomalies | Supabase read-only aggregate review by API/Data sub-agent | scoped observation only | 2026-07-17 | API/Data reviewer |
| E-010 | test | focused create-form/offline/repository suite | 5 files / 76 tests | PASS | 2026-07-17 | Integration Lead |
| E-011 | e2e | 390x844 new-order touch/overflow check | `tests/e2e/new-order-mobile-dropdown-scroll.spec.ts` | 1/1 PASS | 2026-07-17 | Integration Lead |
| E-012 | visual | current controlled Mock desktop/mobile create pages | `screenshots/TASK-20260717-order-create-hang-audit/` | captured and inspected | 2026-07-17 | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-17T16:49:28Z` `b0b48f8fdf` — E-002..E-012：源代码边界；Vercel只读运行时；Supabase只读聚合；5文件76测试通过；390x844 E2E 1/1通过；两张受控Mock截图。
