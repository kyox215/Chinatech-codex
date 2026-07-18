# Stage 04 — Export and Historical Backfill

Status: pending

## Goal

Provide auditable cost export and a preview-first, idempotent, reversible historical-cost backfill tool.

## Scope

- Permission-separated CSV export with date/store/status/source filters.
- PII-minimized columns; no phone, IMEI, unlock data or customer message content.
- CSV formula-injection defense, row limit and audit event.
- Backfill run/candidate states: draft, previewed, applied, rejected and reverted.
- Deterministic sources only become confirmed; default/history inference remains estimated; unresolved remains unknown.
- Batch cursor, retry, failure isolation, dry-run statistics and run-level revert.

## Validation

- Unauthorized export/backfill denial and cross-store isolation.
- CSV escaping, formula prefix, Unicode and large-row behavior.
- Preview has no business-data mutation.
- Apply is idempotent and never overwrites a later confirmed/manual cost.
- Revert affects only records created by the selected run.
- Historical defaults use effective-at time, not today's value.

## Exit criteria

- Export and backfill endpoints, UI and audit evidence pass.
- Production release does not automatically apply historical candidates.
- Stage checkpoint is recorded.

