# Evidence Index — TASK-20260619-020

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T21:24:33Z | Integration Lead / CEO Agent |
| E-002 | source | L2-016 scope comes from L2-014 archive/snapshot recommendations | `.ai-company/memory/tasks/TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md` | six historical/export/planning docs recommended for archive/snapshot banners | 2026-06-19T21:24:42Z | Integration Lead / CEO Agent |
| E-003 | preflight | task started from idle context with known dirty worktree | `/opt/homebrew/bin/python3.12 tools/ai_company.py status`; `git status --short` | no active task; 20 changed/untracked paths observed | 2026-06-19T21:24:42Z | Integration Lead / CEO Agent |
| E-004 | preflight | six candidate docs had no pre-existing diff before this edit | `git diff -- docs/ORDERS_SPEC.md docs/ORDERS_FULL_EXPORT.md docs/REFACTOR_EXECUTION_PLAN.md docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md docs/GPT_PROJECT_REPLANNING_BRIEF.md docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md` | no output | 2026-06-19T21:24:42Z | Integration Lead / CEO Agent |
| E-005 | change | archive/snapshot banners were added in place without deleting content | six candidate docs | each now states it is historical/snapshot and current App Router/v3 memory/RepairOS rules override it | 2026-06-19T21:24:42Z | Integration Lead / CEO Agent |
| E-006 | validation | all six documents contain the L2-016 banner marker and override language | `rg -n 'TASK-20260619-020|当前项目规则以|.ai-company/memory/tasks|Next.js App Router|RepairOS 当前规则优先' <six docs>` | all six files matched the banner marker and override language | 2026-06-19T21:25:59Z | Integration Lead / CEO Agent |
| E-007 | validation | governance checks pass after banner updates | `npm run agents:check` | Agent config check passed; template check passed; rule check passed | 2026-06-19T21:25:59Z | Integration Lead / CEO Agent |
| E-008 | report | archive/snapshot banner report exists | `.ai-company/memory/tasks/TASK-20260619-020/ARCHIVE_SNAPSHOT_BANNER_REPORT.md` | report created with updated-document list, validation, and remaining follow-ups | 2026-06-19T21:25:59Z | Integration Lead / CEO Agent |
| E-009 | memory-sync | project, documentation, backlog, and memory index records were synchronized | `.ai-company/memory/PROJECT_MEMORY.md`; `.ai-company/memory/departments/documentation.md`; `.ai-company/memory/BACKLOG.md`; `.ai-company/memory/MEMORY_INDEX.md` | L2-016 result recorded; `DOC-BACKLOG-20260619-002` marked completed | 2026-06-19T21:25:59Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
