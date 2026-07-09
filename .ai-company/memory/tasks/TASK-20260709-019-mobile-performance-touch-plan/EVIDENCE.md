# Evidence Index — TASK-20260709-019-mobile-performance-touch-plan

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T21:40:18Z | Integration Lead |
| E-002 | project rule | plan-only task should remain read-only for runtime behavior | `.ai-company/ONE_COMMAND_MODE.md`; `.ai-company/policies/PROJECT_RULES.md` | read | 2026-07-09T21:35Z | Integration Lead |
| E-003 | mobile standard | mobile work must follow RepairOS compact/floating-card, no overflow, mobile input rules | `docs/RESPONSIVE_DENSITY_PLAN.md`; `docs/REPAIROS_COMPACT_ARCHITECTURE.md`; `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md` | read | 2026-07-09T21:35Z | Integration Lead |
| E-004 | existing performance work | general cache/lazy/API performance work already exists and should not be duplicated | `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`; `.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/TASK.md` | read; batch 5 recorded as implemented and verified | 2026-07-09T21:38Z | Integration Lead |
| E-005 | current code | shared query defaults exist | `src/lib/query-performance.ts`; `src/app/providers.tsx` | observed `CACHE_TIMES` and `repairDeskQueryDefaultOptions` in use | 2026-07-09T21:32Z | Integration Lead |
| E-006 | current code | touch-safe dropdown and mobile input helpers exist | `src/shared/lib/touch-safe-dropdown-trigger.ts`; `src/shared/lib/mobile-input.ts` | observed | 2026-07-09T21:33Z | Integration Lead |
| E-007 | current tests | mobile overflow, touch dropdown, keyboard, and phone lookup checks exist | `tests/e2e/visual-overflow.spec.ts`; `tests/e2e/new-order-mobile-dropdown-scroll.spec.ts`; `tests/e2e/mobile-input-keyboard.spec.ts`; `tests/e2e/new-order-phone-lookup-mobile-stability.spec.ts` | observed | 2026-07-09T21:33Z | Integration Lead |
| E-008 | current code | hot mobile feature screens are App Router feature-owned pages | `src/app/orders/page.tsx`; `src/app/orders/new/page.tsx`; `src/app/orders/[id]/page.tsx`; `src/app/customers/page.tsx`; `src/app/buyback/page.tsx`; `src/app/inventory/page.tsx` | observed thin route entries | 2026-07-09T21:34Z | Integration Lead |
| E-009 | worktree | unrelated dirty changes exist | `git status --short`; `git diff --stat` | observed kiosk, print, settings, API, and task-memory changes | 2026-07-09T21:36Z | Integration Lead |
| E-010 | deliverable | mobile-specific plan created | `docs/MOBILE_PERFORMANCE_TOUCH_OPTIMIZATION_PLAN.md` | created | 2026-07-09T21:48Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T21:42:42Z` `b579b47d92` — docs/MOBILE_PERFORMANCE_TOUCH_OPTIMIZATION_PLAN.md; .ai-company/memory/tasks/TASK-20260709-019-mobile-performance-touch-plan/EVIDENCE.md; git diff --check scoped pass
