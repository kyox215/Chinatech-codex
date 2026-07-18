# Stage 04A — Cost and Profit Export

Status: pending

## Goal

Provide an Owner/authorized-Manager CSV export that is bounded, PII-minimized, formula-safe
and independently audited without recording financial rows in the generic audit payload.

## Validation

- Permission and cross-store denial.
- Stable column order, Unicode, quotes, CR/LF and tab handling.
- Formula-injection defense for values beginning with `=`, `+`, `-` or `@`.
- Date-range and row-limit enforcement; no phone, email, IMEI, unlock or message fields.
- Audit event stores only filter summary, row count, content hash and result.

## Exit criteria

- Generated fixtures reconcile with Profit Center totals to the cent.
- Export remains unavailable when its independent feature flag is off.
- Evidence and checkpoint are recorded before Stage 04B.

## Rollback

Disable the export flag and preserve existing audit metadata; no financial data deletion.
