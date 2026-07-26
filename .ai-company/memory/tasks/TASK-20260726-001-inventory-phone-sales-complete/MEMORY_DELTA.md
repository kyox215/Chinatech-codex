# Memory Delta — TASK-20260726-001-inventory-phone-sales-complete

## Candidate project facts

- Direct V2 inventory inspection, pricing and non-quantity status changes must use the atomic workflow RPC with V1 timestamp plus V2 unit-version CAS; all legacy one-sided endpoints remain fail closed. Source: independent data review, production migrations, rollback-only runtime smoke and repository tests. Status: production verified. Owner: Data/Architecture. Review trigger: workflow schema, state matrix or quantity-moving command change.
- Production Inventory V1 inspection/status/grade columns are constrained `text`, not the enum names present in some development snapshots. Compatibility types must remain service-role-only aliases and must not rewrite historical columns. Source: production rollback smoke and migration `20260726182246`. Status: production verified. Owner: Data/Security. Review trigger: fresh-schema replay or inventory column type change.
- When Supabase MCP assigns a production migration version, the committed migration filename must be reconciled to the recorded `supabase_migrations.schema_migrations.version` before push so CI cannot reapply the same DDL. Source: migrations `20260726181436`..`20260726182556`. Status: verified release procedure. Owner: Operations/Data. Review trigger: migration transport change.

## Candidate department updates

- Frontend: manual intake is the default V2 source; money drafts require explicit values and accept Italian decimal commas. Status: implemented and verified.
- Data/Security: legacy sale endpoints must reject V2-linked stock before any write. Status: implemented and behavior-tested.

## Candidate decisions / ADRs

- Approved decision: `repairdesk_apply_inventory_unit_workflow_v2` is the only direct-phone inspection/commercial/listing mutation, with service-role-only execution and preflight-gated enablement. Approval status: Owner approved and production verified on 2026-07-26.

## Candidate lessons and capability evidence

- Independent data review caught a misplaced sale guard in the inspection path; behavior-level repository tests were added so helper-only tests cannot mask call-site errors. Status: verified lesson.
- Rollback-only production testing caught a deferred PL/pgSQL missing-type failure that static SQL inspection and application tests did not expose. Production schema introspection plus an end-to-end transaction is required for future inventory workflow migrations. Status: verified lesson.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
