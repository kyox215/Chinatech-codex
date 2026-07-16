# Evidence Index — TASK-20260716-005-device-custody-status-implementation

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-16T18:23:37Z | 鹤祥 |
| E-002 | git | implementation rebased without overwriting upstream order fixes | branch `codex/device-custody-status-20260716`, base `origin/main@184672fe` | passed; four conflicts resolved manually | 2026-07-16 | CEO-Orchestrator |
| E-003 | tests | focused custody, repository, kiosk, migration and offline paths | `npx vitest run ...` | 7 files / 107 tests passed; final migration test 9/9 passed | 2026-07-16 | CEO-Orchestrator |
| E-004 | quality gate | repository rules and complete regression suite | `npm run agents:check`; `npm run lint`; `npm run typecheck`; `npm run test` | passed; 151 files / 1033 tests | 2026-07-16 | CEO-Orchestrator |
| E-005 | build | production bundle compiles | `npm run build` outside sandbox after sandbox-only port denial | passed; 22 static pages generated | 2026-07-16 | CEO-Orchestrator |
| E-006 | E2E | explicit choice, visible mobile receive action, cancelled customer-held no-return rule | `tests/e2e/device-custody-order-flow.spec.ts` | Chromium 3/3 passed at 390x844 | 2026-07-16 | CEO-Orchestrator |
| E-007 | visual | new-order and detail states are visible in responsive UI | `evidence/new-order-device-with-customer-desktop.png`, `evidence/new-order-device-with-customer-mobile-choice.png`, `evidence/order-detail-device-with-customer-mobile-custody-card.png`, `evidence/order-detail-cancelled-with-customer-mobile.png` | inspected; mock fixture only; real PNG | 2026-07-16 | CEO-Orchestrator |
| E-008 | production read-only | release ordering is mandatory | linked Supabase schema/RPC inspection; Vercel project/deploy inspection | production lacks new column; offline RPC absent; main auto-deploy enabled | 2026-07-16 | final reviewer / CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-16T18:25:43Z` `6bc8e110a6` — TASK-20260716-004 PLAN/EVIDENCE; git fetch --prune; HEAD==origin/main 6717932e; TASK-20260716-005 TASK.md
- `2026-07-16T21:18:03Z` `aabcf61433` — git status --branch: main behind 2; origin/main=184672fe; upstream overlaps order detail/list/task/repository/mock/types/print/workbook.
