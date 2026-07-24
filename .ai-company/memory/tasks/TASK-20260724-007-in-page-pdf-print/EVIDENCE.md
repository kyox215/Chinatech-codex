# Evidence Index — TASK-20260724-007-in-page-pdf-print

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-24T11:22:54Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-24T11:38:48Z` `215961a41f` — 11 related unit tests passed；Chromium four-mode E2E passed with popupCount=0；local Chrome only retained the original /orders tab；lint/typecheck/webpack build passed；screenshot screenshots/TASK-20260724-007-in-page-pdf-print/current-page-progress.png。
- `2026-07-24T11:41:13Z` `e274dbee28` — Chromium E2E 1 passed: popupCount=0，四种 PDF MediaBox 均匹配；unit 11 passed；lint/typecheck/build passed；local Chrome only one /orders tab；progress screenshot available。
- `2026-07-24T11:42:31Z` `da0cedcb47` — git diff --check passed；final E2E/unit/lint/typecheck/build results recorded in prior checkpoint。
