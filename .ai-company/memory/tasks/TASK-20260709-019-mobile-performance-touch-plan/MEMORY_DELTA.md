# Memory Delta — TASK-20260709-019-mobile-performance-touch-plan

## Candidate project facts

- `docs/MOBILE_PERFORMANCE_TOUCH_OPTIMIZATION_PLAN.md` is the current mobile-specific follow-up plan for response speed, touch feedback, and FPS stability. It supplements, not replaces, `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`.

## Candidate department updates

- UX/FE/QA: future mobile performance implementation should start with measured touch/scroll baselines at 390x844 and 430x932, then fix the top measured bottlenecks with scoped UI/render/lazy-load changes.

## Candidate decisions / ADRs

- Planning decision: do not duplicate the 2026-07-01 general performance work; focus the next batch on mobile touch response, scroll smoothness, layout stability, and heavy surface lazy loading.

## Candidate lessons and capability evidence

- Existing mobile helper patterns (`touch-safe-dropdown-trigger`, `mobile-input`, RepairOS Floating Card) should be extended conservatively rather than replaced by a new gesture framework.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
