# TASK-20260630-001 Order New Detail Alignment

Status: verified
Owner: Integration Lead
Approver: Owner / Hexiang Huang
Risk: R1
Autonomy: L2
Created: 2026-06-30

## Goal

Align the new order workspace and order detail surfaces so `/orders` new-order dialog, `/orders/new`, order detail dialog, and `/orders/[id]` share the same RepairDesk visual language for section titles, quote rows, and money summaries.

## Scope

- New order customer/device, fault/diagnosis, quotation, and submit-bar presentation.
- Order detail finance display and desktop/mobile money summary presentation.
- E2E and overflow assertions for the aligned UI.

## Out Of Scope

- Backend API, database schema, React Query keys, payload shape, pricing logic, payment logic, status workflow, permissions, and attachment logic.
- Legacy `src/routes/*`.
- Unrelated dirty worktree files.

## Decisions

- Use the current order detail page as the visual source of truth.
- Keep the desktop new-order three-column workspace and internal close button.
- Add order-local UI primitives instead of introducing a new app-wide design system.
- Keep existing dirty changes in `order-overview-tab.tsx` and E2E tests; merge on top without reverting.

## No-Spawn Reason

Single-agent execution. The task was low-risk, local UI implementation with one writer and existing explicit plan; spawning sub-agents would add coordination overhead and risk write conflicts in the same order UI files.
