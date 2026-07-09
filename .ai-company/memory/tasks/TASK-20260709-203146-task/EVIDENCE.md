# Evidence Index — TASK-20260709-203146-task

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T20:31:46Z | CEO-Orchestrator |
| E-002 | test | targeted role-permission regression passes | `npm run test -- src/server/permissions.test.ts src/server/api/repairdesk-router.test.ts` | 2 files, 35 tests passed | 2026-07-09T22:34+02:00 | Codex |
| E-003 | test | lint passes | `npm run lint` | exit 0 | 2026-07-09T22:34+02:00 | Codex |
| E-004 | test | typecheck passes | `npm run typecheck` | exit 0 | 2026-07-09T22:33+02:00 | Codex |
| E-005 | test | full unit regression passes | `npm run test` | 98 files, 659 tests passed | 2026-07-09T22:34+02:00 | Codex |
| E-006 | build | production build passes | `npm run build` | exit 0 after sandbox escalation for Turbopack port binding | 2026-07-09T22:35+02:00 | Codex |
| E-007 | migration-dry-run | linked Supabase has no pending migrations | `supabase db push --linked --dry-run --include-all` | remote database is up to date | 2026-07-09T22:38+02:00 | Codex |
| E-008 | migration-apply | owner-approved DB apply completed | `supabase db push --linked --include-all --yes` | remote database is up to date | 2026-07-09T22:39+02:00 | Codex |
| E-009 | db-verify | supplier permission grant migration recorded | linked `supabase_migrations.schema_migrations` query | version `20260709235000` present | 2026-07-09T22:39+02:00 | Codex |
| E-010 | db-verify | supplier permission grants table exists with RLS | linked catalog query for `public.store_member_permission_grants` | `relrowsecurity = true` | 2026-07-09T22:40+02:00 | Codex |
| E-011 | db-verify | direct client table grants are absent | linked `information_schema.role_table_grants` query | only `postgres` and `service_role` grants returned | 2026-07-09T22:40+02:00 | Codex |
| E-012 | release | role permission code/docs pushed to main | `git push origin HEAD:main` | `9462f983..3db8dacf  HEAD -> main` | 2026-07-09T22:41+02:00 | Codex |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
