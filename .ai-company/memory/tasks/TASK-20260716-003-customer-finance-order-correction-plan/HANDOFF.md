# Handoff / Resume — TASK-20260716-003

- **Status:** database-applied; application commit/push/deployment verification pending.
- **Worktree:** `/private/tmp/repairdesk-customer-finance-correction-20260716`.
- **Branch:** `codex/customer-finance-correction-20260716` at `d6f67569` plus the final evidence/documentation amendment, rebased on `origin/main@184672fe`.
- **First read:** `TASK.md`, `PLAN.md`, latest `CHECKPOINTS.md`, root `AGENTS.md`, `OPEN_CONFLICTS.md`.
- **Production DB:** linked project `xluzcoduqsdvjoouqhkc` has exact versions `20260716221119`, `20260716221139`, `20260716221159`, `20260716221448`; final metadata, ACL, data and advisor checks passed. The added RLS/no-policy INFO is intentional deny-by-default with service-role-only RPC execution.
- **Next action:** refetch `origin/main`, finish documentation/memory closeout, amend the scoped candidate, rerun final gates, push the exact SHA to `main`, then verify the corresponding Vercel production deployment.
- **Stop:** halt if `origin/main` moved, the final diff is not scoped, a final gate fails, or the deployed SHA/status cannot be proven.
- **Evidence:** full gates green; exact six-migration release-chain PG17 clone replay green (two preserved cancellation migrations plus four task migrations); pgTAP 102/102; Playwright responsive 7/7; four redacted screenshots under `screenshots/TASK-20260716-003/`.
- **Residual:** `/orders/new` mock hydration mismatch is an existing P2 log outside this change; no test failed. CLI dry-run and Management API backup listing are unavailable without an access token, so bounded release/recovery evidence is exact migration parity plus the current-schema dump and fresh PG17 restore/replay. Full historical reset/PITR certification remains an existing separate risk.
- **Agents used:** read-only data/security, frontend and QA reviews; scoped customer/order rebase writers with disjoint ownership and no git/release authority.
