# Handoff

## Current State

The mobile order detail payment summary has been simplified to three rows: total, paid deposit, and outstanding balance.

## Scoped Files

- `src/features/orders/screens/order-detail-screen.tsx`
- `.ai-company/memory/ACTIVE_CONTEXT.md`
- `.ai-company/memory/tasks/TASK-20260703-006-order-payment-summary-clarity/`

## Important Diff Note

`src/features/orders/screens/order-detail-screen.tsx` also contains unrelated pre-existing WIP for request `signal` handling and workflow-grid styling. Do not stage those hunks as part of this task unless they are explicitly approved separately.

## Validation

- Focused ESLint passed.
- Full TypeScript check passed.
- Diff whitespace check passed.
