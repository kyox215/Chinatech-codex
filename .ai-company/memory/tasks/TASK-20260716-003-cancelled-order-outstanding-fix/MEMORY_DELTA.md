# Memory Delta

## Verified facts

- Cancelled order raw finance values are historical evidence; live customer receivables must exclude legacy or canonical cancellation markers.
- Realtime is supplementary synchronization, not a substitute for mutation-local React Query invalidation.
- A narrow, additive function migration is preferred over introducing a general terminal lifecycle for this defect.
- Both deployed `repairdesk_customer_list_page_v2` overloads must wrap the corrected v3 contract so an application rollback cannot restore the bug.
- Cancelled-payment protection belongs inside the atomic RPC after idempotent replay and row locking, and before every ledger/order/event/audit write.

Verified by local exact fixture, 142/972 test suite, browser evidence, production migration history, 3,675-row aggregate parity and zero-write RPC guard probe.
