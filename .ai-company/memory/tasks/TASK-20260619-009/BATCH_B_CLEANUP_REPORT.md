# Batch B Cleanup Report — TASK-20260619-009

- Task: `TASK-20260619-009`
- Scope: delete exactly the 12 Batch B duplicate files confirmed stale by `TASK-20260619-008`.
- Boundary: no canonical business code, canonical migration history, production data, dependencies, staging, commits, pushes, deploys, or Batch C files were changed.
- Status: verified cleanup.

## Executive Result

The 12 Batch B duplicate ` 2` files were deleted. These files had been confirmed stale in `TASK-20260619-008` and were not valid source material for order workflow or migration semantics.

Current authoritative semantics remain:

1. `mail_in_progress` belongs to repair/external-repair work.
2. `repaired` remains repair-stage until notification/pickup handling.
3. `quoted -> parts_ordered` remains a valid transition.

## Deleted Files

| # | Deleted path | Basis |
|---:|---|---|
| 1 | `src/features/orders/model/canonical-order-status 2.ts` | Batch B stale duplicate; current canonical file maps repair semantics correctly. |
| 2 | `src/features/orders/model/canonical-order-status.test 2.ts` | Stale/missing current assertions. |
| 3 | `src/features/orders/model/order-side-statuses 2.ts` | Stale external repair badge semantics. |
| 4 | `src/features/orders/model/order-side-statuses.test 2.ts` | Stale external repair badge expectation. |
| 5 | `src/features/orders/model/order-task-flow 2.ts` | Missing current `mail_in_progress` / `repaired` guidance. |
| 6 | `src/features/orders/model/order-task-flow.test 2.ts` | Missing current repaired-stage task guidance. |
| 7 | `src/features/orders/model/order-transition-reasons 2.ts` | Missing current external repair reason presets. |
| 8 | `src/features/orders/model/order-workflow 2.ts` | Stale fallback grouping. |
| 9 | `src/features/orders/model/order-workflow.test 2.ts` | Stale status group expectation. |
| 10 | `supabase/migrations/20260611164138_order_workflow_statuses 2.sql` | Stale duplicate transition/status seed. |
| 11 | `supabase/migrations/20260611202504_repairdesk_canonical_order_status 2.sql` | Stale duplicate migration semantics. |
| 12 | `supabase/migrations/20260613113000_repairdesk_order_contract_compat 2.sql` | Stale duplicate migration semantics. |

## Verification

| Gate | Result |
|---|---|
| Pre-delete target status | all 12 target files were `??` untracked files and existed on disk. |
| Pre-delete Batch C status | `scripts/check-agent-rules 2.mjs` and `tests/e2e/visual-overflow.spec 2.ts` existed and were `??`; not in deletion scope. |
| Delete operation | `apply_patch` deleted exactly the 12 approved paths. |
| Post-delete target status | `git status --short -- <12 Batch B paths>` returned no output. |
| Post-delete Batch C status | both protected Batch C files still existed and still appeared as `??`. |
| Governance check | `npm run agents:check` passed. |
| Targeted tests | `npm run test -- src/features/orders/model/canonical-order-status.test.ts src/features/orders/model/order-workflow.test.ts src/features/orders/model/order-task-flow.test.ts src/features/orders/model/order-side-statuses.test.ts src/features/orders/testing/mock-api.test.ts` passed: 5 test files, 40 tests. |

## Residual Risks

| Risk | Level | Owner | Follow-up |
|---|---|---|---|
| Batch C backlog/salvage files remain. | P2 | Operations + QA | Separate owner-approved Batch C decision task. |
| Many other duplicate-like files remain in the dirty worktree. | P2 | Operations + QA | Continue staged cleanup with explicit path lists. |
| Local canonical migration history may not match production Supabase state. | P2 | Data + Security | Owner-approved remote migration parity audit before production DB work. |
| Separate task record `TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca` remains active but was not part of this cleanup. | P2 | Memory + Integration Lead | Review/resume or explicitly close in a separate memory hygiene task. |

## Next Recommended Task

Continue staged cleanup with one of:

- Batch C decision: decide whether to salvage or delete `scripts/check-agent-rules 2.mjs` and `tests/e2e/visual-overflow.spec 2.ts`.
- Byte-identical duplicate cleanup: delete remaining identical ` 2` files after a fresh path-level approval list.
