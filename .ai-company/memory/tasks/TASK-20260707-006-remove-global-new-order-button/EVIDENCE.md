# Evidence Index — TASK-20260707-006-remove-global-new-order-button

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T18:40:16Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T18:40:26Z` `17c5254b95` — Changed src/components/app-bar.tsx only for UI logic: removed getShellPrimaryAction/runRepairDeskShellAction wiring and the trailing brand action Button. npx eslint src/components/app-bar.tsx passed. Chrome current logged-in /orders accessibility tree shows top app bar actions are search/theme/notification/platform/store only; page toolbar still has button New Order. Screenshot evidence saved at screenshots/TASK-20260707-006-remove-global-new-order-button/orders-appbar-no-new-order-20260707.png, though the headless screenshot used a fresh unauthenticated session.
