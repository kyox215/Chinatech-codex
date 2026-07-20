# Handoff — TASK-20260720-001

## Current state

Customer simple workbench is released to `main`, Vercel production is Ready, and authenticated desktop/mobile smoke checks passed. No task database file was added and no production data was changed by this task.

## Release manifest

- Customer list/detail components, forms, models, tests and repository projection.
- Mobile workspace dock route guard and test.
- Customer responsive E2E spec.
- Responsive/architecture documentation and this task memory.

## Follow-up only

1. Replace the customer-list sensitive-field blacklist with an explicit browser DTO whitelist before adding new list fields.
2. Unify the “要跟进” chip count and filter time boundary when database migration history is reproducible again.
3. Recover exact SQL provenance for the 19 remote-only migrations before any future linked database apply.

## Hard blocker retained

Do not apply any Supabase migration until the 19 remote-only migration versions have exact reviewed SQL provenance and linked dry-run passes.
