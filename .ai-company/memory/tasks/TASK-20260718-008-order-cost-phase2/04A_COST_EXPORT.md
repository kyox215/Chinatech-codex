# Stage 04A — Cost and Profit Export

Status: completed — 2026-07-18T12:45:18Z

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

## Implementation result

- Added a service-role-only `repairdesk_read_cost_export_rpc` with store membership,
  `finance:cost_export`, store-local date, filter-count and 10,000-row hard bounds.
- Exported only operational, non-refunded repair-line finance fields. Customer, phone, email,
  device identifier, unlock and message fields are absent from the contract and CSV headers.
- Added UTF-8 BOM/RFC-4180-style quoting and spreadsheet formula protection, including values
  where whitespace precedes `=`, `+`, `-` or `@`.
- Added SHA-256 content evidence and a minimized audit event containing only dates, filter
  counts, row count, result and hash. Financial rows are never copied into generic audit data.
- Added `canExportRepairCosts` to the server-computed store context. The Profit Center button is
  absent when the independent `REPAIRDESK_COST_EXPORT_ENABLED` flag or exact permission is absent.

## Validation result

- Disposable PostgreSQL replay from Stage 01 through Stage 04A passed:
  `order_cost_phase2_export_harness_passed`. Exported test rows reconciled to EUR 270.00 quote,
  EUR 90.00 cost and EUR 180.00 complete-line margin after the Stage 03 allocation.
- Permission, forged lower-role grant, cross-store, browser-role ACL, cancelled/refunded/date,
  source/status filter and overflow fail-closed assertions passed.
- Focused Vitest: 5 files / 57 tests passed; store capability test passed independently.
- Repository `lint`, `typecheck`, `git diff --check` and `npx next build --webpack` passed;
  the build generated 25 application pages.
- Browser verification: authorized mock export returned HTTP 200 and displayed the generated
  filename; disabling the child flag produced zero export buttons and no console errors.
- Screenshots: `screenshots/stage-04a-cost-export-1440.png` and
  `screenshots/stage-04a-cost-export-hidden-1440.png`.

## Residual note

The in-app browser's download-event observer did not surface the Blob-anchor download event,
but the application status, server HTTP 200 log and service/API tests independently confirmed
the generated file path. No production flag or migration was changed in this stage.
