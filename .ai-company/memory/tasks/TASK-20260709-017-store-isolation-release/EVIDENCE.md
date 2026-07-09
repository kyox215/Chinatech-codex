# Evidence Index — TASK-20260709-017-store-isolation-release

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T13:56:38Z | CEO-Orchestrator |
| E-002 | git | implementation worktree is clean and based on latest `origin/main` | `/private/tmp/repairdesk-store-isolation-release`; `git status --short --branch`; `git log --oneline -5` | clean branch `task/store-isolation-migration-release` at `e072fcca` | 2026-07-09T13:55Z | CEO-Orchestrator |
| E-003 | git | original checkout is not safe for implementation | original checkout `git status --short --branch` | `main...origin/main [ahead 2, behind 22]` with many unrelated modified/untracked files | 2026-07-09T13:45Z | CEO-Orchestrator |
| E-004 | supabase | target project is `xluzcoduqsdvjoouqhkc` / `ChinaTech_date` | `supabase/config.toml`; Supabase MCP `_list_projects` | project active healthy, Postgres 17 | 2026-07-09T13:40Z | CEO-Orchestrator |
| E-005 | supabase | current migration history has historical drift and must not be broadly pushed | `supabase migration list` from clean worktree | many old local versions absent from remote history; current recent versions through `20260709234000` present remotely | 2026-07-09T13:54Z | CEO-Orchestrator |
| E-006 | docs | official Supabase migration guidance requires sync diagnosis before repair/push | `/tmp/supabase-db-migrations.md`; official `https://supabase.com/docs/guides/deployment/database-migrations.md` | docs say direct remote changes cause sync errors and `migration list/db pull/migration repair` are diagnostic paths | 2026-07-09T13:48Z | CEO-Orchestrator |
| E-007 | docs | recent Supabase change affects new table API exposure planning | `/tmp/supabase-changelog.md`; official `https://supabase.com/changelog.md` | 2026-04-28 breaking change: new tables are not automatically exposed to Data/GraphQL API | 2026-07-09T13:47Z | CEO-Orchestrator |
| E-008 | memory | prior migration reconcile intentionally avoided `include-all` and left follow-ups | `.ai-company/memory/tasks/TASK-20260709-014-migration-history-audit/*`; `.ai-company/memory/tasks/TASK-20260709-015-migration-history-reconcile/*` | `20260709125247` applied; offline draft and unsafe tag FK left for separate tasks | 2026-07-09T13:53Z | CEO-Orchestrator |
| E-009 | code | selected slice is runtime router permission hardening, no new DDL | `git diff -- src/server/api/repairdesk-router.ts src/server/api/repairdesk-router.test.ts`; `git diff --stat` | router gates added for customer writes, payment, transitions, workflow/settings/templates, member operations, and inventory writes | 2026-07-09T14:03Z | CEO-Orchestrator |
| E-010 | test | targeted router and permission tests pass | `npm run test -- src/server/api/repairdesk-router.test.ts src/server/permissions.test.ts` | 2 files / 31 tests passed | 2026-07-09T14:03Z | CEO-Orchestrator |
| E-011 | typecheck | TypeScript passes | `npm run typecheck` | passed | 2026-07-09T14:03Z | CEO-Orchestrator |
| E-012 | lint | ESLint/Prettier pass | `npm run lint` | passed after import formatting fix | 2026-07-09T14:03Z | CEO-Orchestrator |
| E-013 | test | full unit test suite passes | `npm run test` | 98 files / 648 tests passed | 2026-07-09T14:04Z | CEO-Orchestrator |
| E-014 | build | production build passes outside sandbox | `npm run build` | sandbox run failed on Turbopack port binding; approved non-sandbox rerun passed | 2026-07-09T14:04Z | CEO-Orchestrator |
| E-015 | governance | agent rule checks pass | `npm run agents:check` | passed | 2026-07-09T14:05Z | CEO-Orchestrator |
| E-016 | migration | no database migration was applied for this slice | `git diff -- supabase/migrations`; `supabase migration list` evidence E-005 | no migration files changed; broad production apply remains blocked by historical drift | 2026-07-09T14:05Z | CEO-Orchestrator |
| E-017 | git | task commit was rebased over new remote supplier permission commits | `git fetch --prune`; `git rebase origin/main`; `git log --oneline HEAD -4` | rebased commit `f63dedfb` on top of `2b655fcc` | 2026-07-09T14:10Z | CEO-Orchestrator |
| E-018 | validation | rebase validation gates pass | `npm run lint`; `npm run typecheck`; `npm run test`; `npm run agents:check`; `npm run build` | lint passed; typecheck passed; 98 files / 648 tests passed; agents check passed; build passed | 2026-07-09T14:11Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T14:07:26Z` `56c4c1070d` — EVIDENCE.md E-009 through E-016; git diff --check passed.
- `2026-07-09T14:11:43Z` `5bea587ab4` — EVIDENCE.md E-017 and E-018; build passed after rebase.
