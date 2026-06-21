# Checkpoints

## 2026-06-21T09:58:00+02:00 Verified

- Centralized shell navigation/actions in `src/shared/config/navigation.ts`.
- Added `runRepairDeskShellAction` helper so AppBar and MobileWorkspaceDock share event/route/scanner/camera/command execution.
- Sidebar, command palette, top bar, and mobile quick sheet now read shared config.
- Mobile RepairOS workspace routes hide the global AppBar and keep one page-level floating header, fixing duplicate mobile menu buttons.
- Validation passed: typecheck, lint, unit tests, production build, and app-shell Playwright checks.
- Screenshots saved under `screenshots/shell-unification-20260621/`.

Next suggested action: if the owner asks to push, stage only the shell-unification files and screenshots/task memory, then commit separately from unrelated dirty workspace changes.

## 2026-06-21T15:55:00+02:00 Revalidated After Customer Tag Release

- Confirmed Vercel production deployment for commit `4665dad Improve customer tag density` is `READY`.
- Re-isolated shell-unification diff from the mixed worktree and kept scope to AppBar, AppSidebar, CommandPalette, MobileWorkspaceDock, shared navigation config, and shell action helper.
- Fixed `MobileWorkspaceDock` to pass `shell.isPlatformAdmin` into `getShellPrimaryAction`, matching desktop AppBar behavior.
- Validation passed: typecheck, lint, full Vitest, non-sandbox production build, and direct Playwright visual assertions.
- Updated screenshots: `orders-desktop-shell-unified.png`, `buyback-mobile-quick-sheet-viewport.png`, and `buyback-mobile-quick-sheet-dialog.png`.

Next suggested action: commit/push this shell-unification batch only after owner approval, because pushing `main` triggers production deployment.
