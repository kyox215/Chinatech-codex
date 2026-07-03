---
task_id: TASK-20260703-007-order-queue-progress-parts-supplier
updated_at: "2026-07-03T23:36:11+02:00"
---
# Handoff

Continue from `main` in the RepairDesk repo. Inspect dirty worktree before editing and preserve unrelated changes.

This task is implemented, validated locally, committed, and pushed to `origin/main` as `ad32c53`.

Production migration is blocked. Before applying `20260703210959_order_parts_supplier_marker.sql`, restore valid Supabase DB authentication and resolve the remote migration versions that are present in history but missing locally. Do not run migration repair or direct SQL as a shortcut without a verified migration-history plan.

Do not overload `supplier_id`; the new parts-purchase supplier marker is `parts_supplier_id`.
