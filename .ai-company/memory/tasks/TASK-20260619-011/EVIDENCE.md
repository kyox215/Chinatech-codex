# Evidence Index — TASK-20260619-011

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:23:42Z | Integration Lead / CEO Agent |
| E-002 | governance | L2 cleanup boundary and project authority were loaded | `AGENTS.md`; `.ai-company/REPAIRDESK_ADOPTION.md`; `.ai-company/policies/*`; `AI智能部门管理/部门化管理设计.md`; relevant `.agents/skills/*/SKILL.md` | observed; scoped cleanup only | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-003 | prior-decision | Batch C can be cleaned after preserving the E2E idea | `.ai-company/memory/tasks/TASK-20260619-010/BATCH_C_REVIEW_REPORT.md` | checker duplicate is delete-only; visual-overflow duplicate is salvage-first backlog | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-004 | preflight | the two Batch C duplicate files existed as untracked files before cleanup | `git status --short -- 'scripts/check-agent-rules 2.mjs' 'tests/e2e/visual-overflow.spec 2.ts'`; `ls -l -- ...` | both paths reported `??` and existed on disk | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-005 | preflight | canonical files were not part of this task; one canonical helper had pre-existing local modification | `git status --short -- 'scripts/check-agent-rules.mjs' 'scripts/agents/check-agent-config.mjs' 'scripts/agents/check-agent-templates.mjs' 'tests/e2e/visual-overflow.spec.ts'` | only `scripts/agents/check-agent-config.mjs` showed pre-existing `M`; no canonical files edited by L2-007 at this point | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-006 | backlog | attachment-inventory overflow E2E idea has a formal backlog entry | `.ai-company/memory/BACKLOG.md` | `QA-BACKLOG-20260619-001` added with evidence, owner, trigger, and status | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-007 | change | exactly the two Batch C duplicate files were deleted | `apply_patch` delete hunks for `scripts/check-agent-rules 2.mjs` and `tests/e2e/visual-overflow.spec 2.ts` | success; no canonical file included | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-008 | postflight | Batch C duplicate paths are gone | `git status --short -- 'scripts/check-agent-rules 2.mjs' 'tests/e2e/visual-overflow.spec 2.ts'`; `test ! -e ...` for both paths | no path status output; both `test ! -e` checks passed | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-009 | boundary | canonical target files were not changed by L2-007 | `git status --short -- 'scripts/check-agent-rules.mjs' 'scripts/agents/check-agent-config.mjs' 'scripts/agents/check-agent-templates.mjs' 'tests/e2e/visual-overflow.spec.ts'` | only pre-existing `M scripts/agents/check-agent-config.mjs` remains | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |
| E-010 | validation | governance checks pass after backlog and cleanup changes | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:24:08Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
