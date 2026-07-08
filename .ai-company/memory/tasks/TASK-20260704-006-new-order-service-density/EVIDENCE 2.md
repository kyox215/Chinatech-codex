# Evidence Index — TASK-20260704-006-new-order-service-density

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-04T16:57:25Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-04T17:00:39Z` `76ae7f4966` — npm run lint passed
- `2026-07-04T17:00:39Z` `aa8d4ec54e` — npm run typecheck passed
- `2026-07-04T17:00:39Z` `ef5f2a7afe` — npm run test passed: 43 files, 260 tests
- `2026-07-04T17:00:39Z` `abb4339ae2` — npm run build passed after sandbox-escalated rerun; initial sandbox build failed on Turbopack port binding only
- `2026-07-04T17:00:39Z` `192a2af6a4` — Playwright mobile check on /orders/new at 393x852: scrollWidth=393, innerWidth=393, serviceHeight=152
- `2026-07-04T17:00:39Z` `f0057eef9d` — screenshots/TASK-20260704-006-new-order-service-density/orders-new-service-density-mobile.png
