# Memory Delta — TASK-20260726-001-inventory-phone-sales-complete

## Candidate project facts

- Direct V2 inventory inspection, pricing and non-quantity status changes must use the atomic workflow RPC with V1 timestamp plus V2 unit-version CAS; all legacy one-sided endpoints remain fail closed. Source: independent data review, migrations and repository tests. Status: implemented locally, production dormant. Owner: Data/Architecture. Review trigger: production migration approval and runtime smoke.

## Candidate department updates

- Frontend: manual intake is the default V2 source; money drafts require explicit values and accept Italian decimal commas. Status: implemented and verified.
- Data/Security: legacy sale endpoints must reject V2-linked stock before any write. Status: implemented and behavior-tested.

## Candidate decisions / ADRs

- ADR candidate: adopt `repairdesk_apply_inventory_unit_workflow_v2` as the only direct-phone inspection/commercial/listing mutation, with a separate preflight-gated enable migration. Approval status: implementation verified; production migration not yet approved.

## Candidate lessons and capability evidence

- Independent data review caught a misplaced sale guard in the inspection path; behavior-level repository tests were added so helper-only tests cannot mask call-site errors. Status: verified lesson.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
