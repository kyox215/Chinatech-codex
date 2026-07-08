# Evidence Index — TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T23:23:15Z | Integration Lead / CEO Agent |
| E-002 | rule | root agent instructions require screenshots or no-screenshot reason at task closeout | `AGENTS.md` | Owner Visual Evidence Rule added | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-003 | rule | task flow requires screenshot evidence before closeout | `.ai-company/policies/TASK_FLOW.md` | screenshot evidence rule, closeout condition, and CEO report field added | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-004 | rule | project quality and communication rules require screenshot/no-screenshot evidence | `.ai-company/policies/PROJECT_RULES.md` | testing/quality and communication rules updated | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-005 | checklist | multi-agent final report checklist includes screenshots/no-screenshot reason | `.agents/integration-checklist.md` | UI and final report checklist updated | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-006 | memory | QA and documentation departments know the closeout screenshot rule | `.ai-company/memory/departments/qa.md`; `.ai-company/memory/departments/documentation.md`; `.ai-company/memory/PROJECT_MEMORY.md` | memory synchronized | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-007 | validation | screenshot rule is discoverable from project rule and memory surfaces | `rg -n "Visual Evidence|截图|screenshot|no-screenshot|无截图|Screenshots" ...` | passed | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-008 | validation | governance checks accept the rule update | `npm run agents:check` | passed: config, template, and rule checks passed | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |
| E-009 | boundary | this task has no relevant UI/task page to screenshot | task scope and updated file paths | no screenshot captured; alternate evidence is rule paths plus validation output | 2026-06-19T23:23:49Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
