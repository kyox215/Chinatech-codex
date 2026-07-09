---
updated_at: "2026-07-09T00:39:33Z"
---
# TASK-20260709-006-order-money-virtual-keypad

## Objective

Replace order-related money entry fields with an in-app virtual money keypad so mobile users can enter, delete, clear, and confirm amounts without opening the native keyboard.

## Owner Request

The owner asked to change amount entry from the phone keyboard to an app virtual keypad, covering the new order screen, order detail editing, edit order flow, and all order amount inputs.

## Scope

- New order quotation item prices and deposit.
- Edit order quotation item prices and deposit.
- Order overview inline finance editor.
- Mobile order detail finance editor.
- Payment collection dialog amount input.
- Shared amount draft normalization and keypad button behavior.
- Browser verification for mobile new-order amount entry.

## Implementation Summary

- Added shared `MoneyKeypadInput` with digit, double-zero, decimal point, backspace, clear, and done controls.
- Moved money draft normalization and keypad edit rules into `src/shared/lib/mobile-input.ts`.
- Replaced native amount `Input` fields in order finance surfaces with the shared virtual keypad trigger.
- Kept phone and IMEI fields on native numeric/tel keyboard hints.
- Preserved text inputs for repair item names and notes.

## Files

- `src/components/orders/money-keypad-input.tsx`
- `src/components/orders/money-keypad-input.test.tsx`
- `src/shared/lib/mobile-input.ts`
- `src/shared/lib/mobile-input.test.ts`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/features/orders/forms/edit-order-dialog.tsx`
- `src/features/orders/forms/payment-dialog.tsx`
- `src/features/orders/components/order-overview-tab.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `tests/e2e/mobile-input-keyboard.spec.ts`
- `screenshots/TASK-20260709-006-order-money-virtual-keypad/`

## Classification

- Task class: T1 UI interaction improvement
- Risk: R1
- Autonomy: L2 controlled execution
- Departments considered: Product/UI, Engineering, QA
- Subagents spawned: none
- No-spawn reason: localized shared-component replacement; single writer avoids file ownership overlap.
