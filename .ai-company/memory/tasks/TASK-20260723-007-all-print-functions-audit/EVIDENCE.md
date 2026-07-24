# Evidence Index — TASK-20260723-007-all-print-functions-audit

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-23T21:34:17Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.

| Evidence ID | Type | Claim supported | Source/path/command | Result |
|---|---|---|---|---|
| E-002 | inventory | all reachable print surfaces enumerated | `rg` over `src/app`, feature screens, `window.print`, `PrintPortal` | 4 business surfaces |
| E-003 | unit tests | print lifecycle, profile, portals, sheets, inventory receipt and permission matrix | targeted Vitest command | 7 files / 87 tests passed |
| E-004 | Chromium E2E | order batch/detail/task print preparation, print call, isolation and PDF paging | `print-safari-reliability.spec.ts` | 5 / 5 passed |
| E-005 | WebKit E2E | order print DOM and media behavior | controlled rerun with Service Worker blocked | 1 / 1 passed |
| E-006 | inventory E2E | sold inventory receipt opens, builds print sheet and calls print | temporary audit test, removed after run | Chromium 1 / 1; WebKit 1 / 1 passed |
| E-007 | static finding | buyback print is raw current-page print | `buyback-quote-workspace.tsx:2974-2983` | FAIL |
| E-008 | static finding | order task lacks QR flag and single-print capability gate | `order-task-screen.tsx:158-182` | finding confirmed |
| E-009 | static finding | viewer list permission differs from detail/task UI; issue service rejects | `order.repository.ts:4131-4139`; customer-status service | finding confirmed |
| E-010 | quality gates | lint and TypeScript | `npm run lint`; `npm run typecheck` | passed |
| E-011 | visual | WebKit order and inventory print evidence | screenshot paths in `REPORT.md` | inspected |
