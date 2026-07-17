# Evidence Index — TASK-20260717-004-order-diagnosis-quote-implementation

| Evidence ID | Type    | Claim supported                   | Source/path/command | Result   | Collected at         | Collector       |
| ----------- | ------- | --------------------------------- | ------------------- | -------- | -------------------- | --------------- |
| E-001       | request | task exists and title is recorded | `TASK.md`           | observed | 2026-07-17T18:30:05Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.

- `2026-07-17T18:31:45Z` `9498b38574` — origin/main@9f17d0dc; isolated worktree /private/tmp/repairdesk-order-quote.3zuOYe
- `2026-07-17T18:31:45Z` `8256438bb3` — Owner explicitly approved scoped Supabase migration apply and main push on 2026-07-17
- `2026-07-17T18:31:45Z` `8793f8824b` — Official Supabase 2026 changelog and database-function privilege/search_path guidance reviewed
- `2026-07-17T19:12:38Z` `qa-local-001` — `npm run lint`, `npm run typecheck`, constrained full Vitest and Webpack production build passed before rebase; default Turbopack was blocked only by the isolated-worktree `node_modules` symlink.
- `2026-07-17T19:18:00Z` `ui-visual-001` — Browser validation covered unknown intake, desktop diagnosis/quote and 390px mobile/task entry. A measured 658px mobile overflow was fixed to 366px with 12px side margins; screenshots are under `evidence/screenshots/`.
- `2026-07-17T19:24:00Z` `db-history-001` — Remote migrations `20260717182220` and `20260717185048` were absorbed from latest `origin/main`; the task migration was first renumbered to `20260717192233`, then finalized as `20260717213518` after the linked project received `20260717212000`; no `--include-all` is required.
- `2026-07-17T19:25:00Z` `db-dry-run-001` — The earlier linked dry-run listed only the task migration under its then-current `20260717192233` filename; the final locked dry-run must list only `20260717213518_order_diagnosis_quote_atomic.sql`.
- `2026-07-17T19:28:00Z` `db-schema-precheck-001` — Read-only production metadata confirmed required order/workflow/ledger columns and all six active stores' quote/send transitions; it also exposed missing `message_logs.channel` and UUID IDs, which the additive migration now handles.
- `2026-07-17T19:29:00Z` `db-replay-known-blocker-001` — A separate clean local Supabase replay stopped at historical migration `20260611102805` because `inventory_items.product_channel` was absent; the task migration was not reached and the temporary container was stopped without affecting the running PartsPro project.
- `2026-07-17T19:29:30Z` `qa-rebased-001` — After rebase onto `origin/main@3615c78b`: lint passed, typecheck passed, 206 Vitest files / 1436 tests passed, and Next.js Webpack production build passed.
- `2026-07-17T19:12:38Z` `2be9291c66` — lint passed; typecheck passed; vitest 205 files/1422 tests passed with maxWorkers=4; Next.js webpack production build passed; Turbopack default build only blocked by isolated-worktree node_modules symlink.
- `2026-07-17T19:32:38Z` `ab5fbd9bfa` — origin/main@3615c78b; earlier dry-run sole pending task migration, now finalized as 20260717213518; active stores 6/6 have quoted, waiting_approval and quoted-to-waiting_approval; screenshots in task evidence directory.
- `2026-07-17T19:38:35Z` `qa-final-rebase-002` — Final rebase/rename gate passed: ESLint, TypeScript, 6 targeted files / 108 tests, full 209 files / 1444 tests, `git diff --check`, and Next.js Webpack production build.
- `2026-07-17T19:41:00Z` `db-release-002` — Locked migration list and dry-run showed only `20260717213518_order_diagnosis_quote_atomic.sql`; `supabase db push --linked` applied it successfully.
- `2026-07-17T19:43:00Z` `db-postcheck-003` — Migration history aligned; both RPCs are security invoker with `search_path=""`, service-role-only execute, and anon/authenticated/PUBLIC denied. `message_logs.channel` is non-null text with WhatsApp default; the unique partial idempotency index exists; duplicate groups = 0.
- `2026-07-17T19:45:00Z` `db-advisor-004` — Supabase security/performance advisors reported no finding tied to either new RPC or the new idempotency index. Existing project advisories remain outside this migration; post-apply dry-run reports the remote database is up to date.
- `2026-07-17T19:47:35Z` `qa-latest-main-003` — Rebased onto `origin/main@f44e95f0` to preserve the concurrent historical-migration replay fix; lint, typecheck, 7 targeted files / 110 tests, full 210 files / 1446 tests and Next.js Webpack build passed.
- `2026-07-17T19:49:00Z` `git-main-005` — Non-force push advanced `origin/main` from `f44e95f0` to `6e511c56cf1a9bec88cac57a01aa87a62f235c5c`; `git ls-remote` returned the exact same SHA.
- `2026-07-17T19:51:17Z` `deploy-production-006` — Vercel production deployment `dpl_3sZFAFoHzvHuaS2xkVY33W7jZbjj` is READY and metadata matches `main@6e511c56`; deployment URL and `www.chinatech.in/login` returned 200, manifest returned 200, and the exact deployment plus project had zero error/fatal clusters in the 15-minute observation.
- `2026-07-17T19:57:33Z` `closeout-007` — Acceptance is complete; Agent rules, task/project/department/capability memory, handoff, CEO report and final checkpoint are synchronized. Capability remains C1 candidate with no permission/autonomy upgrade.
