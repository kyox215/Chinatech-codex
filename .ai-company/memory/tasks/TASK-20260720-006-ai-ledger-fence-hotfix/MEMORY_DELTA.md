# Memory Delta — TASK-20260720-006-ai-ledger-fence-hotfix

## Candidate project facts

- **Fact:** `ai_assistant_usage_buckets` is a mixed-scope table: store-day rows require a store, while global-day/month rows intentionally use null `store_id`. Source: migration `20260718174042` and incident evidence. Status: verified candidate for consolidation. Owner/scope: DATA + AI cost governance. Review trigger: any generic tenant-fence generator change.
- **Fact:** lifecycle migration `20260720013000` attached a generic null-rejecting writer fence to that mixed-scope table and caused provider budget reservation to fail before OpenAI dispatch. Source: production aggregate logs/audit and migration SQL. Status: verified incident fact. Owner/scope: DATA/INT. Review trigger: post-production repair verification.
- **Fact:** forward migration `20260720065246` is production-applied and verified. Source: E-005 through E-022. Status: live single-store text recovery; one non-PII canary settled at 130 micro-USD and 15 minutes / 16 polls stayed within all zero thresholds. Owner/scope: Integration Lead + DATA/SEC/QA. Review trigger: any AI bucket, lifecycle, quota or provider-schema change.
- **Fact:** the applied migration is recoverable on `origin/codex/ai-ledger-fence-hotfix-20260720` but is not yet in `main`. Source: E-018 and final Git state. Status: open release-governance follow-up. Owner/scope: Integration Lead. Review trigger: before the next database release.

## Candidate department updates

- DATA: nullable tenant keys require table/row-shape analysis before dynamic trigger attachment; never infer tenant-required solely from column name.
- SEC: cost-bearing reservations and tenant close transitions must share the same advisory lock; unresolved reservations fail closed and block close.
- QA: mixed-scope trigger fixes require real PostgreSQL RPC/transaction/concurrency tests; static SQL assertions are supplemental only.
- RELEASE: database hotfix was DB-only; do not bundle AI flags, Vision, policy, secrets or unrelated Vercel changes. Production history must not move ahead of `main` into a later release window; integrate the hotfix branch first.

## Candidate decisions / ADRs

- **Decision:** specialized trigger function is preferred over weakening the generic lifecycle function. It preserves the generic rule for every other store-scoped table and makes the global exception exact.
- **Decision:** global bucket identity is immutable and global delete remains forbidden; legitimate RPCs may change only limits, counters and `updated_at`.
- **Decision:** active→non-active lifecycle transition is rejected while any request is `reserved`; settlement/release/maintenance occurs while the store remains active, then close is retried.

## Candidate lessons and capability evidence

- Real production correlation across HTTP, Postgres and audit distinguished a database fence outage from an OpenAI/model failure and proved zero failed-attempt cost.
- The PG17 disposable harness and two-session lock tests provide C1 evidence for bounded database-hotfix validation, not authority to apply production migrations autonomously.
- Residual follow-up: guard or explicitly design `stores.status active→suspended` before any suspension writer is enabled.
- A successful single hotfix/canary is capability evidence only; it does not raise production-write permission or autonomy.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
