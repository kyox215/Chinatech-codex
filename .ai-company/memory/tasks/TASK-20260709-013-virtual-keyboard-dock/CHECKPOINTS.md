# Checkpoints - TASK-20260709-013-virtual-keyboard-dock

## 2026-07-09T11:46:44Z - Implementation and local verification checkpoint

### Current State

- Implementation is complete for the shared fixed-bottom virtual keyboard dock and migrated custom keypads.
- Related option overlays have been moved to prefer upward placement and constrained heights.
- Local lint, typecheck, related tests, and full tests passed.
- Build and screenshot/e2e verification are blocked by sandbox local port/process restrictions, not by a confirmed application failure.

### Completed

- Added `src/components/ui/virtual-keyboard-dock.tsx`.
- Updated `src/components/orders/money-keypad-input.tsx` to render through the fixed dock.
- Updated `src/features/orders/components/device-unlock-fields.tsx` so the PIN keypad opens through the fixed dock.
- Updated option overlays in customer lookup, new-order option menus, fault diagnosis picker, and multi-select dropdowns to avoid the fixed keyboard.
- Added/updated component tests for money keypad dock and PIN keypad dock behavior.

### Decisions

- Use a portal-backed fixed dock instead of inline popovers so the keypad position is independent from form layout changes.
- Publish keyboard metrics through CSS variables so overlays can reserve space without coupling to keypad internals.
- Keep the money keypad change in the reusable component so all existing order/payment money inputs inherit the behavior.
- Do not overwrite `.ai-company/memory/ACTIVE_CONTEXT.md` because it belongs to a separate active kiosk/staff task in this dirty checkout.

### Risks And Blockers

- Production build remains unverified in this sandbox because Turbopack/local process binding is denied.
- Mobile screenshot evidence remains unavailable because Playwright's dev server cannot bind `127.0.0.1`.
- Unrelated dirty worktree changes are present and must remain isolated from this task.

### Next Step

When a local dev server can bind a port, run:

1. `npm run build`
2. `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 PLAYWRIGHT_WEBSERVER_COMMAND='npm run dev -- -H 127.0.0.1 -p 3012' REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/mobile-input-keyboard.spec.ts tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts`

Stop if screenshots show the dock not bottom-centered, if an option overlay covers the dock, or if unrelated kiosk/staff files appear in the task diff.

## 2026-07-09T11:50:06Z - Final CSS correction and verification checkpoint

### Current State

- A final review found the overlay `calc()` arbitrary values needed Tailwind underscore spaces around subtraction operators.
- The affected overlay classes were corrected without changing the intended layout behavior.
- Final targeted lint, TypeScript check, related tests, and tracked diff whitespace check passed.

### Evidence

- `npx eslint ...changed virtual keyboard and overlay files...` passed.
- `npm run typecheck` passed.
- Related Vitest command passed: 4 files / 10 tests.
- `git diff --check -- ...changed tracked virtual keyboard files...` passed.

### Remaining Blockers

- `npm run build` still cannot be completed in the current sandbox because local process or port binding is denied.
- Mobile Playwright screenshots/e2e still cannot be completed in the current sandbox because the dev server cannot bind `127.0.0.1`.
- `.ai-company/memory/ACTIVE_CONTEXT.md` remains intentionally untouched because it belongs to the unrelated kiosk/staff task.

### Next Step

In a local environment with port binding allowed, run the build and mobile Playwright commands from the previous checkpoint, then capture the bottom dock screenshots for final visual evidence.

## 2026-07-09T12:15:35Z - Release gate completed

### Current State

- The owner instructed to start the task and push `main` after completion.
- Release target is the current `main` branch.
- Full lint, typecheck, test, build, and mobile Playwright checks passed.
- Build and Playwright required non-sandbox execution because the default sandbox denied local process or port binding.

### Evidence

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 95 files / 627 tests.
- `npm run build` passed.
- Mobile Playwright passed: 2 tests.
- Screenshots:
  - `screenshots/TASK-20260709-006-order-money-virtual-keypad/money-keypad-chromium.png`
  - `screenshots/TASK-20260709-006-order-money-virtual-keypad/new-order-money-keypad-fields-chromium.png`
  - `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-first-digit-stable-chromium.png`
  - `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-three-digits-popover-chromium.png`

### Release Scope

- Include only virtual keyboard, phone lookup stability, related tests/e2e, screenshot evidence, and task memory files.
- Exclude unrelated kiosk/staff review, private suppliers, migration-history audit, and `ACTIVE_CONTEXT.md` changes.

### Next Step

Create a scoped commit on `main` and push it. Stop if staged files include unrelated kiosk/staff or supplier/audit work.

## 2026-07-09T12:27:07Z - Clean origin/main release checkpoint

### Current State

- Direct push from the original local `main` was unsafe because local `main` had an unrelated ahead commit and was behind `origin/main`.
- A temporary clean worktree was created from latest `origin/main`.
- The virtual keyboard release commit was cherry-picked onto that worktree.
- The only conflict was in `CustomerIntakeLookup`, where the remote `PhoneKeypadInput` work was preserved and this task's threshold/upward-overlay behavior was merged.
- E2E tests were adapted to the current virtual phone keypad UI.

### Evidence

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test` passed: 97 files / 637 tests.
- `npm run build` passed outside restrictive sandbox.
- Mobile Playwright passed: 2 tests.
- Screenshots:
  - `screenshots/TASK-20260709-009-customer-phone-name-keypad/phone-keypad-chromium.png`
  - `screenshots/TASK-20260709-009-customer-phone-name-keypad/new-order-customer-phone-results-chromium.png`
  - `screenshots/TASK-20260709-009-customer-phone-name-keypad/money-keypad-chromium.png`
  - `screenshots/TASK-20260709-009-customer-phone-name-keypad/new-order-money-keypad-fields-chromium.png`
  - `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-first-digit-stable-chromium.png`
  - `screenshots/TASK-20260709-012-phone-lookup-mobile-stability/phone-lookup-three-digits-popover-chromium.png`

### Next Step

Amend the clean worktree release commit with the resolved test and evidence updates, then push `HEAD:main` as a fast-forward update.

## 2026-07-09T12:30:19Z - Main push completed

### Current State

- Feature release commit `e744971a96403ecce39180f31eabd27dce2c5164` was pushed to `origin/main`.
- Push result: `1f8fac39..e744971a  HEAD -> main`.
- The original dirty local worktree was not used for the final push, so unrelated kiosk/staff, supplier, migration-audit, and local inventory work were not included.

### Evidence

- `git merge-base --is-ancestor origin/main HEAD` passed before push.
- `git log --oneline origin/main..HEAD` showed only `e744971a Fix mobile virtual keyboard docking` before push.
- `git push origin HEAD:main` succeeded.

### Closeout

- Task status set to `closed`.
- Remaining local worktree divergence belongs to other tasks and is intentionally not modified by this release.
