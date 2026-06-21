# TASK-20260621-007 Shell Unification

Status: verified
Owner: Integration Lead
Autonomy: L2 controlled execution
Risk: R1 reversible UI shell refactor

## Owner Goal

Unify the whole project's top status bar, sidebar, and quick action buttons because different pages currently expose inconsistent shell controls.

## Scope

- Centralize workspace navigation labels, icons, route aliases, and primary shell actions.
- Make `AppSidebar`, `AppBar`, `CommandPalette`, and `MobileWorkspaceDock` read the shared config.
- Remove duplicate mobile top bars on RepairOS workspace routes by hiding the global `AppBar` on mobile where page-level RepairOS headers are present.
- Preserve protected mobile order detail and mobile work-order/task page content; only global shell behavior was touched.

## Out Of Scope

- No authentication, data, payment, workflow, or database changes.
- No page body redesign beyond shell/header visibility.
- No production deployment or push performed in this task.

## No-Spawn Reason

No sub-agents were spawned. This was a single shared-shell write scope with overlapping file ownership across four shell components and one shared config; spawning multiple writers would increase coordination risk without adding useful parallelism.
