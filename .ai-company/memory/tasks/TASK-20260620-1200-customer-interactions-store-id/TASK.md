# TASK-20260620-1200 Customer Interactions Store ID Repair

## Status

verified

## Owner Goal

Fix the mobile customer detail failure reported from `chinatech-codex.vercel.app`: `column customer_interactions.store_id does not exist`.

## Scope

- Diagnose the customer detail API failure path.
- Keep customer detail loading even when `customer_interactions` is still on the legacy schema.
- Add an idempotent database repair migration for `customer_interactions.store_id`.
- Verify with targeted tests and available project gates.

## Out Of Scope

- Production database execution.
- Vercel deployment.
- Unrelated customer UI refactors.
- Destructive data changes.

## Risk And Autonomy

- Risk: R2 medium. The task touches customer data access and tenant-scoped schema compatibility.
- Autonomy: L2 controlled execution for local code and migration files.
- Approval required before any production Supabase migration execution or deployment.

## Departments

- Considered: DATA/API, FE, QA, SECURITY.
- Real sub-agents: none.
- No-spawn reason: current multi-agent tool policy allows spawning only when explicitly requested by the user; this is a single-path production bug fix with one main-thread writer and no safe benefit from parallel writes.

## Decisions

- Use an application-level legacy fallback for `customer_interactions.store_id` missing-column errors so customer detail can load before the production schema is repaired.
- Add a forward-compatible migration to add and backfill `customer_interactions.store_id`, then create the existing query index expected by the app.

## Acceptance

- Customer detail no longer fails solely because `customer_interactions.store_id` is missing.
- Sending a customer message keeps store ownership validation and can insert into a legacy interaction table.
- Migration is idempotent and does not delete data.
- Validation commands and visual evidence status are recorded in `EVIDENCE.md`.

## Closeout Notes

- Local code, migration, tests, build, and mock visual check are complete.
- Production database migration execution and Vercel deployment are still approval/release actions and were not performed in this task.
