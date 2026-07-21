# Evidence Index — TASK-20260721-002-order-deposit-correction-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-21T12:17:46Z | Hexiang Huang |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-21T12:17:56Z` `76f09eb408` — Targeted Vitest: 5 files, 146 tests passed; npm typecheck passed; npm lint passed; production build passed; Supabase dry-run would push only 20260721133000_order_initial_deposit_correction.sql.
- `2026-07-21T12:45:58Z` `6d31fd1887` — Commit history through 676fc6d8 on origin/codex/order-deposit-correction; 146/146 focused tests; typecheck/lint/build pass; full suite 2163/2170 with 7 unrelated existing UI failures; Supabase migration list parity; Vercel READY; production login page screenshot at artifacts/deposit-production-login.png.
- `2026-07-21T12:47:24Z` `c4bf6678ac` — origin/codex/order-deposit-correction contains source and closeout commits; production Vercel dpl_BiJXkZY5hpCFeJRbcFYQzn4cEwXj READY; migration 20260721133000 present remotely; AI Company validation 13/13 checks with zero warnings/errors.
