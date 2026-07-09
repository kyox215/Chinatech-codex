# Evidence

## Baseline

- Worktree: `/private/tmp/repairdesk-imei-multi-candidates`
- Base: `origin/main` at `a668f924`
- Main checkout contains unrelated kiosk WIP and is not used for writes.

## Validation Commands

- `npm run test -- src/components/imei-scanner-field.test.tsx`
  - Result: passed, 1 file / 21 tests.
- `npm run typecheck`
  - Result: passed.
- `npm run lint`
  - Result: passed.
- `npm run test`
  - Result: passed, 94 files / 627 tests.
- `npm run build`
  - Result: sandbox run failed with Turbopack port-binding permission error after local dependencies were installed.
  - Follow-up: rerun outside sandbox with the same command passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-capture-ui.spec.ts`
  - Result: passed, 1 Chromium smoke test.

## Dependency / Environment Notes

- The isolated worktree did not initially have `node_modules`; a temporary symlink was used for early tests.
- Turbopack rejects a `node_modules` symlink outside the project root, so the symlink was removed and `npm ci --prefer-offline --no-audit --no-fund` installed local dependencies before the final build.
- `npm ci` emitted an engine warning because the shell Node version is `v20.20.2` while the package requires `>=22.12.0`; the install, tests, typecheck, lint, and build still completed.

## Visual Evidence

- `/private/tmp/repairdesk-imei-multi-candidates/screenshots/TASK-20260709-013-imei-locked-frame-multi-candidates/imei-new-order-camera-fallback-desktop.png`
- `/private/tmp/repairdesk-imei-multi-candidates/screenshots/TASK-20260709-013-imei-locked-frame-multi-candidates/imei-new-order-upload-candidates-desktop.png`

## Notes

- Playwright rewrote the prior task screenshots and `next-env.d.ts`; those generated changes were restored after copying current screenshots into this task directory.
- After rebasing onto `origin/main` at supplier-management commit `d75c741a`, focused component test, typecheck, lint, full Vitest, build outside sandbox, and IMEI Playwright smoke were rerun and passed.
