# Evidence — TASK-20260710-003

| ID | Type | Evidence | Result | Timestamp |
|---|---|---|---|---|
| E-001 | baseline | `git status --short --branch` | Dirty worktree with unrelated mobile performance files already present before print implementation. | 2026-07-10 |
| E-002 | implementation | `src/features/orders/components/print-portal.tsx` | Added scoped `paperMode="a4-portrait-half"` support and dynamic A4 portrait `@page` style injection. | 2026-07-10 |
| E-003 | implementation | `src/features/orders/components/repair-order-print-sheet.tsx` | Order detail print now requests A4 portrait half-page mode. | 2026-07-10 |
| E-004 | implementation | `src/features/orders/components/order-list-print-sheet.tsx` | Order list/bulk print now requests A4 portrait half-page mode. | 2026-07-10 |
| E-005 | implementation | `src/styles.css` | Printed content dimensions now use named variables that keep the ticket at A5 landscape size. | 2026-07-10 |
| E-006 | test | `src/features/orders/components/print-portal.test.tsx` | Added focused test coverage for portal mounting, A4 style injection, and cleanup. | 2026-07-10 |
| E-007 | test | `npm run test -- src/features/orders/components/print-portal.test.tsx` | Passed: 1 file, 2 tests. | 2026-07-10 |
| E-008 | test | `npm run typecheck` | Passed. | 2026-07-10 |
| E-009 | test | `npm run lint` | Passed. | 2026-07-10 |
| E-010 | test | `npm run test` | Passed: 100 files, 670 tests. | 2026-07-10 |
| E-011 | build | `npm run build` | First sandbox run failed on Turbopack port binding; escalated rerun passed. | 2026-07-10 |
| E-012 | visual | `screenshots/TASK-20260710-003-mobile-order-a4-half-print/a4-half-print-layout.png` | Screenshot shows A4 portrait page with A5 landscape content on upper half and lower half blank. | 2026-07-10 |
| E-013 | visual | `screenshots/TASK-20260710-003-mobile-order-a4-half-print/a4-half-print-layout.pdf` | Generated A4 PDF evidence for print-layout review. | 2026-07-10 |
- `2026-07-09T22:36:21Z` `ca45a8d7bd` — Focused print-portal test passed
- `2026-07-09T22:36:21Z` `3694916a38` — typecheck, lint, full vitest, and escalated next build passed
- `2026-07-09T22:36:21Z` `1156a51b01` — Visual evidence generated under screenshots/TASK-20260710-003-mobile-order-a4-half-print
- `2026-07-09T22:37:12Z` `b37a9d8f8f` — Scoped diff checked and task metadata corrected to R2
