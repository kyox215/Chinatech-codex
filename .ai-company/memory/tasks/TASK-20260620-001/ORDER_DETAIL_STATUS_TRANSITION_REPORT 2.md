# Order Detail Status Transition Report

- Task: `TASK-20260620-001`
- Date: 2026-06-20 CEST
- Owner: Integration Lead / CEO Agent
- Autonomy: L2 controlled execution
- Risk: R2
- Status: implemented and verified for target flow

## Summary

Order detail manual status transition now supports choosing any enabled concrete
order status except the current status. The transition still rejects canonical
workflow group names, disabled/current targets, approval-decision bypasses,
missing required reasons, and unpaid completion. Successful transitions write a
`status_changed` timeline event.

Desktop order detail no longer opens a second "状态流转" Dialog for manual
status changes. The flow panel is rendered inline inside the current order
detail workspace. Mobile keeps the bottom Sheet interaction and shares the same
transition option body.

## Behavior map

| Requirement | Evidence |
|---|---|
| Manual flow can choose any enabled concrete status except current | `getWorkflowTransitionActions()` in `src/features/orders/model/order-workflow.ts`; model test |
| Status changes write timeline events | `transitionOrder()` in server/mock API; mock API test and local API check |
| Desktop uses inline panel, not second Dialog | `DesktopStatusTransitionPanel` in `src/features/orders/screens/order-detail-screen.tsx`; targeted Playwright E2E |
| Mobile continues using Sheet | `MobileStatusTransitionSheet` in `src/features/orders/screens/order-detail-screen.tsx` |
| Reason, approval, unpaid-completion protections remain | server/mock `transitionOrder()` checks; existing and new mock tests |

## Validation

| Gate | Result |
|---|---|
| `npx vitest run src/features/orders/model/order-workflow.test.ts src/features/orders/testing/mock-api.test.ts` | passed, 2 files / 35 tests |
| `npm run typecheck` | passed |
| `npm run lint` | passed |
| `npm run test` | passed, 38 files / 228 tests |
| targeted order detail desktop E2E | passed, 3 desktop viewport tests |
| non-sandbox `npm run build` | passed |
| `npm run agents:check` | passed |

## E2E notes

- The sandboxed desktop E2E build failed with the known Turbopack port-binding
  environment error.
- The first non-sandbox desktop E2E run failed before feature assertions because
  stale local Next servers returned missing server chunks. Those stale servers
  were stopped, and the targeted order detail E2E rerun passed.
- The broader `npm run test:e2e:desktop` suite then had 8 passing tests and one
  unrelated `/platform` 1440px `networkidle` timeout. This is not classified as
  an order-status-flow regression.

## Scope boundaries

- No database schema or migration changes were made for this task.
- No production data, deployment, payment, tenant, or customer communication
  changes were performed.
- The working tree contains unrelated dirty files from adjacent tasks; this
  report only claims the order detail status transition scope.

## Follow-up

- Track the unrelated `/platform` desktop E2E `networkidle` timeout under QA if
  it repeats.
- Keep the broader dirty-worktree attribution explicit before staging or commit.
