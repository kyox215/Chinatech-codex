# Stage 04B — Historical Cost Backfill

Status: completed

## Goal

Deliver preview, bounded apply and compensating revert for legacy order-line costs without
using today's defaults as historical facts or overwriting later manual confirmation.

## Validation

- Preview performs zero business-data writes.
- Legacy `line_id` preparation first inserts an unknown cost row, then updates JSON, so the
  Phase 1 default trigger cannot attach today's default to an old order.
- Apply uses run ID, idempotency key and expected revision; conflicts are skipped and reported.
- Partial failure can resume; revert appends compensation and stops at later human edits.
- Production deployment never starts a backfill run automatically.

## Exit criteria

- Dry-run/apply/revert counts and fixture hashes reconcile.
- Actual production apply remains a separate Owner action after preview.
- Evidence and checkpoint are recorded.

## Implemented result

- Added private run/candidate metadata and service-role-only preview/read/apply/revert RPCs.
- Preview is bounded to 367 store-local days and 5,000 candidates, records a SHA-256 fixture
  hash, and does not write `repair_orders`, cost projections, or revisions.
- Candidates use only a default version effective at the order's historical `created_at`;
  otherwise the cost remains `historical_unknown` rather than zero.
- A missing `line_id` is handled by inserting a run-bound unknown sentinel before updating
  `fault_prices`, preventing the existing synchronization trigger from attaching today's
  default cost. The stable ID remains after compensation.
- Apply locks and validates the order timestamp, fault JSON hash, line fingerprint, expected
  cost revision, run hash, and idempotency key. It processes whole orders in batches and
  reports post-preview changes as conflicts.
- Revert appends a `backfill_reverted` compensation to unknown; it never deletes history and
  reports a conflict rather than overwriting a later human cost correction.
- Manager access is preview-only with the exact grant. Apply/revert and their UI controls are
  Owner-only. The feature is behind both parent and independent child flags.
- Deployment installs the tool only. No migration, API route, page mount, or deploy hook creates
  or applies a production run.

## Verification result

- Fresh disposable PostgreSQL replay from Stage 01 through 04B passed profit, parts, export,
  and backfill assertions (`repairdesk_cost_backfill_20260718_f`).
- The backfill harness proved: preview zero business writes; historical 15 EUR selected instead
  of current 99 EUR; unknown preserved; 1-order batch resume; changed-order conflict; apply
  idempotency; later manual 31 EUR preserved; one compensation and one revert conflict; RLS/ACL.
- Focused application verification passed: 8 files / 94 tests plus the isolated store capability
  test; `npm run typecheck`, `npm run lint`, `git diff --check`, and webpack production build.
- The complete store repository file also ran, with the new backfill test passing; three unrelated
  pre-existing invite-link tests are date-sensitive against the current 2026-07-18 clock and failed
  because their fixed links had expired. They are not in the backfill call path.
- Browser verification at 1440 px showed the synthetic two-candidate preview, estimate/unknown
  distinction, explicit Owner confirmation, HTTP 200 read/preview calls, and no console warnings.
- Screenshots: `screenshots/stage-04b-history-backfill-owner-1440.png` and
  `screenshots/stage-04b-history-backfill-confirmation-1440.png`.

## Rollback

Disable the backfill flag. Preserve candidates and revisions; use compensating revert only.
