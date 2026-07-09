# Evidence Index — TASK-20260709-020-account-center-recovery

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T17:36:19Z | 鹤祥 |
| E-002 | test | lint passes | `npm run lint` | exit 0 | 2026-07-09T19:55+02:00 | Codex |
| E-003 | test | typecheck passes | `npm run typecheck` | exit 0 | 2026-07-09T19:55+02:00 | Codex |
| E-004 | test | unit regression passes | `npm run test` | 98 files, 655 tests passed | 2026-07-09T19:53+02:00 | Codex |
| E-005 | build | production build passes | `npm run build` | exit 0; routes include `/account`, `/forgot-password`, `/reset-password` | 2026-07-09T19:55+02:00 | Codex |
| E-006 | migration-dry-run | linked Supabase would apply only this migration | `supabase db push --linked --dry-run --include-all` | only `20260709174757_account_profile_phone_fields.sql` listed | 2026-07-09T19:49+02:00 | Codex |
| E-007 | migration-apply | migration applied to linked Supabase | `supabase db push --linked --include-all --yes` | migration applied successfully | 2026-07-09T19:56+02:00 | Codex |
| E-008 | db-verify | new staff profile columns exist | linked schema query against `information_schema.columns` | `phone_e164 text`, `phone_verified_at timestamptz`, nullable | 2026-07-09T19:57+02:00 | Codex |
| E-009 | db-verify | phone constraint and index exist | linked `pg_constraint` / `pg_indexes` queries | constraint validated; partial index exists | 2026-07-09T20:01+02:00 | Codex |
| E-010 | db-verify | migration history recorded | linked `supabase_migrations.schema_migrations` query | version `20260709174757` present | 2026-07-09T19:57+02:00 | Codex |
| E-011 | visual | public auth pages render | `artifacts/forgot-password-mobile.png`, `artifacts/forgot-password-desktop.png`, `artifacts/login-mobile.png` | screenshots captured from local dev server | 2026-07-09T19:55+02:00 | Codex |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T18:03:01Z` `5e4375c9be` — npm run lint exit 0; npm run typecheck exit 0; npm run test 98 files/655 tests passed; npm run build exit 0; linked DB columns/constraint/index/history verified; screenshots under artifacts/.
