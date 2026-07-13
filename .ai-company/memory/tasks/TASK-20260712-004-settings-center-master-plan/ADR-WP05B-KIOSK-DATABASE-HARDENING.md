# ADR WP05-B — Kiosk database and public-entry hardening

- Status: accepted for local implementation only
- Decision owner: RepairDesk Integration Lead under Owner L2 boundaries
- Risk: R3
- Last verified: 2026-07-13

## Context

WP-05 made the customer-iPad workflow usable locally, but its production release gate remained closed. Independent data, architecture, and security review found four distinct risks:

1. the public pair/read/submit entries could be reached independently from end-to-end review readiness, including from a non-production process configured against Supabase;
2. staff accept/return did not bind the decision to the exact submission version shown in the UI;
3. Kiosk rows lacked additive database guards for same-store device ownership and valid state shapes;
4. accept currently spans customer/order updates, Storage upload, attachment metadata, session transition, and event writes without one durable operation record. A process failure can therefore leave partial writes or an orphaned object.

The linked database may also have historical drift in the physical types of `customer_kiosk_sessions.order_id` and `customer_id`. Local migration files are not sufficient evidence for adding those foreign keys to a linked environment.

## Decision

Adopt a staged expand/verify/finalize strategy.

### Stage 1 — implemented locally in WP05-B

- Add a master gate, `REPAIRDESK_KIOSK_PRODUCTION_ENABLED`, for every production or Supabase-backed non-E2E runtime. Mock/E2E verification remains local and reversible.
- Treat `REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED` as the end-to-end readiness interlock. Pair, public session read/submit, private pairing/session creation, accept, and return require **both** flags whenever the process is production or Supabase-backed. A master-only configuration cannot collect customer data that staff are unable to review.
- Bind staff accept/return to `expected_submission_version` at the HTTP contract, read, and final compare-and-swap update.
- Apply private/no-store and same-origin request policy to every explicit response from the three anonymous Kiosk handlers. Anonymous errors remain stable and omit internal details.
- Stop copying customer name, phone, and balance into session request payloads. Pickup public DTOs omit unused customer identity fields.
- Remove raw signature data URLs from a session after accept or return. Keep only `has_signature` and, after evidence persistence, `signature_attachment_id`.
- Add the local additive migration `20260713144316_kiosk_integrity_expand.sql`. It contains a same-store device foreign key, full reference-side and open-expiry indexes, state/hash checks, and bounded DDL timeouts. Constraints are `NOT VALID`: they protect later writes without claiming historical rows are clean.

Stage 1 does not enable Kiosk in production and does not apply a linked migration.

### Stage 2 — blocked pending Owner-approved linked read-only preflight

- Verify physical column types, existing constraints, anomaly counts, RLS state, and pending migration order in the linked environment.
- Add order/customer same-store foreign keys only after the physical types and parent composite keys are proven compatible.
- Reconcile historical anomalies before a separate `VALIDATE CONSTRAINT` migration. Validation must never be bundled with an unreviewed data rewrite.

`WP05B_DATABASE_APPROVAL_PACKET.md` contains the executable Stage 1 database gates and records the physical types needed to plan Stage 2. Parent `(id, store_id)` key proofs and order/customer orphan analysis require a separate Stage 2 approval packet; the current packet does not authorize those foreign keys.

### Stage 3 — blocked pending architecture and role decisions

Replace the current multi-step accept path with a durable review-operation workflow:

1. prepare a unique operation keyed by session, submission version, and decision;
2. reserve a deterministic Storage object path when signature evidence exists;
3. finalize customer/order/attachment/session/event/audit database changes in one transaction/RPC;
4. record cleanup-required state for failed or superseded Storage objects and process it with a retryable sweeper;
5. return the prior result for replayed idempotency keys.

The final RPC must use explicit actor identity, same-store checks, a submitted/version compare-and-swap, least-privilege execution grants, and a reviewed `search_path`. Client-provided role or store values must never authorize the operation.

## Alternatives considered

### Enable the current flow after adding only constraints

Rejected. Constraints improve row integrity but do not make customer/order/Storage/session/event writes atomic and do not resolve orphan cleanup.

### Upload the signature and call one finalize RPC without a durable operation record

Rejected. It still loses recovery state between object upload and database finalization, and process-local cleanup is not a durable retry strategy.

### Add every foreign key from the local schema immediately

Rejected. The linked physical types and historical rows have not been verified. Guessing or casting in a production migration would exceed L2 authority.

### Store the raw signature in the session for later recovery

Rejected. The session needs only a bounded correction draft and evidence reference. Retaining the image duplicates sensitive data without an approved retention purpose.

## Security, privacy, and legal boundaries

- The canvas image is application evidence; this ADR does not call it an advanced or qualified electronic signature.
- No retention duration or customer-facing consent wording is selected here. Those require Owner/legal review based on purpose and data category.
- Role semantics remain unchanged. Production enabling is blocked until the permitted reviewer roles are explicitly approved and server-enforced.
- A single-process rate limiter is not sufficient for a distributed production deployment. Token lifecycle, distributed limiting, monitoring, and revocation operations remain release gates.

## Release gates

Production remains NO-GO until all of the following are evidenced and approved:

- isolated full-history database reset, executable migration apply, lint, and post-check evidence (Gate 2A);
- linked read-only preflight and clean pending-migration order;
- migration dry-run, explicit apply approval, and post-apply verification;
- order/customer same-store constraint decision;
- durable prepare/finalize/idempotency/cleanup design and implementation;
- reviewer-role semantics;
- distributed rate-limit and token operational policy;
- retention/privacy wording decision;
- full quality, security, and release review;
- explicit Owner approval to enable flags, deploy, or push.

## Rollout and rollback

- Local rollback before any linked apply: revert the WP05-B code and remove the unapplied migration.
- After a linked expand apply, prefer a reviewed forward fix. Dropping constraints or indexes requires a separate Owner-approved rollback migration and evidence that no later code depends on them.
- Disable both Kiosk flags first if a production issue occurs. This is the immediate reversible containment control; it does not repair partial data.
