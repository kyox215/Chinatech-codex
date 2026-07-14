# Memory Delta — TASK-20260714-001-buyback-sensitive-evidence-feature-off

Pending verified production release. Candidate stable rules:

- A sensitive feature-off must cover dedicated API routes, semantic attachment-kind mislabelling, direct repository calls, bulk import/apply paths and legacy state markers.
- A feature-off sanitizer must distinguish inbound data from already stored allowlisted metadata; stripping new markers must not silently delete existing evidence state.
- A global evidence shutdown must project the same UI to every role; do not imply that a manager can continue collection.
- Quote-only success must say “record saved”, never “transaction completed”, and must not render receipt/inventory actions.
- A multi-request create flow must remember the created ID before follow-up calls, observe server state on retry and refresh the same record when the current draft changes.
- A rollback target is valid only if it preserves the same security boundary; otherwise stop the affected flow and forward-fix.
