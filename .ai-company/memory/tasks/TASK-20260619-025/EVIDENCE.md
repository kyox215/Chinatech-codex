# Evidence Index — TASK-20260619-025

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T21:59:46Z | Integration Lead / CEO Agent |
| E-002 | baseline | prior gate was green before code migration | `.ai-company/memory/tasks/TASK-20260619-024/ORDER_LIST_PRE_IMPLEMENTATION_BASELINE.md` | baseline accepted | 2026-06-19T22:00:00Z | Integration Lead / CEO Agent |
| E-003 | source | active wrapper import removed | `src/features/orders/screens/order-list-screen.tsx` | file owns order-list screen directly and imports feature components/model helpers, not `@/routes/orders.index` | 2026-06-19T22:06:00Z | Integration Lead / CEO Agent |
| E-004 | source | feature-owned extraction completed | `src/features/orders/components/order-list-filters.tsx`; `src/features/orders/components/order-list-desktop-row.tsx`; `src/features/orders/components/order-list-mobile-header.tsx`; `src/features/orders/components/order-list-states.tsx`; `src/features/orders/model/order-list-export.ts` | added feature-owned files | 2026-06-19T22:06:00Z | Integration Lead / CEO Agent |
| E-005 | source | order-list query keys normalized | `src/features/orders/api/query-keys.ts`; `src/features/orders/screens/order-list-screen.tsx` | `ordersKeys.page()` and `ordersKeys.options()` used by the active order-list screen | 2026-06-19T22:06:30Z | Integration Lead / CEO Agent |
| E-006 | test | CSV export helper behavior covered | `src/features/orders/model/order-list-export.test.ts` | new focused unit test file added | 2026-06-19T22:06:30Z | Integration Lead / CEO Agent |
| E-007 | scan | no active `@/routes` imports remain | `rg -n 'from "@/routes|@/routes' src` | no output; exit code 1 from no matches | 2026-06-19T22:06:44Z | Integration Lead / CEO Agent |
| E-008 | validation | lint gate passed | `npm run lint` | passed | 2026-06-19T22:06:53Z | Integration Lead / CEO Agent |
| E-009 | validation | typecheck gate passed | `npm run typecheck` | passed | 2026-06-19T22:06:50Z | Integration Lead / CEO Agent |
| E-010 | validation | test suite passed | `npm run test` | 38 files passed; 225 tests passed | 2026-06-19T22:06:50Z | Integration Lead / CEO Agent |
| E-011 | validation | sandbox build failed for known environment reason only | `npm run build` | failed with Turbopack `binding to a port` / `Operation not permitted` | 2026-06-19T22:07:00Z | Integration Lead / CEO Agent |
| E-012 | validation | production build passed after environment rerun | non-sandbox `npm run build` | passed; 15 static pages generated; `/orders` built | 2026-06-19T22:07:30Z | Integration Lead / CEO Agent |
| E-013 | constraint | protected actions were not performed | git/task log | no dependency/API/server/Supabase/production/stage/commit/push/deploy/payment/permission/customer-communication changes by this task | 2026-06-19T22:08:17Z | Integration Lead / CEO Agent |
| E-014 | documentation | active architecture/component docs synchronized after code migration | `docs/ARCHITECTURE.md`; `docs/COMPONENT_GENERATION_DECLARATION.md` | updated to zero active `@/routes` state and current component search path | 2026-06-19T22:10:00Z | Integration Lead / CEO Agent |
| E-015 | validation | agent config/rule checks still pass after memory/docs sync | `npm run agents:check` | passed | 2026-06-19T22:10:00Z | Integration Lead / CEO Agent |
| E-016 | validation | current dirty workspace still passes full local gates after unrelated source drift appeared | `npm run lint`; `npm run typecheck`; `npm run test`; `npm run agents:check`; non-sandbox `npm run build` | passed; tests now 38 files / 226 tests | 2026-06-19T22:15:00Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
