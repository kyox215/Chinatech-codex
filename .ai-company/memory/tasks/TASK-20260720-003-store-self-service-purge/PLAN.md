# Execution Plan

## Classification

- Class: T3
- Risk: R4 (irreversible production tenant deletion and new destructive workflow)
- Autonomy: L1
- Decision owner: Integration Lead; Owner retains D4 production and irreversible decisions.
- Multi-agent: required. FLOW/UX, DATA/API and SEC/QA completed independent read-only reviews.
- Writer: Integration Lead only, in isolated branch `codex/store-self-service-purge`.

## Product contract

1. Active stores expose reversible close only.
2. Closing and archived stores remain recoverable.
3. An archived primary owner may request permanent deletion after a fresh server preflight.
4. The request enters a minimum 24-hour cancellable cooling period for a verified-empty test store.
5. After cooling and export/restore proof, the primary owner completes a second fresh AAL2 confirmation.
6. Browser actions only create/cancel/confirm a durable request. A leased service worker performs Storage and database deletion.
7. `purging` is the irreversible boundary. `purge_failed` never claims success and cannot be retried by the user.
8. Completion removes the store from business/recovery contexts and retains only a non-PII tombstone.

## Phases and gates

### Phase A — safe implementation

- Forward-only migration; no edit to applied migrations.
- Exact recovery-store owner authorization.
- Server-derived approval and manifest references; clients never submit approval hashes or worker evidence.
- Lease-bound trigger exception restricted to the exact purge job/store/worker and destructive DELETE/cycle-break operations.
- Cancellation is atomic before `destructive_step_started`.

Exit: isolated migration replay, focused tests, security review and diff audit pass.

### Phase B — application and UI

- API: create/status/cancel/final-confirm deletion request.
- Internal maintenance runner: archive finalization, export/purge jobs, bounded work per invocation, constant-time cron authorization.
- UI: archived eligibility, request, cooling countdown, cancel, final confirmation, purging, failure and tombstone states.

Exit: lint, typecheck, full tests, build and responsive browser screenshots pass.

### Phase C — staged production release

1. Linked migration dry-run and exact history/ACL/RLS/catalog review.
2. Apply forward migration with all lifecycle flags off.
3. Deploy application with flags off.
4. Enable enforcement; verify active flows and closing-store rejection.
5. Enable mutations on a disposable store; verify close/archive/restore/request/cancel.
6. Configure encrypted export sink and isolated restore proof; exercise disposable empty purge.
7. Obtain post-proof exact-target final confirmation.
8. Process only UUID `8b0b8834-98db-47cb-9d6d-c9b9410afd9b`; verify zero residual and formal `ChinaTech` unchanged.

## Stop conditions

- Migration drift or linked dry-run mismatch.
- Target UUID/name/revision/owner mismatch.
- Any business row, Storage object, AI reservation, hold or unresolved background write.
- Missing/mismatched export or isolated restore proof.
- Lease, writer-fence, catalog/FK, other-tenant or zero-residual failure.
- Missing deployment/flag/final irreversible approval.

## Verification matrix

- SQL: migration replay, ACL/RLS, function owner, lease bypass, cancel-vs-claim and live-write-vs-close concurrency.
- Unit/API: roles, recovery UUID, AAL2 freshness, request replay/conflict, cooling, cancellation, final confirm and unknown results.
- Worker: partial Storage/database progress, lease loss, retry, zero proof and other-tenant invariants.
- UI: 390, 430, 768, 1280 and 1440; archived, cooling, confirm, purging, failed and completed states.
- Release: disposable store before target; 60-minute dense observation and 24-hour follow-up audit.
