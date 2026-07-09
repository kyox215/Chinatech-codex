# Evidence Index — TASK-20260709-022-permission-projection-phase-d1

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T21:35:38Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T21:44:09Z` `8ebc63f2ff` — Targeted tests passed: 3 files / 42 tests. Full tests passed: 99 files / 668 tests. npm run lint passed. npm run typecheck passed. npm run build passed after elevated Turbopack permission. git diff --check passed. git diff --name-only -- supabase returned no files.
- `2026-07-09T21:45:13Z` `2843348af2` — TASK.md acceptance criteria checked; git diff --check passed before task file update and will be rerun before commit.
- `2026-07-09T21:49:52Z` `a3582d4427` — npm run lint passed; npm run typecheck passed; npm run test passed 99 files / 668 tests; npm run build passed with elevated Turbopack permissions; git diff --check origin/main...HEAD passed; git diff --name-only origin/main...HEAD -- supabase returned no files.
