# Handoff / Resume — TASK-20260709-019-mobile-performance-touch-plan

## Current handoff

- **Status:** planning complete.
- **Last verified:** 2026-07-09T21:48:00Z
- **Workspace/branch:** dirty worktree; inspect `git status --short` before implementation.
- **Primary artifact:** `docs/MOBILE_PERFORMANCE_TOUCH_OPTIMIZATION_PLAN.md`.
- **First action if approved:** collect mobile baseline traces for `/orders`, `/orders/new`, `/orders/[id]`, `/customers`, `/buyback`, and `/inventory`; then implement only the top 2-3 measured bottlenecks.
- **Do not:** change production, database, permissions, payments, customer communication, dependencies, or legacy route cleanup in the same first batch.
