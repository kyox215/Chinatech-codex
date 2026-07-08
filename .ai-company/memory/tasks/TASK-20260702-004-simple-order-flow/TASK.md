---
updated_at: "2026-07-02T21:43:34Z"
---
# TASK-20260702-004 Simple Order Flow

Status: completed
Owner: Integration Lead / CEO Agent
Started: 2026-07-02T23:36:15+02:00
Completed: 2026-07-02T23:36:15+02:00
Autonomy: L2 controlled execution
Risk: R2 medium UI/workflow regression risk

## Owner Goal

Implement the approved simplified order process so staff see the daily workflow as:

1. 接单
2. 检测报价
3. 维修处理
4. 通知取机
5. 收款完成

The UI should be simpler without breaking the existing backend workflow, transition guards, permissions, payments, approvals, or historical order data.

## Scope

In scope:
- Order list phase filters and counters.
- Desktop and mobile order workflow rails.
- Order row and card primary status badges.
- Order detail and task progress display.
- Focused tests and docs that describe order UI generation standards.

Out of scope:
- Supabase/database schema or migrations.
- Canonical backend `workflowStatus` values.
- Payment, approval, WhatsApp, tenant, auth, or permission logic.
- Production data writes, deploys, commits, or pushes.

## Agents

- Main thread: Integration Lead, single writer.
- Considered but not spawned: UX/QA departments.

No-spawn reason: available multi-agent tool policy requires explicit user request for subagents in this session; the owner asked to implement the approved plan, not to run department execution. Main thread performed implementation and verification.

## Acceptance

- The main visible order lifecycle shows five phases: 接单, 检测报价, 维修处理, 通知取机, 收款完成.
- Existing canonical workflow statuses remain available under the simplified phases.
- `diagnosis` and `quote` aggregate under 检测报价.
- `parts` and `repair` aggregate under 维修处理.
- Reason-required transitions and existing workflow guards stay unchanged.
- Desktop and mobile order pages render the simplified flow without blank or login-only captures.
- Validation and screenshots are recorded in `EVIDENCE.md`.

## Outcome

- Added `src/features/orders/model/order-simple-flow.ts` as the UI aggregation layer for the five-phase flow.
- Updated order task guidance/progress, list filters, list rows/cards, hero, detail, and task screens to use the simplified stages for staff-facing primary flow.
- Preserved canonical workflow values for API filters, detail status, transitions, side badges, and advanced status filtering.
- Updated order task-flow tests and UI standard docs to lock the simplified flow behavior.
- Completed lint, typecheck, tests, build, and browser screenshot evidence.
