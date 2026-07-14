# Memory Delta — TASK-20260714-001-buyback-sensitive-evidence-feature-off

## Consolidated verified rules

- A sensitive feature-off must cover dedicated API routes, semantic attachment-kind mislabelling, direct repository calls, bulk import/apply paths and legacy state markers.
- A feature-off sanitizer must distinguish inbound data from already stored allowlisted metadata; stripping new markers must not silently delete existing evidence state.
- A global evidence shutdown must project the same UI to every role; do not imply that a manager can continue collection.
- Quote-only success must say “record saved”, never “transaction completed”, and must not render receipt/inventory actions.
- A multi-request create flow must remember the created ID before follow-up calls, observe server state on retry and refresh the same record when the current draft changes.
- A rollback target is valid only if it preserves the same security boundary; otherwise stop the affected flow and forward-fix.

## Memory change set

- Promoted the production containment state and re-enablement gate to `PROJECT_MEMORY.md` and `MEMORY_INDEX.md`.
- Synchronized the server deny boundary, quote-only UI, bounded full-suite interpretation, exact release posture and unchanged Supabase catalog into Backend, Security, Frontend, QA, Data, Operations and Documentation department memory.
- Added a conservative release-capability candidate and advanced the repeated read-only buyback security-review capability without changing permission or autonomy.
- Preserved exact deployment IDs, test counts, command outputs and the Chrome screenshot limitation only in task evidence because they are run-specific.
- No conflict or superseded long-term rule was found. The prior six-step evidence workflow remains valid local design history, but its production activation is explicitly blocked while feature-off is active.

## Residual risks

- If the initial quote-create response is lost after the server commits but before the client receives the ID, a later retry can still create a second quote-only record. No payment, evidence bind or finalize action is possible in this state. API/Frontend own a future idempotency-key follow-up if this is observed.
- The restricted-evidence migration, legal wording, retention/purge/legal-hold policy and staged-file cleanup remain separate approval-gated work.
