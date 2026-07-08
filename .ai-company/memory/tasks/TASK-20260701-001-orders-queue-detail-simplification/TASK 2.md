# TASK-20260701-001 Orders Queue Detail Simplification

Status: completed
Owner: Integration Lead / CEO Agent
Started: 2026-07-01T01:04:05+02:00
Autonomy: L2 controlled execution
Risk: R2 medium UI/workflow regression risk

## Owner Goal

Simplify `/orders` into a task-first processing queue and unify desktop order detail into a one-page workspace. The first desktop list scan should answer what needs handling: current stage, risk, next step, and owner. Full details should stay behind the detail dialog.

## Scope

In scope:
- Desktop order list information hierarchy.
- Desktop order detail workspace layout.
- Existing inline status transition, payment, notification, edit, and photo actions.
- Mobile list/detail regression checks only.

Out of scope:
- Database or Supabase migrations.
- Workflow state machine changes.
- Payment, approval, WhatsApp, auth, tenant, or permission logic changes.
- New production data writes outside ordinary local validation.

## Agents

- Main thread: Integration Lead, integration_write, single business-code writer.
- UX reviewer Aster (`019f1ac2-fe64-75c2-a301-28420ec95d84`): read_only, information architecture and responsive review.
- QA reviewer Verity (`019f1ac2-ff6e-7ad1-af2b-03dc9158148a`): read_only, verification matrix and regression risks.

## Acceptance

- `/orders` desktop row prioritizes order/customer, device/fault, stage/next action, amount risk, owner/time.
- Desktop queue top metrics show only current queue, risk, and directly advanceable items.
- Desktop detail dialog displays overview and records in one scrollable workspace without requiring tab switching.
- Reason-required transitions remain unavailable from quick row/bulk actions.
- Mobile order list/detail remain functionally unchanged and overflow-free.
- Validation and screenshots are recorded in `EVIDENCE.md`.

## Outcome

- `/orders` desktop now reads as a processing queue: stage/next action is the first scan column, followed by order/customer, device/fault, amount/risk, owner/time, and actions.
- Top queue metrics were reduced to current queue, risk, and directly advanceable work.
- Desktop order detail now keeps overview and records in one scrollable workspace; the record context strip scrolls to the inline records area instead of changing tabs.
- Mobile order list and mobile order detail were screenshot-checked without horizontal overflow regression.
- No database schema, workflow state machine, payment, approval, permission, tenant, or WhatsApp sending rules were changed.
