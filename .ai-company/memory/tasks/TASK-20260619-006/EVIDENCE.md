# Evidence Index — TASK-20260619-006

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T19:30:25Z | Integration Lead / CEO Agent |
| E-002 | approval | Owner approved next cleanup step | chat request after L2-003 recommendation | "继续下一步"; scoped to Batch A only | 2026-06-19T19:30:25Z | Integration Lead / CEO Agent |
| E-003 | scope correction | Batch A explicit row list contains 18 files, not 20 | `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` | rows #1-7, #9-16, #26-28 = 18 files | 2026-06-19T19:31:30Z | Integration Lead / CEO Agent |
| E-004 | preflight | approved Batch A files were untracked duplicates before deletion | `git status --short -- <18 Batch A paths>` | all 18 paths showed `??` | 2026-06-19T19:31:45Z | Integration Lead / CEO Agent |
| E-005 | cleanup | approved Batch A files were removed | `CLEANUP_REPORT.md`; `apply_patch` delete hunk | 18 duplicate files removed | 2026-06-19T19:32:15Z | Integration Lead / CEO Agent |
| E-006 | protected scope | protected Batch B/C examples remained after cleanup | `git status --short -- <protected examples>` | protected examples still showed `??` | 2026-06-19T19:32:30Z | Integration Lead / CEO Agent |
| E-007 | governance sync | agent config checker no longer requires deleted deprecated duplicate | `scripts/agents/check-agent-config.mjs`; `node scripts/agents/check-agent-config.mjs` | obsolete snippet assertion removed; config check passed | 2026-06-19T19:32:40Z | Integration Lead / CEO Agent |
| E-008 | validation | agent rule/config/template checks pass after cleanup | `npm run agents:check` | passed | 2026-06-19T19:32:51Z | Integration Lead / CEO Agent |
| E-009 | post-cleanup observation | duplicate-like files remain for later batches | `git ls-files -o --exclude-standard` filtered by basename ending ` 2.*` | 87 Git-visible duplicate-like files remain; not all are from the original Batch A/B/C decision package | 2026-06-19T19:33:20Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
