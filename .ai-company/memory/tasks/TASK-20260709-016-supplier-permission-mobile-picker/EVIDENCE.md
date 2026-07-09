# Evidence Index — TASK-20260709-016-supplier-permission-mobile-picker

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T13:24:47Z | CEO-Orchestrator |
| E-002 | code | supplier permissions are implemented in API/data/UI | commits `809a8c41`, `2b655fcc` | passed | 2026-07-09T14:08:58Z | CEO-Orchestrator |
| E-003 | verification | TypeScript passes after merge | `npm run typecheck` | passed | 2026-07-09T15:58+02:00 | CEO-Orchestrator |
| E-004 | verification | ESLint passes after merge | `npm run lint` | passed | 2026-07-09T15:58+02:00 | CEO-Orchestrator |
| E-005 | verification | Unit tests pass after merge | `npm run test` | 98 files / 641 tests passed | 2026-07-09T15:59+02:00 | CEO-Orchestrator |
| E-006 | verification | Production build passes | `npm run build` | passed with escalated run after sandbox port-bind failure | 2026-07-09T15:59+02:00 | CEO-Orchestrator |
| E-007 | migration | Old migration history was repaired without include-all | `supabase migration repair --linked --status applied <25 versions>` | repaired as applied | 2026-07-09T16:03+02:00 | CEO-Orchestrator |
| E-008 | migration | Dry-run only planned supplier permission migration | `supabase db push --linked --dry-run` | would push only `20260709235000_supplier_permission_grants.sql` | 2026-07-09T16:04+02:00 | CEO-Orchestrator |
| E-009 | migration | Supplier permission migration applied | `supabase db push --linked`; `supabase migration list --linked` | `20260709235000` remote applied | 2026-07-09T16:05+02:00 | CEO-Orchestrator |
| E-010 | release | main branch updated | `git push origin HEAD:main`; `git ls-remote origin refs/heads/main` | remote main `2b655fcc6a1413e8adcf8905aa37693e72924630` | 2026-07-09T16:08+02:00 | CEO-Orchestrator |
| E-011 | visual | settings and orders pages render in mobile viewport | `screenshots/private-suppliers-mobile-orders-after.png`, `screenshots/private-suppliers-settings-members-after.png`, `screenshots/private-suppliers-settings-suppliers-after.png` | captured; mock data had 0 orders / owner-only member, so card permission controls not visually populated | 2026-07-09T16:09+02:00 | CEO-Orchestrator |
| E-012 | limitation | direct SQL table verification was blocked by pooler temp-role auth | `supabase db query --linked ...` | failed after 8 retries with SQLSTATE 28P01; migration list used as migration-history proof | 2026-07-09T16:06+02:00 | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
