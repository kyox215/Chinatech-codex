# Evidence Index — TASK-20260721-005-new-order-blank-name-safari-transition

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-21T15:46:35Z | IntegrationLead |
| E-002 | unit/regression | cache navigation and migration checks pass | `npm run test -- --run` | 332 files / 2170 tests passed | 2026-07-21 | IntegrationLead |
| E-003 | static | lint and TypeScript pass | `npm run lint -- --max-warnings=0`; `npm run typecheck` | passed | 2026-07-21 | IntegrationLead |
| E-004 | build | production bundle compiles | `npm run build` | passed | 2026-07-21 | IntegrationLead |
| E-005 | migration | only the intended forward migration is pending | `supabase db push --dry-run --include-all` | one migration listed | 2026-07-21 | IntegrationLead |
| E-006 | WebKit | created order opens and flow panel works without refresh | `PLAYWRIGHT_BROWSER=webkit ... new-order-create-navigation.spec.ts` | 2 passed | 2026-07-21 | IntegrationLead |
| E-007 | visual | flow panel visible immediately after create | `screenshots/TASK-20260721-005-new-order-blank-name-safari-transition/safari-created-order-transition-ready.png` | verified | 2026-07-21 | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-21T15:46:35Z` `9a24bd55b6` — supabase db push --dry-run仅列出20260721150000；WebKit 2项通过；截图screenshots/TASK-20260721-005-new-order-blank-name-safari-transition/safari-created-order-transition-ready.png
- `2026-07-21T15:49:41Z` `abeea3b303` — commit 59965462；origin/codex/new-order-blank-name-safari；2170 tests passed；WebKit 2 passed；build passed
