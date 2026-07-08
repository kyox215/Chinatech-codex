# Batch B Semantic Confirmation — TASK-20260619-008

- Task: `TASK-20260619-008`
- Scope: Product/Data confirmation for Batch B duplicate files from `TASK-20260619-005` rows #17-25 and #29-31.
- Boundary: no Batch B/C files were deleted, merged, staged, reverted, or business-code edited.
- Decision status: confirmed for cleanup after Owner approval; do not merge duplicate content.

## Executive Decision

Batch B duplicates are stale conflict evidence, not valid source material. The current canonical product/data direction is:

1. `mail_in_progress` belongs to the repair/external-repair stage, not intake.
2. `repaired` remains in the repair stage until customer notification/pickup handling, not pickup directly.
3. `quoted -> parts_ordered` remains a valid transition.

Recommendation: approve a follow-up cleanup task to delete all 12 Batch B duplicates. Do not merge their contents into canonical files. Do not rewrite historical canonical migrations; rely on later forward migrations that correct older seeded/backfilled semantics.

## Decision Evidence

| Conflict | Confirmed current rule | Evidence |
|---|---|---|
| `mail_in_progress` stage | `mail_in_progress` is repair/external-repair work. | `src/features/orders/model/canonical-order-status.ts` maps it to `repair`; `src/features/orders/model/order-workflow.ts` groups it in repair; `src/features/orders/model/order-task-flow.ts` gives external repair guidance; `supabase/migrations/20260619103000_order_external_repair_workflow.sql` updates workflow status bucket and `repair_orders.workflow_status` to `repair`; targeted tests passed. |
| `repaired` stage | `repaired` is still repair until notification/pickup. | `canonical-order-status.ts`, `order-workflow.ts`, and `order-task-flow.ts` map/guide it as repair; `supabase/migrations/20260618172000_repaired_workflow_status_repair.sql` updates both workflow status bucket and repair order rows to `repair`; targeted tests passed. |
| `quoted -> parts_ordered` transition | Direct transition remains valid. | `supabase/migrations/20260611164138_order_workflow_statuses.sql` seeds `quoted -> parts_ordered`; `src/lib/mock/workflow.ts` includes it; `src/features/orders/server/order.repository.ts` allows approval targets `repairing`, `parts_ordered`, and `mail_in_progress`; `src/features/orders/testing/mock-api.test.ts` verifies direct quoted approval to parts ordering; targeted tests passed. |

## Important Migration Note

Some older canonical historical migrations still show older intermediate semantics:

- `20260611202504_repairdesk_canonical_order_status.sql` maps `mail_in_progress` to `intake`.
- `20260613113000_repairdesk_order_contract_compat.sql` maps `mail_in_progress` to `intake`.
- `20260611164138_order_workflow_statuses.sql` originally seeded `mail_in_progress` as `intake` and `repaired` as `pickup`.

These are superseded by later forward migrations:

- `20260611175701_order_workflow_repaired_bucket.sql`
- `20260618172000_repaired_workflow_status_repair.sql`
- `20260619103000_order_external_repair_workflow.sql`

Therefore, cleanup should delete only duplicate ` 2` files. It should not edit historical canonical migrations unless a separate data-migration task intentionally creates a new forward fix after remote Supabase parity is verified.

## File-Level Confirmation

| # | Duplicate file | Finding | Recommendation |
|---:|---|---|---|
| 17 | `src/features/orders/model/canonical-order-status 2.ts` | Stale status mapping: places `mail_in_progress` in intake and `repaired` in pickup. | Delete after Owner approval; do not merge. |
| 18 | `src/features/orders/model/canonical-order-status.test 2.ts` | Missing current repair-stage assertions. | Delete after Owner approval; do not merge. |
| 19 | `src/features/orders/model/order-side-statuses 2.ts` | Stale wording/tone for external repair badge. | Delete after Owner approval; do not merge. |
| 20 | `src/features/orders/model/order-side-statuses.test 2.ts` | Stale expectation for external repair badge label. | Delete after Owner approval; do not merge. |
| 21 | `src/features/orders/model/order-task-flow 2.ts` | Missing explicit `mail_in_progress` and `repaired` guidance. | Delete after Owner approval; do not merge. |
| 22 | `src/features/orders/model/order-task-flow.test 2.ts` | Missing current repaired-stage task guidance test. | Delete after Owner approval; do not merge. |
| 23 | `src/features/orders/model/order-transition-reasons 2.ts` | Missing required external repair reason presets. | Delete after Owner approval; do not merge. |
| 24 | `src/features/orders/model/order-workflow 2.ts` | Stale fallback grouping excludes `mail_in_progress` from repair. | Delete after Owner approval; do not merge. |
| 25 | `src/features/orders/model/order-workflow.test 2.ts` | Stale group expectation places `mail_in_progress` in intake. | Delete after Owner approval; do not merge. |
| 29 | `supabase/migrations/20260611164138_order_workflow_statuses 2.sql` | Stale transition seed lacks `quoted -> parts_ordered`; also old status buckets are superseded by later canonical migrations. | Delete after Owner approval; do not merge. |
| 30 | `supabase/migrations/20260611202504_repairdesk_canonical_order_status 2.sql` | Stale duplicate maps `repaired` to pickup. Canonical historical migration is superseded by later forward fixes. | Delete after Owner approval; do not merge. |
| 31 | `supabase/migrations/20260613113000_repairdesk_order_contract_compat 2.sql` | Same stale `repaired` mapping conflict. Canonical historical migration is superseded by later forward fixes. | Delete after Owner approval; do not merge. |

## Verification

Ran:

- `npm run test -- src/features/orders/model/canonical-order-status.test.ts src/features/orders/model/order-workflow.test.ts src/features/orders/model/order-task-flow.test.ts src/features/orders/model/order-side-statuses.test.ts src/features/orders/testing/mock-api.test.ts`
- `npm run agents:check`

Results:

- 5 test files passed.
- 40 tests passed.
- Agent config/template/rule checks passed.

## Cleanup Approval Package

Recommended next task:

`L2-005`: delete the 12 Batch B duplicate files listed above.

Required guardrails:

- Delete only these 12 duplicate ` 2` files.
- Do not edit canonical app/business files.
- Do not edit canonical migration history.
- Verify deleted paths are gone, Batch C remains, and `npm run agents:check` plus the same targeted order tests pass.

## Residual Risks

| Risk | Level | Owner | Follow-up |
|---|---|---|---|
| Historical canonical migrations show older intermediate semantics before later forward fixes. | P2 | Data + Integration Lead | Do not edit history; if production parity is uncertain, run a remote migration parity audit before production operations. |
| Remaining duplicate-like files outside Batch B can still confuse search/review. | P2 | QA + Operations | Continue staged cleanup with explicit file lists. |
| Active worktree contains unrelated business-code changes. | P1 | Integration Lead + Owner | Do not attribute unrelated changes to this review; isolate before commit/release. |
