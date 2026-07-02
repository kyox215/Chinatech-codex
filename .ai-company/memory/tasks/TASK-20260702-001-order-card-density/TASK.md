# TASK-20260702-001 Order Card Density

## Status

verified

## Owner Goal

Replan the `/orders` order-management task cards so desktop rows are aligned, simpler, denser, and visually lighter, and remove the inline advance action from the list.

## Scope

- In scope: desktop order queue row layout, row action surface, health-strip wording, visual/overflow verification.
- Out of scope: database, order workflow state machine, payment rules, approval rules, WhatsApp logic, production deployment, unrelated dirty worktree changes.

## Decisions

- Lists are for scanning and opening details; state transition handling stays in order details or existing bulk flow.
- Removed per-row advance buttons and per-row advance menu entries.
- Kept row click behavior for detail dialog and kept low-frequency menu actions for opening in a new page and printing.
- Used a flatter dense row surface with no hover lift to improve perceived alignment.

## Files Changed

- `src/features/orders/components/order-list-desktop-row.tsx`
- `src/features/orders/screens/order-list-screen.tsx`

## No-Spawn Reason

Single-agent execution. The task was a focused, low-risk UI layout adjustment with one writer and no database/API/security changes; spawning sub-agents would add coordination overhead and risk touching the same files.
