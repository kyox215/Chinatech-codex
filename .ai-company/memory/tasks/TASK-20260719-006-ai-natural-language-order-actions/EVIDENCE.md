# Evidence Index — TASK-20260719-006-ai-natural-language-order-actions

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-19T16:04:24Z | 鹤祥 |
| E-002 | review | architecture/data/UI/security/release boundaries were independently reviewed | three read-only department-agent reports in integration thread | Query V2/no-migration accepted; production writes no-go until separate D4 | 2026-07-19T17:05:00Z | Integration Lead |
| E-003 | static | project agent rules are valid | `npm run agents:check` | passed | 2026-07-19T17:06:00Z | Integration Lead |
| E-004 | static | lint and TypeScript are clean | `npm run lint`; `npm run typecheck` | passed | 2026-07-19T17:15:00Z | Integration Lead |
| E-005 | test | full unit/integration regression passes after final audit change | `npm run test` | 311 files / 2,017 tests passed | 2026-07-19T17:15:30Z | Integration Lead |
| E-006 | build | final application code compiles as production webpack build | `npx next build --webpack` | passed; 26 static pages generated | 2026-07-19T17:16:00Z | Integration Lead |
| E-007 | E2E | all AI staff browser cases pass without production writes | `tests/e2e/ai-assistant-staff.spec.ts`, isolated webpack-dev groups | 11/11 passed in aggregate; long shared HMR run was split after an observed dev-chunk syntax fault | 2026-07-19T17:06:00Z | Integration Lead |
| E-008 | visual | compact usage control, applied filters, inline details and explicit link render at mobile/desktop widths | `screenshots/TASK-20260719-006-ai-natural-language-order-actions/` | five verified synthetic-data screenshots | 2026-07-19T17:06:00Z | Integration Lead |
| E-009 | security | no production key or private-key pattern entered the scoped diff/task files | scoped diff/untracked secret-pattern scan | no matches | 2026-07-19T17:16:00Z | Integration Lead |
| E-010 | data | release adds no database migration | scoped Git status/diff | no `supabase/migrations` changes | 2026-07-19T17:16:00Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
