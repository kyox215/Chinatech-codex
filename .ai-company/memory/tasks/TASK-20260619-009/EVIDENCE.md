# Evidence Index — TASK-20260619-009

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:08:58Z | Integration Lead / CEO Agent |
| E-002 | governance | L2 cleanup boundary and RepairDesk authority were loaded | `AGENTS.md`; `.ai-company/REPAIRDESK_ADOPTION.md`; `.ai-company/policies/*`; `AI智能部门管理/部门化管理设计.md`; relevant `.agents/skills/*/SKILL.md` | observed; no broad code or production authority granted | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-003 | prior-decision | Batch B duplicates were confirmed stale and recommended for delete-only cleanup | `.ai-company/memory/tasks/TASK-20260619-008/BATCH_B_SEMANTIC_CONFIRMATION.md` | 12 files approved for follow-up deletion; do not merge contents | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-004 | preflight | all 12 Batch B target files existed as untracked duplicate files before cleanup | `git status --short -- <12 Batch B paths>` and `ls -l -- <12 Batch B paths>` | all 12 paths reported `??` and existed on disk | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-005 | preflight | Batch C protected files existed and were outside this cleanup | `git status --short -- 'scripts/check-agent-rules 2.mjs' 'tests/e2e/visual-overflow.spec 2.ts'`; `ls -l -- ...` | both protected files reported `??` and existed on disk | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-006 | change | exactly the 12 Batch B target files were deleted | `apply_patch` delete hunks for the 12 approved paths | success; no Batch C or canonical files included | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-007 | postflight | 12 Batch B target paths are gone from Git path status | `git status --short -- <12 Batch B paths>` | no output | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-008 | postflight | Batch C protected files remain untouched | `git status --short -- 'scripts/check-agent-rules 2.mjs' 'tests/e2e/visual-overflow.spec 2.ts'`; `ls -l -- ...` | both protected files still reported `??` and existed on disk | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-009 | validation | governance rule checks still pass after cleanup | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-010 | validation | targeted order workflow semantics remain green after cleanup | `npm run test -- src/features/orders/model/canonical-order-status.test.ts src/features/orders/model/order-workflow.test.ts src/features/orders/model/order-task-flow.test.ts src/features/orders/model/order-side-statuses.test.ts src/features/orders/testing/mock-api.test.ts` | passed: 5 test files, 40 tests | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |
| E-011 | worktree | unrelated dirty worktree remains outside this task | `git status --short` | many pre-existing modified/untracked files remain; this task did not stage, commit, push, or revert them | 2026-06-19T20:10:23Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
