---
schema_version: 1
task_id: "TASK-20260709-018-order-load-customer-relationship"
updated_at: "2026-07-09T15:18:30Z"
---
# Checkpoints

## 2026-07-09T15:18:30Z - validating

- Root cause identified as PostgREST relationship ambiguity between `repair_orders` and `customers`.
- Local fix implemented in a clean worktree.
- Targeted test, lint, typecheck, full test suite, diff check, and build passed.
- Production schema was queried read-only and confirmed two customer FKs.
- Next: run formal checkpoint, decide release boundary, commit if approved by policy/user context.
## 2026-07-09T15:21:02Z — Production /orders load failure traced to ambiguous PostgREST repair_orders->customers embed; code now uses customers!repair_orders_customer_same_store_fkey and regression tests/gates pass.

- **Phase:** validating
- **Completed/current state:** Production /orders load failure traced to ambiguous PostgREST repair_orders->customers embed; code now uses customers!repair_orders_customer_same_store_fkey and regression tests/gates pass.
- **Next:** Decide release boundary, commit scoped files, and push only if production release is authorized.
- **Decision:** Use same-store customer relationship instead of legacy single-column customer FK to preserve tenant isolation and avoid production FK name drift.
- **Evidence:**
  - E-001 screenshot error, E-004 production FK query, E-006 source scan, E-007 tests/lint/typecheck/build
- **Recorded by:** Codex
## 2026-07-09T16:04:13Z — Task closeout

- **Status:** closed
- **Outcome:** Order loading incident fixed and verified. Owner approved pushing main after the release boundary check. No database migration or data write is required.
- **Residual risks:** Production page screenshot was not captured because authenticated /orders can expose customer data; use owner-side reload as live visual confirmation after deployment. Existing Supabase migration-history divergence remains out of scope.
- **Follow-up:** If similar PostgREST ambiguity appears elsewhere, add explicit !<fk> embeds and expand the source-scan regression test.
- **Closed by:** Codex
