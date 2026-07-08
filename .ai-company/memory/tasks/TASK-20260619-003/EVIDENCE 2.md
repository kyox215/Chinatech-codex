# Evidence Index — TASK-20260619-003

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T12:48:27Z | Integration Lead / CEO Agent |
| E-002 | skill | requested takeover skills were loaded before action | `.agents/skills/context-rehydrate/SKILL.md`; `.agents/skills/project-health-check/SKILL.md`; `.agents/skills/department-memory-sync/SKILL.md`; `.agents/skills/capability-review/SKILL.md` | observed | 2026-06-19T12:49:00Z | Integration Lead / CEO Agent |
| E-003 | rules | RepairDesk root rules establish Owner / AI employee operating model and local precedence | `AGENTS.md`; `.ai-company/REPAIRDESK_ADOPTION.md`; `.ai-company/policies/PROJECT_RULES.md`; `.ai-company/policies/TASK_FLOW.md` | observed | 2026-06-19T12:49:30Z | Integration Lead / CEO Agent |
| E-004 | architecture | App Router, feature boundaries, and validation gates are documented | `docs/ARCHITECTURE.md`; `src/app`; `src/features` | observed | 2026-06-19T12:50:00Z | Integration Lead / CEO Agent |
| E-005 | business-map | app routes cover dashboard, orders, customers, buyback, inventory, messages, onboarding, platform, settings | `find src/app -maxdepth 4 -type f ...` | observed | 2026-06-19T12:50:30Z | Integration Lead / CEO Agent |
| E-006 | api-map | single RepairDesk API catch-all dispatches GET/POST paths to feature services | `src/app/api/repairdesk/[...path]/route.ts`; `src/server/api/repairdesk-router.ts` | observed | 2026-06-19T12:51:00Z | Integration Lead / CEO Agent |
| E-007 | auth-map | auth actor resolves staff profile, platform admin flag, active store membership, and store cookie | `src/server/auth-context.ts`; `src/features/stores/server/store.repository.ts` | observed | 2026-06-19T12:51:20Z | Integration Lead / CEO Agent |
| E-008 | permission-map | platform approval is restricted to platform admins | `src/features/platform/server/platform.repository.ts` | observed | 2026-06-19T12:51:30Z | Integration Lead / CEO Agent |
| E-009 | permission-map | inventory write paths require owner/manager/technician/sales role | `src/server/api/repairdesk-router.ts` | observed | 2026-06-19T12:51:40Z | Integration Lead / CEO Agent |
| E-010 | tenant-guard | real Supabase repositories are tested to require strict store context | `src/server/tenant-guard.test.ts` | observed | 2026-06-19T12:51:50Z | Integration Lead / CEO Agent |
| E-011 | data-map | Supabase migrations define repair, customer, CRM, multistore, workflow, inventory, attachment, settings, and audit domains | `find supabase/migrations -maxdepth 1 -type f -name '*.sql'`; `rg create table ... supabase/migrations` | observed | 2026-06-19T12:52:10Z | Integration Lead / CEO Agent |
| E-012 | workspace-risk | workspace contains 99 `* 2.*` duplicate files | `rg --files -g '* 2.*'`; `rg --files -g '* 2.*' \| wc -l` | 99 files | 2026-06-19T12:53:20Z | Integration Lead / CEO Agent |
| E-013 | workspace-risk | worktree has modified business/governance files outside this takeover | `git status --short`; `git diff --stat` | latest observed stat: 12 modified tracked files plus many untracked files | 2026-06-19T12:56:30Z | Integration Lead / CEO Agent |
| E-014 | architecture-debt | order list still wraps legacy `src/routes/orders.index.tsx` | `src/features/orders/screens/order-list-screen.tsx` | observed | 2026-06-19T12:52:40Z | Integration Lead / CEO Agent |
| E-015 | dependency-map | Node, Next, React, TypeScript, Supabase, TanStack Query, Vitest, Playwright, Vercel build are declared | `.nvmrc`; `package.json`; `vercel.json`; `.github/workflows/*` | observed | 2026-06-19T12:53:00Z | Integration Lead / CEO Agent |
| E-016 | verification | TypeScript compile check passes | `npm run typecheck` | passed | 2026-06-19T12:52:30Z | Integration Lead / CEO Agent |
| E-017 | verification | agent rule checks pass | `npm run agents:check` | passed | 2026-06-19T12:52:45Z | Integration Lead / CEO Agent |
| E-018 | verification | AI Company OS v3 validation passes | `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | 11 checks, 0 warnings, 0 errors | 2026-06-19T12:52:47Z | Integration Lead / CEO Agent |
| E-019 | verification | lint passes | `npm run lint` | passed | 2026-06-19T12:52:50Z | Integration Lead / CEO Agent |
| E-020 | verification | unit test suite passes | `npm run test` | 37 files passed; 220 tests passed | 2026-06-19T12:52:55Z | Integration Lead / CEO Agent |
| E-021 | verification | production build passes when rerun outside sandbox; initial sandbox failure was Turbopack port permission | `npm run build` | sandbox failed with `Operation not permitted`; escalated rerun passed | 2026-06-19T12:53:10Z | Integration Lead / CEO Agent |
| E-022 | report | takeover report written with maps, risks, roadmap, and L2 task batch | `PROJECT_TAKEOVER_REPORT.md` | created | 2026-06-19T12:54:37Z | Integration Lead / CEO Agent |
| E-023 | verification | post-memory-sync governance validation passes | `npm run agents:check`; `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | agent checks passed; 11 validation checks, 0 warnings, 0 errors | 2026-06-19T12:56:00Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
