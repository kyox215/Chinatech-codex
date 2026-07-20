# Handoff — TASK-20260720-001

## Current state

Customer simple workbench implementation is complete and verified locally. No database file was added and no production data was changed.

## Release manifest

- Customer list/detail components, forms, models, tests and repository projection.
- Mobile workspace dock route guard and test.
- Customer responsive E2E spec.
- Responsive/architecture documentation and this task memory.

## Remaining

1. Read-only department final review.
2. Fresh `git fetch --prune` and reconcile main.
3. Scoped commit and direct `HEAD:main` push if main is unchanged/fast-forward safe.
4. Vercel production deployment verification and sanitized smoke.
5. Update this packet with final commit/deployment evidence and conditional closeout.

## Hard blocker retained

Do not apply any Supabase migration until the 19 remote-only migration versions have exact reviewed SQL provenance and linked dry-run passes.
