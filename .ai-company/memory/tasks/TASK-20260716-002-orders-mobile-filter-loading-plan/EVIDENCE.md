# Evidence Index — TASK-20260716-002-orders-mobile-filter-loading-plan

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-16T07:45:13Z | 鹤祥 |
| E-002 | code | mobile header removes funnel and queue chip while keeping seven queue choices and desktop filter | `src/features/orders/components/order-list-mobile-header.tsx`; `src/features/orders/screens/order-list-screen.tsx` | independent UX review PASS | 2026-07-16T09:15:57Z | Integration Lead + UX reviewer |
| E-003 | interaction | queue changes expose pending, latest-intent, failure rollback, retry and offline states | `tests/e2e/orders-mobile-queue-loading.spec.ts`; `npm run test:e2e:interactions:mock` | 10 passed, 1 conditional skip | 2026-07-16T09:15:57Z | Integration Lead |
| E-004 | performance | list path scopes narrow index rows before one batched detail read capped at 50 | `src/features/orders/server/order.repository.ts`; `src/server/repairdesk-shared.ts`; repository/schema tests | independent performance review PASS | 2026-07-16T09:15:57Z | Integration Lead + performance reviewer |
| E-005 | regression | source and production build gates | `npm run agents:check`; `npm run lint`; `npm run typecheck`; `npm run test -- --testTimeout=15000`; `npm run build` | PASS; 138 files / 947 tests | 2026-07-16T09:15:57Z | Integration Lead |
| E-006 | realtime | active Orders workspace does not duplicate list-page preload | `tests/e2e/realtime-preload-coordination.spec.ts` | 7/7 passed | 2026-07-16T09:15:57Z | Integration Lead |
| E-007 | database | production schema and data scale support no-migration path | Supabase project `xluzcoduqsdvjoouqhkc`; migrations/index/count/EXPLAIN read-only checks | healthy; 54 migrations; 6,286 total / 175 active / 2 stores; existing scoped indexes | 2026-07-16T09:15:57Z | Integration Lead |
| E-008 | security | tenant, technician and response-projection boundaries remain closed | final read-only DATA/SEC diff review | PASS; P0 0 / P1 0; raw workflow/options errors removed | 2026-07-16T09:15:57Z | security reviewer |
| E-009 | visual | final 320/390 mobile and 1440 desktop states | `/private/tmp/repairdesk-orders-mobile-queue-artifacts-20260716/` | visually inspected; no overflow; desktop filter retained | 2026-07-16T09:15:57Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
