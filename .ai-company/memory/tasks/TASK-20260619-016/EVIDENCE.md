# Evidence Index — TASK-20260619-016

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:58:09Z | Integration Lead / CEO Agent |
| E-002 | active-context observation | active context pointed to the old UI audit task before this hygiene task was created | `sed -n '1,120p' .ai-company/memory/ACTIVE_CONTEXT.md` before `TASK-20260619-016` creation | observed `current_task_id: "TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui"` and `phase: "implementation"` | 2026-06-19T20:58:17Z | Integration Lead / CEO Agent |
| E-003 | task state | old UI audit task was active and not closed | `.ai-company/memory/tasks/TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui/TASK.md` | frontmatter showed `status: "active"` before this task changed it; acceptance criteria were unchecked | 2026-06-19T20:58:17Z | Integration Lead / CEO Agent |
| E-004 | checkpoint evidence | old UI task has implementation/test claims but requires separate verification before closeout | `.ai-company/memory/tasks/TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui/CHECKPOINTS.md`; `EVIDENCE.md` | checkpoint recorded UI changes and test commands; EVIDENCE has one appended digest line, not a fully reconciled closeout matrix | 2026-06-19T20:58:17Z | Integration Lead / CEO Agent |
| E-005 | tool behavior | closing a non-active parallel task does not clear unrelated active context | `tools/ai_company.py` lines around `cmd_close_task` | `ACTIVE_CONTEXT.md` is idled only when `active.current_task_id == task_id` | 2026-06-19T20:58:17Z | Integration Lead / CEO Agent |
| E-006 | change | old UI task was preserved and marked `on_hold` with a resume handoff | old UI task `TASK.md`, `CHECKPOINTS.md`, and `HANDOFF.md` | status changed to `on_hold`; handoff now says explicit resume required | 2026-06-19T20:58:17Z | Integration Lead / CEO Agent |
| E-007 | report | active-context drift hygiene decision is documented | `ACTIVE_CONTEXT_DRIFT_HYGIENE_REPORT.md` | report created | 2026-06-19T20:58:17Z | Integration Lead / CEO Agent |
| E-008 | validation | governance checks pass after memory updates | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T21:00:23Z | Integration Lead / CEO Agent |
| E-009 | verification | old UI task is no longer active | `.ai-company/memory/tasks/TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui/TASK.md` | frontmatter shows `status: "on_hold"` | 2026-06-19T21:00:23Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
