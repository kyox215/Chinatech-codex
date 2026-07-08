# Evidence Index — TASK-20260619-019

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T21:20:21Z | Integration Lead / CEO Agent |
| E-002 | source | L2-015 scope comes from L2-014 P1 findings | `.ai-company/memory/tasks/TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md` | identified `docs/UI_CHECKLIST.md:22` and `AI智能部门管理/templates/agenda-intake.md:39` as active doc drift | 2026-06-19T21:20:35Z | Integration Lead / CEO Agent |
| E-003 | preflight | target file contents and pre-existing diff were inspected | `sed` on both target files; `git diff -- docs/UI_CHECKLIST.md AI智能部门管理/templates/agenda-intake.md` | `agenda-intake.md` had pre-existing additions; no `docs/UI_CHECKLIST.md` diff | 2026-06-19T21:20:35Z | Integration Lead / CEO Agent |
| E-004 | change | active doc route guidance now uses App Router and feature screens | `docs/UI_CHECKLIST.md` | `src/routes/` instruction replaced with `src/app/` thin route + `src/features/*/screens` guidance | 2026-06-19T21:20:35Z | Integration Lead / CEO Agent |
| E-005 | change | active task template now uses v3 task memory path | `AI智能部门管理/templates/agenda-intake.md` | `.ai-company/runtime-memory/tasks` instruction replaced with `.ai-company/memory/tasks/<task_id>` and legacy note | 2026-06-19T21:20:35Z | Integration Lead / CEO Agent |
| E-006 | validation | target stale strings are gone from the two active docs | `rg -n 'src/routes/|runtime-memory/tasks' docs/UI_CHECKLIST.md AI智能部门管理/templates/agenda-intake.md` | no matches | 2026-06-19T21:21:25Z | Integration Lead / CEO Agent |
| E-007 | validation | agent governance checks pass after doc fix | `npm run agents:check` | Agent config check passed; template check passed; rule check passed | 2026-06-19T21:21:25Z | Integration Lead / CEO Agent |
| E-008 | memory-sync | project, documentation, conflict, backlog, and memory index records were synchronized | `.ai-company/memory/PROJECT_MEMORY.md`; `.ai-company/memory/departments/documentation.md`; `.ai-company/memory/OPEN_CONFLICTS.md`; `.ai-company/memory/BACKLOG.md`; `.ai-company/memory/MEMORY_INDEX.md` | L2-015 result recorded; active doc conflict mitigated | 2026-06-19T21:21:25Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
