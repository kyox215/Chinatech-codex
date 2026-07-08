# Checkpoints — TASK-20260707-006-remove-global-new-order-button

## 2026-07-07T18:40:16Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T18:40:26Z — Removed the global AppBar contextual primary-action button so the selected top-right New Order shortcut no longer appears across module pages.

- **Phase:** verified-local
- **Completed/current state:** Removed the global AppBar contextual primary-action button so the selected top-right New Order shortcut no longer appears across module pages.
- **Next:** Optional next step: commit this scoped UI change if owner wants it pushed/deployed; otherwise leave local preview running for review.
- **Decision:** Remove the whole global app-bar primary action rather than hiding only the orders new-order variant, because the owner requested the selected top-bar control be removed on all pages.
- **Evidence:**
  - Changed src/components/app-bar.tsx only for UI logic: removed getShellPrimaryAction/runRepairDeskShellAction wiring and the trailing brand action Button. npx eslint src/components/app-bar.tsx passed. Chrome current logged-in /orders accessibility tree shows top app bar actions are search/theme/notification/platform/store only; page toolbar still has button New Order. Screenshot evidence saved at screenshots/TASK-20260707-006-remove-global-new-order-button/orders-appbar-no-new-order-20260707.png, though the headless screenshot used a fresh unauthenticated session.
- **Recorded by:** codex-main
