# Evidence Index

| ID | Type | Evidence | Result |
|---|---|---|---|
| E-001 | Owner approval | Exact name and UUID approval in current task | deletion intent approved |
| E-002 | Production read-only | `stores` + `store_lifecycles` exact UUID query | target active rev 1; formal store independently identified |
| E-003 | Production read-only | all public `store_id` tables plus three UUID Storage prefixes | zero business/Storage data; 91 default/control rows |
| E-004 | Production read-only | linked migration list | lifecycle P0-P5 + v2 fence + AI hotfix applied |
| E-005 | Code/runbook | writer fence, purge worker and runbook | lease-bound purge bypass missing; production purge NO-GO |
| E-006 | FLOW/UX agent | `/root/flow_ux_delete`, read-only | request/cancel/final-confirm workflow and responsive states delivered |
| E-007 | DATA/API agent | `/root/data_api_purge`, read-only | production state, schema/API gaps and release sequence delivered |
| E-008 | SEC/QA agent | `/root/sec_qa_purge`, read-only | FAIL/NO-GO until fence, approval, recovery authorization and proof gates are fixed |
| E-009 | Forward migration | `supabase/migrations/20260720211230_store_self_service_purge_safety.sql` | contract v3 request ledger, 24h minimum, two AAL2 challenges, cancellation and leased worker bypass implemented locally |
| E-010 | API/UI | repository/router/schemas plus `closed-stores-screen.tsx` | owner request/status/cancel/final-confirm flow implemented behind flags and contract v3 |
| E-011 | Static verification | `npm run typecheck`; `npm run lint`; `git diff --check` | passed 2026-07-20 |
| E-012 | Tests | full `npm run test`; targeted 24 tests across migration, schemas, worker, lifecycle and settings | passed 2026-07-20; jsdom emitted an existing navigation-not-implemented notice |
| E-013 | Build | Next.js 16.2.6 production build with Node 24 | compiled, typechecked and generated `.next/BUILD_ID` at 2026-07-20T23:40:15+0200 |
| E-014 | Linked migration preview | `supabase db push --dry-run` | would apply only `20260720211230_store_self_service_purge_safety.sql`; no apply occurred |
| E-015 | Visual evidence attempt | in-app Browser skill bootstrap | browser JavaScript control tool unavailable; no honest final screenshot could be captured |
| E-016 | Latest-main integration | rebased `codex/store-self-service-purge` onto `origin/main` `a9856421` | pre-checkpoint candidate `abbf3c16`; branch was clean and ahead 1 before recording final memory evidence |
| E-017 | Post-rebase static verification | `npm run lint`; `npm run typecheck`; `git diff --check origin/main...HEAD` | passed 2026-07-21 |
| E-018 | Post-rebase targeted tests | five purge/lifecycle/settings test files | 5 files and 24 tests passed 2026-07-21 |
| E-019 | Post-rebase full regression | `npm run test` | 331 files and 2163 tests passed; existing jsdom navigation notice remained non-fatal |
| E-020 | Post-rebase build | `npm run build` | sandbox run failed only on blocked Google Fonts fetch; approved network rerun compiled, typechecked and generated all routes successfully |
| E-021 | Independent release review | DATA/SEC and QA read-only reviews | feature-branch push PASS; main merge CONDITIONAL; production migration/deploy/delete FAIL/NO-GO |
| E-022 | GitHub feature branch | `git push -u origin codex/store-self-service-purge`; local/remote ref comparison | non-force push succeeded at `943d77c0`; local and remote ahead/behind `0/0` |

No production mutation, migration apply, deployment, flag change, close, archive, export, purge or delete has occurred in this task yet.
- `2026-07-20T23:16:39Z` `3be09e9df3` — E-016 to E-021
- `2026-07-20T23:17:55Z` `582874d294` — remote branch origin/codex/store-self-service-purge at 943d77c0; local/remote ahead-behind 0/0
