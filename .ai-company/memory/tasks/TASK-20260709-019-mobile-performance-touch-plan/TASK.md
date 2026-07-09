---
schema_version: 1
task_id: "TASK-20260709-019-mobile-performance-touch-plan"
title: "Mobile performance and touch response plan"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead"
departments: ["FE", "QA", "UX"]
created_at: "2026-07-09T21:40:18Z"
updated_at: "2026-07-09T21:43:05Z"
closed_at: "2026-07-09T21:43:05Z"
---
# Task — Mobile performance and touch response plan

## Owner request

检查项目，针对移动端优化响应速度以及触摸时的帧率反应等，给一份计划。

## Business value

Define a scoped plan to improve RepairDesk mobile loading, touch responsiveness, scroll smoothness, and frame-rate stability without changing runtime behavior in this planning task.

## Scope in

- Read project rules, mobile UI standards, current performance plan, and relevant code surfaces.
- Produce a mobile-specific performance and touch response plan.
- Identify hot mobile routes, existing mechanisms, measurable budgets, implementation phases, validation, rollback, and approval points.
- Create a durable planning artifact and task memory.

## Scope out

- Runtime code changes.
- Production deployment.
- Database migrations or indexes.
- Permission, payment, customer notification, or tenant-isolation behavior changes.
- New production dependencies or paid monitoring tools.
- Deleting legacy `src/routes/*` cleanup debt.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Plan identifies mobile hot paths and current evidence.
- [x] Plan defines measurable mobile performance and touch/FPS budgets.
- [x] Plan separates baseline measurement, low-risk implementation phases, validation, rollback, and approval points.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Existing general performance work already implemented cache defaults, lazy command palette, request timeout/cancel, and aggregate APIs | verified fact | `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`; `TASK-20260701-007-performance-optimization-plan/TASK.md` | use as baseline, do not duplicate |
| Mobile UI standards require RepairOS Floating Card, no overflow, mobile-safe inputs, and 390/430px validation | verified fact | `docs/RESPONSIVE_DENSITY_PLAN.md`; `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md` | apply to future implementation |
| Hot mobile routes are orders, new order, order detail, customers, buyback, inventory, and shell actions | verified fact | `src/app/*/page.tsx`; `src/features/*/screens` | prioritize baseline collection |
| Touch-safe dropdown and mobile input helpers already exist | verified fact | `src/shared/lib/touch-safe-dropdown-trigger.ts`; `src/shared/lib/mobile-input.ts` | extend only where measured |
| Worktree has unrelated dirty changes | verified fact | `git status --short`; `git diff --stat` | implementation must stage scoped files only |

## Decision and approval points

- This task is documentation and planning only: R1 / L2.
- Future implementation is likely R2 / L2 if limited to reversible UI/render/lazy-load changes.
- Owner approval is required before production deployment, database migrations/indexes, new paid services/dependencies, permission/payment/customer-message behavior changes, or legacy route deletion.

## Work packages

- WP-01 Baseline: collect mobile traces, API timings, long tasks, touch feedback, screenshots.
- WP-02 Low-risk touch response: immediate feedback, pending states, drag/tap conflict audit, hit areas.
- WP-03 Rendering and FPS: mobile card memoization where proven, animation reduction, observer/layout stability.
- WP-04 Heavy surface lazy loading: camera/scanner/print/import/quote/photo preview shells.
- WP-05 API/data shape review: only after UI/render evidence shows network or payload bottlenecks.
- WP-06 Verification: standard gates plus mobile Playwright checks and screenshots.

## Definition of done

- Plan document created at `docs/MOBILE_PERFORMANCE_TOUCH_OPTIMIZATION_PLAN.md`.
- Evidence and checkpoint updated.
- No runtime behavior changed.
- Final owner report states no screenshot because this is planning-only.
