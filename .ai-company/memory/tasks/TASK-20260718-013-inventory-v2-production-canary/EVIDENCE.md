# Evidence Index — TASK-20260718-013-inventory-v2-production-canary

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-18T19:43:02Z | 鹤祥 |
| E-002 | backup | a current recovery source exists | Supabase physical backup listing | latest completed physical backup `2026-07-18T06:49:11Z`; PITR disabled | 2026-07-18 | Integration Lead |
| E-003 | restore | production structure is restorable without PII output | restricted schema dump restored to PostgreSQL 17 | `public/auth/storage` 118 tables; key inventory/customer/store/staff/audit objects present | 2026-07-18 | Integration Lead |
| E-004 | restore | logical data backup restores faithfully | `count-copy-rows.mjs`, `RECOVERY_ROW_COUNT_FINGERPRINT.sql` | 116 dumped tables and 40,457 rows match exactly; only two expected empty managed migration tables exist additionally | 2026-07-18 | Integration Lead |
| E-005 | migration | V2 migrations fit current production types and data | restored production data plus migrations `20260718175622`, `20260718181148`, `20260718195257` | first rehearsal caught UUID defects; corrected migrations all execute successfully | 2026-07-18 | Integration Lead |
| E-006 | security | V2 database access is fail-closed for browser roles | restored DB privilege/RLS matrix | seven V2 tables RLS on; `anon/authenticated` RPC execute false; `service_role` true; least table grants only | 2026-07-18 | Integration Lead |
| E-007 | transaction | atomic commands and rollback behavior work on restored data | `RECOVERY_CANARY_ROLLBACK.sql` | intake, duplicate guard, replay, sale and conflict guard pass; residual V1/V2 rows all zero | 2026-07-18 | Integration Lead |
| E-008 | QA | application remains release-buildable after latest-main rebase | `npm run agents:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` | pass; 296 test files / 1,858 tests; production build pass | 2026-07-18 | Integration Lead |
| E-009 | migration | linked production scope has an unrelated order blocker | final `supabase db push --linked --dry-run` | pending order is AI cost governance `20260718174042`, then three V2 migrations; exact V2-only apply stopped, no `--include-all` | 2026-07-18 | Integration Lead |
| E-010 | git | reviewed migration fix is isolated | rebased commit `a20366d0` | three migration files only | 2026-07-18T20:12:08Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
