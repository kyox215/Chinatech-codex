---
task_id: TASK-20260703-007-order-queue-progress-parts-supplier
updated_at: "2026-07-03T23:36:11+02:00"
status: pushed_apply_blocked
risk_level: R2
autonomy_level: L2
owner: CEO-Orchestrator
---
# TASK-20260703-007-order-queue-progress-parts-supplier

## Objective

Improve the desktop order queue so it shows a clear compact current-progress indicator without exposing every workflow node, and allow staff to mark a parts-purchase supplier directly from the desktop list without opening order detail.

## Owner Decisions

- The supplier in this workflow means parts-purchase supplier, not external repair/mail-in supplier.
- Do not record supplier price in this version.
- Do not record supplier link or SKU in this version.
- Selecting the supplier must not automatically change order or parts status.
- Supplier list management belongs in Settings, not inline creation from the order row.

## In Scope

- Desktop order queue row progress display.
- Desktop row quick selector for `parts_supplier_id`.
- Client type, API schema, repository, mock, and local migration contract for the new field.
- Focused tests and local validation for the changed paths.

## Out of Scope

- Production migration execution.
- Supplier price comparison, cart automation, supplier ordering integration, link/SKU storage, or automatic parts status transitions.
- Reworking existing external repair supplier semantics stored in `supplier_id`.
- Broad settings page redesign beyond preserving the supplier-list-as-source-of-truth assumption.

## Acceptance Criteria

- Desktop queue row shows current stage, step count, compact segmented progress, and next action without listing every stage label.
- The row has a clearly named parts supplier chip such as `配件供：未选` or `配件供：Mobilax`.
- Clicking the chip opens a bounded selector with existing suppliers and clear/cancel behavior; row click does not open details while using the selector.
- Saving the selector persists only `parts_supplier_id` and refreshes the order list/detail caches.
- `supplier_id` remains available for external repair semantics and is not overloaded.
- New field is nullable, backward compatible, store-scoped, and local migration-only unless separately approved for production.

## Agent Plan

No real sub-agent spawned. Reason: current multi-agent tool policy says not to spawn sub-agents unless the user explicitly asks for sub-agents, delegation, or parallel agent work. Department review is handled by the main thread with read-only DATA/API, UX, and QA passes, while keeping a single writer.

## Verification Plan

- Type/schema focused tests for patch input and mock/server behavior where available.
- `npm run lint` / focused lint if full dirty-worktree state contaminates the run.
- `npm run typecheck`.
- UI preview screenshot for `/orders` if local authenticated browser verification is available; otherwise record the auth/environment blocker and provide command evidence.

## Implemented Result

- Added a nullable independent `parts_supplier_id` order field for parts-purchase supplier marking.
- Added local Supabase migration `supabase/migrations/20260703210959_order_parts_supplier_marker.sql`; production migration execution is not included in this task.
- Desktop order queue now shows compact current progress as `N/5` with short segments, not every workflow stage label.
- Desktop order queue rows now expose an inline `配件供：...` selector sourced from Settings suppliers.
- Selector updates only `parts_supplier_id`, validates supplier existence in the same store, and does not change order status, parts status, price, SKU, or link fields.

## Verified

- `npm run test -- src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test` passed.
- `npm run build` passed after rerunning outside the sandbox permission issue documented in evidence.
- Browser preview verified `/orders` in mock/auth-bypass mode at desktop viewport with inline supplier selector and compact progress visible.

## Release Result

- Commit `ad32c53` (`Improve order queue supplier workflow`) was pushed to `origin/main`.
- Production Supabase migration was not applied. Apply is blocked by remote migration history mismatch and missing/invalid `SUPABASE_DB_PASSWORD`.

## Rollback

- Revert the migration file and changed order API/UI/mock/type files.
- Because the new DB field is nullable and not used to alter workflow state, rollback does not require data transformation for local code.
