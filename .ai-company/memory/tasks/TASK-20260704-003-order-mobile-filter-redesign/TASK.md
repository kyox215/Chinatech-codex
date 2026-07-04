---
schema_version: 1
task_id: "TASK-20260704-003-order-mobile-filter-redesign"
title: "Redesign mobile order status filters"
status: "verified"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
created_at: "2026-07-04T13:58:15Z"
updated_at: "2026-07-04T14:08:10Z"
---
# Task

## Objective

Replace the mobile `/orders` top status filters from circular timeline nodes to compact non-circular segmented filter buttons.

## Scope

- In scope: `src/features/orders/components/order-list-mobile-header.tsx`, focused evidence, task memory, and one mobile screenshot.
- Out of scope: order card layout, desktop filters, database/API changes, supplier features, and unrelated dirty worktree files.

## Acceptance Criteria

- Mobile status filter row no longer uses circular nodes or connector rail.
- Each filter shows stage label and count in one compact button.
- Active state is visually clear and non-circular.
- Mobile `/orders` at 393px has no page-level horizontal overflow.
- Scoped files are committed and pushed to `origin/main`. Pending until git step finishes.

## Verification Plan

- `./node_modules/.bin/eslint src/features/orders/components/order-list-mobile-header.tsx`
- `git diff --check -- src/features/orders/components/order-list-mobile-header.tsx`
- `npm run typecheck`
- Browser verification at 393px for `/orders`, including screenshot and overflow check.

## Verification Result

- PASS: focused ESLint for `order-list-mobile-header.tsx`.
- PASS: scoped `git diff --check`.
- PASS: `npm run typecheck`.
- PASS: `npm run lint`.
- PASS: order workflow model tests.
- PASS: `npm run build` after rerunning outside sandbox because Turbopack needed local process/port access.
- PASS: `/orders` at 393px with E2E mock mode had six visible rectangular filter buttons, no circular buttons, and no horizontal overflow.
