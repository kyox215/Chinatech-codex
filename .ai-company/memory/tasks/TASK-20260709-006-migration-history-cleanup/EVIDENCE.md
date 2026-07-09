# Evidence Index — TASK-20260709-006-migration-history-cleanup

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T00:31:14Z | CEO-Orchestrator |
| E-002 | repo-state | initial cleanup target included migration drift and stale active-context duplicate | `git status --short --branch`; `.ai-company/memory/ACTIVE_CONTEXT 3.md` | old active-context duplicate was untracked and removed | 2026-07-09T00:27Z | CEO-Orchestrator |
| E-003 | supabase-history | `20260708182631` was remote-only before fetch | `supabase migration list --linked` | remote column had `20260708182631`; no local file existed | 2026-07-09T00:27Z | CEO-Orchestrator |
| E-004 | supabase-fetch | fetched missing remote migration but CLI also overwrote tracked migration files | `supabase migration fetch --linked`; `git status --short` | new `20260708182631_store_invite_links.sql`; 16 tracked migrations modified by fetch | 2026-07-09T00:27Z | CEO-Orchestrator |
| E-005 | corrective-action | unsafe tracked migration overwrites were reverted | `git restore -- supabase/migrations`; `git status --short` | tracked migration overwrites cleared; new untracked remote file remained | 2026-07-09T00:28Z | CEO-Orchestrator |
| E-006 | file-review | fetched baseline duplicate should not be kept | `supabase/migrations/20260213234620_create_chinatechos_tables_v2.sql`; `supabase/migrations/20260213234620_remote_baseline.sql` | fetched file contained legacy DROP/CREATE SQL; local placeholder already preserves version alignment | 2026-07-09T00:28Z | CEO-Orchestrator |
| E-007 | file-review | `20260708182631_store_invite_links.sql` matches existing invite-link migration except trailing semicolon | `diff -u 20260704221944_store_invite_links.sql 20260708182631_store_invite_links.sql` | only difference was `select pg_notify(...);;` in fetched remote file | 2026-07-09T00:29Z | CEO-Orchestrator |
| E-008 | duplicate-cleanup | duplicate offline sync migration was byte-identical to canonical file | `diff -u '...draft.sql' '...draft 2.sql'`; `rg` reference check | no diff; no references to the ` 2.sql` path | 2026-07-09T00:30Z | CEO-Orchestrator |
| E-009 | production-readonly | invite-link production objects exist | `supabase db query --linked` for `to_regclass`/`to_regproc` | `store_invite_links`, `store_invite_link_attempts`, and `claim_store_invite_link` returned present | 2026-07-09T00:30Z | CEO-Orchestrator |
| E-010 | dry-run | remaining drift is local-only queue, not remote-only missing file | `supabase db push --linked --dry-run` after cleanup | dry-run listed 25 local-only migrations and no remote-only error | 2026-07-09T00:30Z | CEO-Orchestrator |
| E-011 | validation | diff has no whitespace/path errors | `git diff --check` | passed | 2026-07-09T00:33Z | CEO-Orchestrator |
| E-012 | validation | deleting duplicate SQL did not break migration-related tenant guard assertions | `npm run test -- src/server/tenant-guard.test.ts` | 1 file / 17 tests passed | 2026-07-09T00:33Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T00:33:17Z` `ca1bbeab87` — supabase migration list --linked now shows 20260708182631 local/remote aligned; supabase db push --linked --dry-run lists 25 local-only migrations and no remote-only error; production read-only query found invite-link objects; git diff --check passed; tenant-guard test passed 17/17.
