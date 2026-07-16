# Evidence Index — TASK-20260716-003

| ID | Claim | Evidence | Status |
|---|---|---|---|
| E-001 | Owner approved implementation, push and apply after completion | current thread instruction | approved 2026-07-16 |
| E-002 | isolated baseline | branch/worktree at `6717932e316cbe5054709646ca7ea1087f517a49` | verified |
| E-003 | customer v2 total/outstanding formulas drift | `20260616141938_customer_list_v2_fast_loading.sql`; customer repository/workbench | verified static |
| E-004 | terminal edit complaint did not match the baseline generic main behavior | order screen/repository/router/permissions | baseline observation only; superseded by explicit capability/RPC contract and not used as release proof |
| E-005 | payment RPC supplies atomic reference | `20260710145642_order_payment_ledger_atomic_rpc.sql` | verified static |
| E-006 | broad production DB release has an open parity/recovery conflict | `.ai-company/memory/OPEN_CONFLICTS.md` | bounded task slice mitigated by E-022..E-025; environment-wide conflict remains open |
| E-007 | official Supabase workflow requires migration files, list, dry-run and serialized push | Supabase official database migration/CLI docs reviewed 2026-07-16 | verified current docs |
| E-008 | local and linked migration versions match through `20260714004500` | linked `supabase migration list` in isolated worktree | verified |
| E-009 | cancelled balances pollute current v2 while legacy completed balances cannot be inferred as paid/unpaid history | production aggregate-only SQL: 439 cancelled positive-balance; 5,025 completed positive-balance; ledger 5 | verified, no PII |
| E-010 | CRM simple order FKs already exist and current references are clean; same-store composite constraint is absent | production metadata and anomaly-only SQL | verified |
| E-011 | historical migration chain is not clean-replayable at inventory compatibility migration | static migration audit and `OPEN_CONFLICTS.md` | bounded task slice mitigated by current-schema restore/replay E-014/E-022; historical reset/PITR risk remains open |
| E-012 | mock E2E bypasses real role checks | `e2e-auth-bypass.ts`; router permission bypass | verified limitation |
| E-013 | concurrent main cancellation fix was preserved and extended | rebased on `origin/main@184672fe`; payment model/repository tests cover legacy, custom cancelled, voided, deleted and custom done | verified |
| E-014 | exact production-order migration chain is executable | fresh `public.ecr.aws/supabase/postgres:17.6.1.121` clone restored from current schema; `20260716175044 → 20260716175056 → 20260716221119 → 20260716221139 → 20260716221159 → 20260716221448` all applied with `ON_ERROR_STOP=1` | passed 2026-07-16; four task migrations use the exact applied versions |
| E-015 | finance/lifecycle/tenant/atomicity contract | `supabase/tests/customer_finance_order_lifecycle.sql` | pgTAP 102/102 passed |
| E-016 | repository and application regression | `npm run test` | 144 files / 1021 tests passed |
| E-017 | governance/static/compile/build gates | `npm run agents:check`; `npm run lint`; `npm run typecheck`; `npm run build` | all passed |
| E-018 | responsive route/detail regression | `REPAIRDESK_E2E_ORDER_AUDIT=1 ... visual-overflow.spec.ts` | Playwright 7/7 passed at 390/430/768/1024/1280/1440 plus detail dialog |
| E-019 | customer UI visual result | `screenshots/TASK-20260716-003/customer-finance-status-{desktop,mobile-390x844}.png` | inspected, redacted mock data |
| E-020 | terminal correction UI visual result | `screenshots/TASK-20260716-003/terminal-correction-{desktop,mobile-390x844}.png` | inspected, accessible validation/pending state |
| E-021 | scoped diff integrity | `git diff --check origin/main...HEAD`; conflict-marker scan; clean rebase | passed |
| E-022 | recovery alternative when backup API is unavailable | `/private/tmp/repairdesk-current-schema-20260716.sql` restored into fresh PG17 clone and full release migrations replayed | passed; no production PII stored in repo |
| E-023 | serialized production migration application | linked project `xluzcoduqsdvjoouqhkc` / `ChinaTech_date`; exact versions `20260716221119`, `20260716221139`, `20260716221159`, `20260716221448` appear consecutively after the two preserved cancellation migrations | applied 2026-07-16; no unrelated migration interleaved |
| E-024 | production metadata, ACL and data sanity | five lifecycle columns; six required contracts (`repairdesk_customer_list_page_v3` plus apply/correct/reopen/void/custody functions); two protection triggers; five named constraints validated; five covering indexes; terminal RLS enabled; all five terminal command functions executable by `service_role` and not `anon`/`authenticated`; terminal/deleted/cross-store anomaly counts zero | passed after final index migration |
| E-025 | post-DDL advisor delta | security `42 = 29 INFO + 13 WARN`, with one task-added deny-by-default `order_terminal_operations` no-policy INFO; performance `164 = 148 INFO + 16 WARN`, with no new WARN/ERROR and new indexes reported only as expected unused INFO immediately after creation | passed with documented intentional INFO |

Earlier NO-GO snapshots in `CHECKPOINTS.md` are preserved as history and are superseded by E-013 through E-025. Supabase CLI `db push --dry-run` could not authenticate because this environment has no access token; no secret was requested or exposed. The release gate instead used exact local/remote migration-name parity, a fresh current-schema PG17 replay with `ON_ERROR_STOP=1`, 102 pgTAP assertions, immediately serialized production apply, migration-list re-read and metadata/ACL/data/advisor postchecks. The remaining evidence to append is the pushed commit and deployment verification. Do not store secrets or customer PII.

Residual non-blocking evidence: the responsive suite logs the existing `/orders/new` mock operator-name hydration mismatch and parallel page `ECONNRESET` noise; all seven assertions pass, and no task page overflow or dialog regression is present.
- `2026-07-16T22:05:48Z` `c2ed2904ca` — EVIDENCE.md E-013..E-022；screenshots/TASK-20260716-003；candidate d6f67569 plus final evidence amendment

## Documentation impact matrix

| Reader | Authority updated | Verification | Residual |
|---|---|---|---|
| Shop users / support | `docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md` | customer labels, dual states, finance redaction and excluded lifecycle rows match UI/tests | none in task scope |
| Developers / QA | `docs/ORDER_LIFECYCLE_CORRECTION_STANDARD.md`; `docs/ORDERS_SPEC.md` is pointer only | active changed-fields-only and audited terminal contract matches router/repository/RPC tests | historical `ORDERS_SPEC` cannot override the active standard |
| Data / security / release | four versioned Supabase migrations, this evidence index and department memory | clone replay, pgTAP, production metadata/ACL/advisor checks | full historical reset/PITR certification remains separate existing debt |
