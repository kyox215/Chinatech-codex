# Evidence Index — TASK-20260710-009-security-reliability-hardening-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-10T13:59:03Z | 鹤祥 |
| E-002 | git | implementation baseline is current | `git fetch --prune`; `git rev-parse HEAD origin/main` | both `705c7511`; dirty user assets recorded and preserved | 2026-07-10 | Integration Lead |
| E-003 | goal | explicit persistent objective created | Codex goal state | active hardening/push/database objective | 2026-07-10 | Integration Lead |
| E-004 | official | Supabase user metadata cannot authorize | current Supabase Users docs | `user_metadata` is editable by users | 2026-07-10 | Integration Lead |
| E-005 | official | migration/function release rules | Supabase migrations/functions/changelog/production docs | migration files only; restrict function execute; relevant 2026 changes reviewed | 2026-07-10 | Integration Lead |
| E-006 | tooling | linked migration tooling version | `supabase --version` | CLI `2.101.0` | 2026-07-10 | Integration Lead |
| E-007 | code | Wave 1 defects remain present at baseline | permissions/router, auth-context, schemas, repositories, scripts, E2E | current-source findings confirmed | 2026-07-10 | Integration Lead |
| E-008 | plan | R4 execution and release contract exists | `EXECUTION_PLAN.md`; `TASK.md` | bounded waves, approval points, tests and no-go gates recorded | 2026-07-10 | Integration Lead |
| E-009 | code/test | six customer read routes enforce the matrix before repository calls | customer authorization and router tests | allowed roles pass; technician/viewer receive 403 and service mocks remain uncalled | 2026-07-10 | Integration Lead |
| E-010 | code/test | mutable metadata cannot establish verified email | `auth-context.ts`; tests | forged `user_metadata` and generic `confirmed_at` rejected | 2026-07-10 | Integration Lead |
| E-011 | code/test | runtime enum/status/payment schemas reject invalid input | schemas and tests | fixed enums enforced; custom status retained; 0.29/0.57 accepted and 25.555 rejected | 2026-07-10 | Integration Lead |
| E-012 | code/test | 1000-row truncation bridge is implemented | order/inventory/customer repositories and tests | deterministic batches; inventory/customer 1001-row coverage; order bridge preserves workflow ordering | 2026-07-10 | Integration Lead |
| E-013 | code/test | admin scripts fail closed | admin safety helper, tests and three scripts | dry-run/local/exact project-store-confirmation/backup gates | 2026-07-10 | Integration Lead |
| E-014 | db-local | payment migration is atomic and least privilege on linked-schema clone | payment migration; pgTAP | schema clone reset succeeds; pgTAP 19/19 PASS; prior 10-way same-key concurrency produced one payment | 2026-07-10 | Integration Lead |
| E-015 | db-preflight | new remote pending set is exact | migration list; linked dry-run | remote has 48 prior versions; only `20260710145642` is pending | 2026-07-10 | Integration Lead |
| E-016 | db-no-go | linked security posture blocks normal apply | Supabase advisors and aggregate catalog query | 17 old public tables have RLS disabled and direct anon/authenticated access; active legacy tables exist | 2026-07-10 | Integration Lead |
| E-017 | recovery-no-go | historical chain is not reproducible | full isolated local reset | fails before new migration at `20260611102805` on missing `inventory_items.product_channel` | 2026-07-10 | Integration Lead |
| E-018 | db-readonly | sensitive/invariant counts were collected without row data | linked aggregate query | no negative/paid mismatch; one plaintext unlock pattern; payment RPC/table absent; no actor-email attempts | 2026-07-10 | Integration Lead |
| E-019 | quality | code quality gates before release | `npm run typecheck`; `npm run test`; `npm run build` | typecheck pass; full test 106 files/710 tests pass; production build pass after sandbox port escalation | 2026-07-10 | Integration Lead |
| E-020 | e2e | strict E2E is no longer skipped or origin-blocked | `npm run test:e2e:desktop` | 11/11 pass after sandbox port escalation and stale 3111 listener cleared | 2026-07-10 | Integration Lead |
| E-021 | review | independent ARCH, DATA/SEC and QA/OPS reviews completed | real read-only sub-agent reports | payment slice PASS; whole DB/release NO-GO; DB-first sequence and exact manifest required | 2026-07-10 | Integration Lead |
| E-022 | owner constraint | existing UI/layout must not change | current Owner message | payment TSX is behavior-only; TASK-010 customer lookup UI must be excluded | 2026-07-10 | Owner / Integration Lead |
| E-023 | release caveat | full lint gate did not complete in this environment | `npm run lint` | `eslint .` produced no errors but did not exit after more than 6 minutes; interrupted and recorded as residual tooling risk | 2026-07-10 | Integration Lead |
| E-024 | owner exception | payment-only bounded database exception approved | current Owner instruction: `推送main 以及应用数据库` | accepted for the exact reviewed additive migration after dry-run showed a single pending file | 2026-07-10 | Owner / Integration Lead |
| E-025 | db-apply | payment ledger/RPC migration applied to linked database | `supabase db push --linked --yes` | applied only `20260710145642_order_payment_ledger_atomic_rpc.sql` | 2026-07-10 | Integration Lead |
| E-026 | db-postapply | linked database post-apply checks passed | `supabase migration list --linked`; `supabase db query --linked ...`; final dry-run | remote history includes `20260710145642`; ledger table/RPC exist; anon/authenticated direct privileges false; service role insert/execute true; final dry-run up to date | 2026-07-10 | Integration Lead |
| E-027 | scoped-lint | release code files do not have ESLint errors | `npx eslint <TASK-009 release code files>` | 0 errors; workflow and package JSON were ignored by ESLint config with warnings only | 2026-07-10 | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-10T14:37:41Z` `635b4c70dc` — TASK.md; EXECUTION_PLAN.md; fetched HEAD=origin/main 705c7511; Supabase CLI 2.101.0; official Supabase and Playwright docs
