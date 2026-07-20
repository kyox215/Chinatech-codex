# Memory Delta — TASK-20260719-004-store-lifecycle-uuid-flow-plan

## Task-specific facts

- Current ChinaTech UUID is `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`; confirmation suffix is `86a9e8ed`.
- Full UUID already reaches the client through `StoreContext.activeStore.id`; suffix UI work needs no migration.
- Current user confusion comes from exposing the real suffix mainly as an input placeholder and short preflight summary.

## Reusable decisions

- UUID is an object identifier, not an authentication factor; show it clearly to the authorized primary owner.
- Dangerous tenant actions should be unlocked by a fresh, target-bound preflight identity card; copied values must not auto-fill confirmation fields.
- Network-unknown mutations must reconcile the existing operation before creating a new operation ID.
- Closing/archived stores must not remain ordinary active workspaces; use a separate recovery context.
- Close must establish a database writer fence and recompute action-specific blockers in the same transaction.
- Arbitrary hashes do not constitute purge approval; record-level holds and independent restore proof are authoritative gates.

## 2026-07-20 plan delta

- Beginner-facing lifecycle UX uses one visible task and one primary action at a time.
- Rename belongs to store identity, not the close flow.
- Owner-visible close is three steps: check, resolve/review, confirm.
- Technical lifecycle terms are hidden under details and mapped to plain-language outcomes.
- Manual store-name typing is redundant when the target name stays visible and the user must manually confirm the immutable suffix plus MFA and consequences.
- A simplified UI never authorizes simplifying the server-side writer fence, transactional recheck, context separation, MFA, idempotency or audit contract.
