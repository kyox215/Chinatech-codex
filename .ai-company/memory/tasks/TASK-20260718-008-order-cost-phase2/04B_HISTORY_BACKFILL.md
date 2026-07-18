# Stage 04B — Historical Cost Backfill

Status: pending

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

## Rollback

Disable the backfill flag. Preserve candidates and revisions; use compensating revert only.
