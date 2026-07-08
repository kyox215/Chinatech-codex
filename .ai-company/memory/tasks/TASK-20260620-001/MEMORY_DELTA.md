# MEMORY_DELTA — TASK-20260620-001

## Candidate project facts

- Order detail manual status transition now allows any enabled concrete order status except the current status.
- Desktop order detail status transition is inline inside the current order detail workspace, not a second "状态流转" Dialog.
- Mobile order detail keeps the bottom Sheet transition flow and shares the same transition body.
- `transitionOrder` still blocks canonical workflow group names, disabled/current targets, approval-decision bypasses, missing required reasons, and unpaid completion.
- Successful manual transitions write `status_changed` timeline events.

## Candidate department updates

- Product: manual transition is a deliberate correction path for enabled concrete statuses while approval and finance protections remain enforced.
- Frontend: desktop order detail uses `DesktopStatusTransitionPanel`; mobile uses `MobileStatusTransitionSheet`; both use `getWorkflowTransitionActions()`.
- QA: targeted order desktop E2E passed after clearing stale local Next server chunks; broader desktop E2E has an unrelated `/platform` timeout.

## Candidate decisions / ADRs

- No ADR required. This is a bounded workflow/UI behavior change inside existing order module contracts.

## Candidate lessons

- For manual order correction, `transitionOrder` may allow any enabled concrete order status while preserving safety guards: no canonical workflow-group targets, no same-state transition, required reason states, approval-bypass protection, and paid-before-completed protection.
- Desktop order detail should show status-flow choices inline inside the detail workspace; mobile can keep the bottom Sheet pattern.
- When Playwright shows missing mock chunks or empty data after code churn, check for stale local Next servers before changing feature code or E2E assertions.
