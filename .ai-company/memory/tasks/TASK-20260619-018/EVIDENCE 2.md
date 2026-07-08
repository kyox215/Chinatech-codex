# Evidence Index — TASK-20260619-018

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T21:13:50Z | Integration Lead / CEO Agent |
| E-002 | context | L2-014 started from idle active context and dirty worktree is known | `/opt/homebrew/bin/python3.12 tools/ai_company.py status`; `git status --short` | no active task before creation; 19 changed/untracked paths observed | 2026-06-19T21:13:50Z | Integration Lead / CEO Agent |
| E-003 | inventory | docs markdown inventory size is known | `find docs -maxdepth 1 -type f ... | wc -l` | 22 docs markdown files | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-004 | inventory | broader non-generated markdown inventory size is known | `find . -maxdepth 3 -type f -name '*.md' ... | wc -l` | 201 markdown files | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-005 | code-fact | current App Router and legacy route state is known | `rg --files src/app src/features src/routes`; `find src/routes ... | wc -l`; `rg 'from "@/routes' src` | `src/app` route files present; 6 legacy `src/routes` files; only order list imports `@/routes/orders.index` | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-006 | drift | active UI checklist has stale route guidance | `docs/UI_CHECKLIST.md:22` | says route files live in `src/routes/` | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-007 | drift | department intake template has stale memory path guidance | `AI智能部门管理/templates/agenda-intake.md:39` | says to use `.ai-company/runtime-memory/tasks/<task_id>/` | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-008 | drift | TanStack/export docs are identified | `rg 'TanStack Start|@tanstack/react-router|createFileRoute|src/routes/' docs/*.md` | seven docs contain old stack/route references; some are likely archive/snapshot candidates | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-009 | metadata | docs freshness/owner metadata gaps are known | shell loops over `docs/*.md` for Last verified/reviewed/updated and Owner markers | 21/22 docs lack freshness marker; 19/22 lack owner marker | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-010 | report | stale documentation drift inventory exists | `.ai-company/memory/tasks/TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md` | report created with impact matrix, facts, unknowns, and L2 follow-ups | 2026-06-19T21:15:48Z | Integration Lead / CEO Agent |
| E-011 | memory-sync | project, documentation, conflict, backlog, and memory index records were synchronized | `.ai-company/memory/PROJECT_MEMORY.md`; `.ai-company/memory/departments/documentation.md`; `.ai-company/memory/OPEN_CONFLICTS.md`; `.ai-company/memory/BACKLOG.md`; `.ai-company/memory/MEMORY_INDEX.md` | L2-014 report and follow-up tasks recorded | 2026-06-19T21:18:33Z | Integration Lead / CEO Agent |
| E-012 | validation | governance checks pass after memory updates | `npm run agents:check` | Agent config check passed; template check passed; rule check passed | 2026-06-19T21:19:12Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
