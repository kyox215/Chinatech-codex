# Handoff - TASK-20260709-013-virtual-keyboard-dock

## Resume Context

This task implements the owner's approved plan for fixed bottom custom virtual keyboards and overlay avoidance in the RepairDesk order UI.

## Files Owned By This Task

- `src/components/ui/virtual-keyboard-dock.tsx`
- `src/components/orders/money-keypad-input.tsx`
- `src/components/orders/money-keypad-input.test.tsx`
- `src/features/orders/components/device-unlock-fields.tsx`
- `src/features/orders/components/device-unlock-fields.test.tsx`
- `src/features/orders/forms/customer-intake-lookup.tsx`
- `src/features/orders/forms/customer-phone-lookup.tsx`
- `src/features/orders/forms/new-order-customer-device-section.tsx`
- `src/components/orders/fault-diagnosis-picker.tsx`
- `src/components/ui/multi-select-dropdown.tsx`
- `.ai-company/memory/tasks/TASK-20260709-013-virtual-keyboard-dock/*`

## Known Unrelated Dirty Areas

- Kiosk/staff review files under `src/features/kiosk`, `src/server/api/kiosk-public-source*`, `src/features/settings`, `src/lib/repairdesk/*`, and `.ai-company/memory/ACTIVE_CONTEXT.md`.
- Existing task directories `TASK-20260709-008-kiosk-staff-review`, `TASK-20260709-011-private-store-suppliers`, and `TASK-20260709-012-phone-lookup-mobile-stability`.

## Verification Already Completed

- Targeted ESLint over changed virtual keyboard and overlay files passed.
- Related Vitest suite passed: 4 files / 10 tests.
- `npm run typecheck` passed.
- `npm run test` passed: 95 files / 627 tests.
- `npm run lint` passed.

## Verification Still Needed In A Less Restricted Environment

- `npm run build`
- Mobile Playwright screenshot/e2e for:
  - `tests/e2e/mobile-input-keyboard.spec.ts`
  - `tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts`

## First Action On Resume

Run `git status --short` and confirm only the task-owned files are considered for any commit or push. Do not stage unrelated kiosk/staff files.
