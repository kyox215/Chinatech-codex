# Evidence Index — TASK-20260619-005

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T19:01:54Z | Integration Lead / CEO Agent |
| E-002 | inventory source | 32 differing duplicate files exist and require review | `.ai-company/memory/tasks/TASK-20260619-004/DUPLICATE_WORKTREE_INVENTORY.md` | 104 Git-visible duplicates; 72 identical; 32 different | 2026-06-19T19:02:00Z | Integration Lead / CEO Agent |
| E-003 | worktree boundary | no duplicate/business-code files were edited before review write-up | `git status --short` | showed pre-existing dirty worktree plus `.ai-company/` memory work; no deletion/stage/revert performed | 2026-06-19T19:02:20Z | Integration Lead / CEO Agent |
| E-004 | diff review | all 32 differing duplicate/canonical pairs were compared | `git diff --no-index --unified=2/3 -- <canonical> <duplicate>` across all 32 pairs | each pair classified by domain, diff size, and recommendation | 2026-06-19T19:06:00Z | Integration Lead / CEO Agent |
| E-005 | report | decision package exists for cleanup/salvage review | `DIFFERING_DUPLICATES_REVIEW.md` | corrected by `TASK-20260619-006`: 18 remove-after-owner, 12 remove-after-domain, 2 backlog/salvage candidates | 2026-06-19T19:06:39Z | Integration Lead / CEO Agent |
| E-006 | validation | agent rule/config/template checks pass after memory updates | `npm run agents:check` | passed: Agent config check, template check, and rule check | 2026-06-19T19:07:00Z | Integration Lead / CEO Agent |
| E-007 | validation limitation | full AI Company validator did not complete in this workspace | `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | interrupted after prolonged no-output traversal; stack trace showed `root.rglob("*.md")`; `--root .ai-company validate` failed because `.ai-company` is not a valid repository root | 2026-06-19T19:09:00Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
