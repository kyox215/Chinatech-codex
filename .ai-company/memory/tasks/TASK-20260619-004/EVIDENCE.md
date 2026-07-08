# Evidence Index — TASK-20260619-004

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T13:22:40Z | Integration Lead / CEO Agent |
| E-002 | rules | task performed under L2 inventory-only boundary | `AGENTS.md`; `.ai-company/REPAIRDESK_ADOPTION.md`; `.ai-company/policies/PROJECT_RULES.md`; `.ai-company/policies/TASK_FLOW.md`; `AI智能部门管理/部门化管理设计.md` | observed | 2026-06-19T13:23:20Z | Integration Lead / CEO Agent |
| E-003 | git-status | dirty worktree summarized without mutation | `git status --short`; `git diff --name-status`; `git diff --stat`; `git ls-files -o --exclude-standard` | 12 tracked modified files plus untracked governance/assets/duplicates observed | 2026-06-19T13:23:50Z | Integration Lead / CEO Agent |
| E-004 | duplicate-scan | duplicate-like files and dirs classified with canonical counterpart and content equality | read-only Node scanner using filesystem, SHA-256, `git check-ignore`, `git ls-files --error-unmatch` | 104 git-visible duplicate files, 14 git-visible empty duplicate dirs, 11 ignored/generated duplicate-like paths | 2026-06-19T13:24:10Z | Integration Lead / CEO Agent |
| E-005 | report | duplicate and dirty worktree inventory report exists | `DUPLICATE_WORKTREE_INVENTORY.md` | created | 2026-06-19T13:24:26Z | Integration Lead / CEO Agent |
| E-006 | verification | post-report governance validation passes | `npm run agents:check`; `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | agent checks passed; 11 validation checks, 0 warnings, 0 errors | 2026-06-19T13:28:29Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
