# Evidence Index — TASK-20260619-008

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T19:50:07Z | Integration Lead / CEO Agent |
| E-002 | scope | Batch B duplicate list identified | `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` | rows #17-25 and #29-31 = 12 files | 2026-06-19T19:50:40Z | Integration Lead / CEO Agent |
| E-003 | boundary | Batch B files remain untracked and untouched during review | `git status --short -- <12 Batch B paths>` | all 12 paths showed `??` before report; no deletion performed | 2026-06-19T19:51:50Z | Integration Lead / CEO Agent |
| E-004 | product code | current app semantics keep external repair and repaired in repair stage | `src/features/orders/model/canonical-order-status.ts`, `order-workflow.ts`, `order-task-flow.ts`, `order-transition-reasons.ts`, `order-side-statuses.ts` | canonical code maps/guides `mail_in_progress` and `repaired` as repair-stage work | 2026-06-19T19:51:20Z | Integration Lead / CEO Agent |
| E-005 | tests | current tests assert repair-stage semantics and approval transitions | order model tests and `src/features/orders/testing/mock-api.test.ts` | relevant assertions found for `mail_in_progress`, `repaired`, and `parts_ordered` | 2026-06-19T19:52:00Z | Integration Lead / CEO Agent |
| E-006 | migration history | later canonical migrations supersede older intermediate migration semantics | `20260618172000_repaired_workflow_status_repair.sql`, `20260619103000_order_external_repair_workflow.sql` | later migrations update `repaired` and `mail_in_progress` to repair semantics | 2026-06-19T19:52:20Z | Integration Lead / CEO Agent |
| E-007 | targeted tests | current canonical order workflow tests pass | `npm run test -- src/features/orders/model/canonical-order-status.test.ts src/features/orders/model/order-workflow.test.ts src/features/orders/model/order-task-flow.test.ts src/features/orders/model/order-side-statuses.test.ts src/features/orders/testing/mock-api.test.ts` | 5 files passed, 40 tests passed | 2026-06-19T19:52:55Z | Integration Lead / CEO Agent |
| E-008 | governance validation | agent rules still pass | `npm run agents:check` | config/template/rule checks passed | 2026-06-19T19:52:50Z | Integration Lead / CEO Agent |
| E-009 | report | Product/Data confirmation report exists | `BATCH_B_SEMANTIC_CONFIRMATION.md` | recommends deleting all 12 Batch B duplicates in a follow-up task, no merge | 2026-06-19T19:53:05Z | Integration Lead / CEO Agent |
| E-010 | final boundary check | Batch B files were not deleted during this confirmation task | `git status --short -- <12 Batch B paths>` | all 12 paths still showed `??` after report/memory sync | 2026-06-19T19:54:00Z | Integration Lead / CEO Agent |
| E-011 | final governance validation | agent rules still pass after memory sync | `npm run agents:check` | config/template/rule checks passed | 2026-06-19T19:54:00Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
