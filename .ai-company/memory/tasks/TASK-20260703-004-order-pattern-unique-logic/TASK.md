# TASK-20260703-004-order-pattern-unique-logic

## Objective

Fix the order device unlock pattern editor so repeated taps on an already selected point do not overwrite the visible step order, and make the start/end of the pattern clear.

## Owner Request

The owner reported that tapping points 1, 2, 3, then tapping 1 again makes the original point display as step 4, making it unclear where the pattern starts and ends. The owner asked to repair and clarify the rule/logic.

## Scope

- Mobile and shared order device unlock pattern editor.
- Client-side normalization/validation.
- API schema validation and mock API behavior.
- Tests for model, schema, and mock API behavior.
- No production database migration or data mutation.

## Implementation Summary

- Pattern points are now unique: repeated taps on an already selected point are ignored.
- The editor shows start and end text, and announces which step an ignored duplicate point already belongs to.
- Save is disabled while the current password draft is invalid, such as fewer than 4 pattern points.
- Pattern rule is now 4-9 unique Android-style points instead of the older repeated 4-128 trajectory behavior.
- API schema and model normalization reject duplicate points.

## Files

- `src/features/orders/components/device-unlock-fields.tsx`
- `src/features/orders/model/device-unlock.ts`
- `src/features/orders/model/device-unlock.test.ts`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/testing/mock-api.test.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/api/repairdesk-schemas.test.ts`
- `screenshots/TASK-20260703-004-order-pattern-unique-logic/order-pattern-duplicate-ignored-393.png`
- `screenshots/TASK-20260703-004-order-pattern-unique-logic/order-pattern-valid-4-points-393.png`

## Classification

- Task class: T1 UI/logic fix
- Risk: R1
- Autonomy: L2 controlled execution
- Departments considered: Product/UI, Engineering, QA
- Subagents spawned: none
- No-spawn reason: narrow single-component interaction and validation fix; main-thread implementation avoided write overlap and was faster to verify.
