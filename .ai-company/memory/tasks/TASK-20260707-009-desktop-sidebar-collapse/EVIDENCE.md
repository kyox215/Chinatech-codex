# Evidence Index — TASK-20260707-009-desktop-sidebar-collapse

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:02:13Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:02:25Z` `c0a262d422` — npx eslint src/components/app-sidebar.tsx src/components/ui/sidebar.tsx passed.
- `2026-07-07T19:02:25Z` `481405da2c` — git diff --check -- src/components/app-sidebar.tsx src/components/ui/sidebar.tsx passed.
- `2026-07-07T19:02:25Z` `a115cbcc4d` — npm run typecheck passed.
- `2026-07-07T19:02:25Z` `f4df2a863a` — npm run test passed: 82 files, 531 tests.
- `2026-07-07T19:02:25Z` `4acb86bef9` — npm run build initially failed in sandbox due Turbopack port-binding permission, then passed outside sandbox with approval.
- `2026-07-07T19:02:25Z` `2cc89fca5c` — In-app browser at http://localhost:3012/orders verified collapse: sidebar 255px expanded -> 47px collapsed, data-state collapsed, data-collapsible icon, visible sidebar text hidden, scrollWidth 1280 equals innerWidth 1280; expand/collapse round trip passed.
- `2026-07-07T19:02:25Z` `cf1a372b42` — Visual evidence saved at /private/tmp/repairdesk-sidebar-collapsed-20260707.png.
