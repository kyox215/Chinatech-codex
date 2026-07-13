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
| E-010 | post-rebase security tests | shared router/schema/types plus buyback security contracts remain valid on latest main | 12 scoped Vitest files | 12 files / 152 tests passed | 2026-07-13T08:39:17Z | RepairDesk Integration Lead + SEC reviewer |
| E-011 | post-rebase full regression | repository-wide suite after `origin/main@67157606` integration | `npx vitest run --maxWorkers=2` | 127 files / 883 tests passed | 2026-07-13T08:39:54Z | RepairDesk Integration Lead |
| E-012 | post-rebase static/build gates | merged source compiles, lints and builds | `npm run lint`; `npm run typecheck`; `npm run build` | all passed; 22/22 static pages | 2026-07-13T08:40:25Z | RepairDesk Integration Lead |
| E-013 | post-rebase browser regression | guided buyback and dashboard quick-start/loading/error flows | two Playwright specs, one worker | 10/10 passed | 2026-07-13T08:41:10Z | RepairDesk Integration Lead |
| E-014 | independent security freeze | no unresolved P0/P1 in push scope | commit `fd30c7e1`; focused tests; `git show --check` | code push PASS; production migration/deploy NO-GO | 2026-07-13T08:41:00Z | SEC reviewer |
| E-015 | GitHub push | verified feature and release checkpoint reached `origin/main` without force | `git push origin HEAD:main`; `git ls-remote origin refs/heads/main` | remote `main` = `6f475115ac4847b98601fdc788e4111e6c243604` | 2026-07-13T08:43:30Z | RepairDesk Integration Lead |
| E-016 | governance closeout | closeout memory and agent rules remain valid | `npm run agents:check`; `git diff --check` | passed | 2026-07-13T08:48:00Z | RepairDesk Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- Historical pre-hardening evidence is retained in `CHECKPOINTS.md`; E-010 through E-014 are the authoritative post-rebase gates.
- `2026-07-13T08:33:26Z` `58b6edd30e` — EVIDENCE.md E-002至E-009；screenshots/buyback-390-step5-evidence.png、buyback-390-success.png、buyback-1440-step5-evidence.png、buyback-1440-success.png。
- `2026-07-13T08:41:36Z` `83cd754547` — commit fd30c7e1；安全结论代码推送PASS；12/152 focused、127/883 full、10/10 Playwright、npm run build PASS；四张移动/桌面截图已入提交。
