---
updated_at: "2026-07-09T07:19:51Z"
---
# TASK-20260709-009-customer-phone-name-keypad

## Objective

Split new-order customer intake into phone-only and name-only search fields, replace the phone field with an in-app virtual numeric keypad, and keep realtime customer/history-device results visible in the mobile flow.

## Owner Request

The owner asked for the phone search box and customer-name search box to be separated: phone accepts only phone numbers, name accepts only names, and the phone box should use a virtual numeric keypad. The owner also asked to plan and execute how realtime search results should display while typing.

## Scope

- New order customer information section.
- Shared customer intake lookup component.
- Shared mobile phone keypad draft helpers.
- New reusable `PhoneKeypadInput`.
- Mobile E2E coverage for phone keypad, phone results, name numeric rejection, IMEI numeric input, and money keypad regression.

## Implementation Summary

- Added `PhoneKeypadInput` with `+39`, digits, backspace, clear, and done controls.
- Added phone keypad normalization/edit helpers under `src/shared/lib/mobile-input.ts`.
- Extended `CustomerIntakeLookup` with `mode="phone" | "name"` and `resultsPlacement="inline"`.
- Phone mode no longer renders a native `inputmode="tel"` input in new order; it uses the in-app keypad trigger.
- Name mode keeps a normal text input and shows a warning instead of searching when digits are typed.
- Phone realtime result panel is shown above the phone input while the keypad opens downward, so the full keypad and current search result remain visible.
- New order copy now states phone/name searches are separated.

## Files

- `src/components/orders/phone-keypad-input.tsx`
- `src/components/orders/phone-keypad-input.test.tsx`
- `src/features/orders/forms/customer-intake-lookup.tsx`
- `src/features/orders/forms/new-order-customer-device-section.tsx`
- `src/shared/lib/mobile-input.ts`
- `src/shared/lib/mobile-input.test.ts`
- `tests/e2e/mobile-input-keyboard.spec.ts`
- `screenshots/TASK-20260709-009-customer-phone-name-keypad/`

## Classification

- Task class: T2 UI / customer intake workflow improvement
- Risk: R2
- Autonomy: L2 controlled execution
- Departments considered: FLOW, UX, FE, QA, SEC
- Subagents spawned: none
- No-spawn reason: implementation was isolated in a clean worktree with no schema/auth/data mutation; single writer plus automated QA was lower risk than parallel agents over the same customer form files.
