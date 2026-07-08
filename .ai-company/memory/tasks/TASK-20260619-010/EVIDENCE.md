# Evidence Index — TASK-20260619-010

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:18:15Z | Integration Lead / CEO Agent |
| E-002 | governance | L2 review boundary and RepairDesk authority were loaded | `AGENTS.md`; `.ai-company/REPAIRDESK_ADOPTION.md`; `.ai-company/policies/*`; `AI智能部门管理/部门化管理设计.md`; relevant `.agents/skills/*/SKILL.md` | observed; review-only scope | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-003 | prior-decision | Batch C contains two backlog/salvage candidates | `.ai-company/memory/tasks/TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md`; `.ai-company/memory/tasks/TASK-20260619-009/BATCH_B_CLEANUP_REPORT.md` | `scripts/check-agent-rules 2.mjs`; `tests/e2e/visual-overflow.spec 2.ts` | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-004 | status | Batch C files remain untracked and present before/after review | `git status --short -- 'scripts/check-agent-rules 2.mjs' 'tests/e2e/visual-overflow.spec 2.ts'` | both files reported `??` | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-005 | comparison | duplicate checker is older standalone logic versus current modular checker | `diff -u 'scripts/check-agent-rules.mjs' 'scripts/check-agent-rules 2.mjs'`; `scripts/agents/check-agent-config.mjs`; `scripts/agents/check-agent-templates.mjs` | old duplicate includes hard-coded required files/snippets and obsolete deprecated-file assertion; current canonical spawns modular checks | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-006 | comparison | visual overflow duplicate contains a different final dialog scenario | `diff -u 'tests/e2e/visual-overflow.spec.ts' 'tests/e2e/visual-overflow.spec 2.ts'` | duplicate swaps records workspace check for an attachment inventory check | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-007 | source-search | attachment inventory E2E duplicate cannot be directly merged against current UI evidence | `rg -n "附件库存|data-order-records-workspace|order-records-workspace|关联的库存记录" src tests` | current source shows records workspace marker and duplicate-only attachment text; no current `附件库存` source hit | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-008 | validation | governance checks pass during review | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |
| E-009 | boundary | no Batch C files were deleted, merged, staged, or modified | review-only actions; final `git status --short -- <Batch C paths>` | both Batch C files remain `??` | 2026-06-19T20:19:04Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
