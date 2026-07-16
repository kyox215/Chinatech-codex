# Evidence — TASK-20260716-003-cancelled-order-outstanding-fix

| ID    | Claim                                                                                            | Evidence                                                                   | Status              |
| ----- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------- |
| E-001 | Owner approved execute/push/apply                                                                | current Owner instruction                                                  | approved            |
| E-002 | clean latest-main baseline                                                                       | `origin/main@6717932e316cbe5054709646ca7ea1087f517a49`                     | verified            |
| E-003 | shared root is unrelated dirty state                                                             | root `git status --short`                                                  | verified; untouched |
| E-004 | older exact-task worktree contains over-scoped untested lifecycle draft                          | `/private/tmp/repairdesk-customer-finance-correction-20260716` status/diff | observed; excluded  |
| E-005 | official Supabase guidance requires migrations, dry-run, invoker/search_path and explicit grants | Supabase official CLI/functions/API security docs                          | verified 2026-07-16 |
| E-006 | exact local €70 + €70 cancellation contract                                                   | customer helper, repository, Mock and browser fixture tests                | history 2; valid 1; quoted/outstanding €70 |
| E-007 | desktop and mobile customer UI keep history but exclude cancelled finance                       | `evidence/customer-*.png`; in-app browser DOM assertions                   | verified |
| E-008 | cancelled order detail/task/mobile rails and actions are non-collectible                         | browser DOM: `取消归档`; no `收款完成`; `不可收款`                         | verified |
| E-009 | final repository quality gates                                                                    | `agents:check`, lint, typecheck, 142 files / 972 tests, Turbopack build     | passed |
| E-010 | release dry-run contains no unrelated migrations                                                 | `supabase db push --linked --dry-run`                                      | exactly 2 migrations |
| E-011 | production expand applied                                                                          | migration history `20260716175044`, `20260716175056`                       | applied |
| E-012 | production function security                                                                        | catalog identity args, invoker, empty search_path, service-role-only ACL   | verified for v2 x2, v3 and payment RPC |
| E-013 | production aggregate parity                                                                          | 3,675 expected/function customers; count and finance comparison            | 0 mismatch; max deltas €0.00 |
| E-014 | cancelled payment probe cannot write                                                                 | guarded RPC probe plus ledger post-check                                   | `order_cancelled`; ledger 5; probe writes 0 |
| E-015 | both compatibility wrappers match v3                                                                | seven- and eight-argument v2 calls on a 30-row page                        | both JSON-equal to v3 |
| E-016 | production performance observation                                                                  | `EXPLAIN (ANALYZE, BUFFERS)` busiest-store 30-row page                     | 1,926 ms; 0 disk reads; monitor, no SLA regression gate |
| E-017 | local full Supabase replay limitation                                                               | pre-existing `20260611102805` expects missing historical column locally    | unrelated baseline blocker; production compile/apply passed |
| E-018 | final remote main identity                                                                           | `git ls-remote origin refs/heads/main`                                     | `e5302f6fdc343a2b4e6416f4c16851cdf083b647` |
| E-019 | production deployment and smoke                                                                      | Vercel `dpl_6ki2Xnggs3V3ZS4jhsWxq4q57muG`; production HTTP and runtime logs | READY; login redirect 200; error/fatal logs 0 |

No production customer PII or secrets may be stored in this task record.
