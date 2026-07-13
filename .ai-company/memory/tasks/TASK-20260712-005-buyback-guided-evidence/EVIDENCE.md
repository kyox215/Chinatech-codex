# Evidence Index — TASK-20260712-005-buyback-guided-evidence

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-12T13:06:48Z | 鹤祥 |
| E-002 | focused tests | agreement, upload envelope, workflow, repository, migration, permissions, schema, route and signature regressions | `npx vitest run --maxWorkers=2` with 12 scoped files | 12 files / 151 tests passed | 2026-07-13T08:22:52Z | RepairDesk Integration Lead |
| E-003 | full unit regression | repository-wide unit/integration suite | `npx vitest run --maxWorkers=2` | 125 files / 848 tests passed | 2026-07-13T08:24:05Z | RepairDesk Integration Lead |
| E-004 | static gates | lint and TypeScript contracts | `npm run lint`; `npm run typecheck` | passed | 2026-07-13T08:23:40Z | RepairDesk Integration Lead |
| E-005 | standard production build | Next.js production compilation and route generation | `npm run build` | Turbopack build passed; 22/22 static pages | 2026-07-13T08:33:00Z | RepairDesk Integration Lead |
| E-006 | guided buyback E2E | owner completion, deferred reopen/bind/finalize and sales handoff without restricted evidence | `npx playwright test --workers=1 tests/e2e/buyback-guided-flow.spec.ts` | 3/3 passed | 2026-07-13T08:28:20Z | RepairDesk Integration Lead |
| E-007 | dashboard responsive E2E | direct quick actions, loading/error truthfulness and overflow at 390/430/768/1024/1440px | `npx playwright test --workers=1 tests/e2e/dashboard-quick-start.spec.ts` | 7/7 passed | 2026-07-13T08:28:55Z | RepairDesk Integration Lead |
| E-008 | mobile visual | restricted evidence, legal text and success state | `screenshots/buyback-390-step5-evidence.png`; `screenshots/buyback-390-success.png` | visually inspected; 390x844 PNG | 2026-07-13T08:30:00Z | RepairDesk Integration Lead |
| E-009 | desktop visual | restricted evidence, legal text and success state | `screenshots/buyback-1440-step5-evidence.png`; `screenshots/buyback-1440-success.png` | visually inspected; 1440x1000 PNG | 2026-07-13T08:30:35Z | RepairDesk Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- Historical pre-hardening evidence is retained in `CHECKPOINTS.md`; E-002 through E-009 supersede those stale gates.
- `2026-07-13T08:33:26Z` `58b6edd30e` — EVIDENCE.md E-002至E-009；screenshots/buyback-390-step5-evidence.png、buyback-390-success.png、buyback-1440-step5-evidence.png、buyback-1440-success.png。
