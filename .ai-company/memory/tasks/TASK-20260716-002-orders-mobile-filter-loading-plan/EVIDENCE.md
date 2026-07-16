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
| E-010 | release | scoped implementation reached `main` | feature commit `4b954b9701cac607c5822e9e1bd39a74ccbc6c38`; `git push origin HEAD:main` | pushed without origin/main drift | 2026-07-16T09:18:00Z | Integration Lead |
| E-011 | deployment | exact feature commit is ready in production | Vercel deployment `dpl_5TVsEC9VibkwkiBWpyDDApPs7Kun`; aliases `chinatech.in` and `www.chinatech.in` | READY; production; alias error none | 2026-07-16T09:21:44Z | Integration Lead |
| E-012 | production smoke | real Orders route, build and runtime error checks | `https://chinatech.in/orders`; exact deployment URL; Vercel build/runtime logs | both routes return 200 after expected login redirect; build errors 0; error/fatal logs 0 over 30m | 2026-07-16T09:23:54Z | Integration Lead |
| E-013 | database | post-release production state remains healthy without task-specific schema mutation | Supabase project `xluzcoduqsdvjoouqhkc` read-only aggregate query | 6,286 total / 175 active / 6,111 archived / 2 stores; no migration or data write required | 2026-07-16T09:23:54Z | Integration Lead |
| E-014 | review team | independent UX, performance, QA/release and security/data findings were resolved | `orders_mobile_ux` (Erdos), `orders_loading_perf` (Nash), `orders_mobile_qa` (Schrodinger); read-only mode | final PASS; P0 0 / P1 0; no permission or autonomy upgrade | 2026-07-16T09:15:57Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-16T09:31:02Z` `382c5a1cd0` — feature commit 4b954b9701cac607c5822e9e1bd39a74ccbc6c38; deployment dpl_5TVsEC9VibkwkiBWpyDDApPs7Kun READY; production smoke HTTP 200 via expected login redirect; runtime error/fatal logs 0
- `2026-07-16T09:31:02Z` `8bc930b927` — git diff --check PASS; npm run agents:check PASS; ai_company validate core/markdown/secret checks PASS with 12 unchanged duplicate-agent-name governance errors outside this task diff
