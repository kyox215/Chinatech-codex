---
task_id: "TASK-20260710-003-mobile-order-a4-half-print"
title: "Mobile Order A4 Half Print"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead"
updated_at: "2026-07-09T22:37:39Z"
closed_at: "2026-07-09T22:37:39Z"
---
# TASK-20260710-003 Mobile Order A4 Half Print

Status: closed
Owner goal: Implement mobile-friendly order printing so phones can keep A4 portrait while the printed content occupies only the upper A5 landscape half, then push `main`.
Business value: Reduce paper/orientation adjustments on iPhone and Android order printing at the shop.

## Scope

- Order detail print.
- Order list/bulk print.
- Shared print portal support for scoped A4 portrait half-page print CSS.
- Documentation and focused tests.
- Scoped commit and push to `main`.

## Out Of Scope

- Inventory receipt print behavior.
- Direct printer bridge, QZ Tray, CUPS, native mobile app, or printer hardware setup.
- Database, permissions, payment, order state, notification, deployment, or customer communication changes.
- Reverting unrelated dirty worktree changes.

## Risk And Autonomy

- Risk: R2 because this is customer-facing printed PII layout behavior.
- Autonomy: L2 for local code/docs/tests and owner-requested push to `main`.
- No-spawn reason: Owner requested direct execution, not sub-agents; implementation is a narrow UI/print change and a single writer avoids staged-worktree conflicts.

## Acceptance Criteria

- Order detail print injects A4 portrait print page CSS.
- Order list/bulk print injects A4 portrait print page CSS.
- Printed order content remains A5 landscape sized in the upper half of the page.
- Non-order print surfaces keep the default A5 landscape mode unless separately changed.
- Focused tests verify print CSS injection and cleanup.
- Commit includes only scoped files for this task.

## Dirty Worktree Baseline

Before this task, unrelated staged/unstaged mobile performance changes were present, including files under `src/features/buyback`, `src/features/customers`, `src/features/inventory`, `src/features/orders/components/order-list-items.tsx`, `src/features/orders/screens/order-list-screen.tsx`, screenshots, and task memory. Do not revert or include them in the print commit.
