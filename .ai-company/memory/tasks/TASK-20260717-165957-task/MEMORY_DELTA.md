# Memory Delta — TASK-20260717-165957-task

## Candidate Long-Term Notes

- Online order create now has a first-phase no-DDL recovery contract: client supplies `operation_id`, server writes it into the created order event, and timeout recovery polls `orders/create/status`.
- This reduces ambiguous-success UX and duplicate submissions but does not replace the proposed service-role-only atomic database RPC.
- Future order-create reliability work should not remove `operation_id` replay behavior unless the atomic RPC provides equivalent replay and status lookup.

## Department Sync Targets

- **Frontend/UX:** create forms with long-running mutations should expose confirming/uncertain states and block repeat submit while result is unresolved.
- **API/Backend:** replayed create operations must not duplicate audit/realtime events.
- **Data:** event-payload lookup is a transitional recovery index; full consistency still belongs in a database RPC or operation ledger.
- **QA:** keep timeout-after-commit and overflow/mobile tests in the release gate for order create work.
