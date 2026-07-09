---
schema_version: 1
task_id: "TASK-20260709-017-global-scan-search-plan"
status: "closed"
phase: "validated"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead"
created_at: "2026-07-09T21:02:13+02:00"
updated_at: "2026-07-09T20:49:13Z"
closed_at: "2026-07-09T20:49:13Z"
---
# Global Scan Search

## Owner Goal

Implement the planned global scan search mechanism, push main when complete, and apply database changes if needed.

## Scope

- Add scan search next to search boxes in orders, customers, buyback, and inventory.
- Add global scan entry points from the top app bar, command palette, and mobile workspace dock.
- Reuse `features/capture` scanner/parser.
- Keep scan payloads as lookup/navigation inputs only; do not bypass permissions or tenant isolation.
- Confirm whether database application is needed.

## Out of Scope

- Public customer-facing status QR page.
- Supabase schema changes, short-code tables, indexes, or migrations.
- External OCR or paid recognition services.
- Production deployment beyond the requested git push.

## Implementation Summary

- Added `scan-search-resolver` to map captured payloads to safe open/search actions.
- Added `ScanSearchButton` and `ScanSearchSheet` reusable capture UI.
- Normalized inventory scan links to `/inventory?item=...`.
- Added `/orders?q=...`, `/customers?q=...`, `/buyback?q=...`, and existing `/inventory?q=...` scan/search landing support.
- Replaced buyback scanner placeholder toasts with real scan search behavior.
- Routed global app bar, command palette, and mobile dock scanner actions through one global scan sheet.
- Added `docs/SCAN_SEARCH_PAYLOADS.md`.

## Database Decision

No database migration is required for this implementation. The feature uses existing IDs, URLs, route search parameters, and client-side scan resolution. Do not run broad `supabase db push` for this task.

## Verification Plan

- Targeted parser/resolver tests.
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Browser screenshot checks for mobile/desktop visible scan entry points if local app starts successfully.

## Verification Result

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 99 files / 660 tests.
- `npm run build`: passed in non-sandbox mode after sandbox Turbopack port binding failure.
- Visual evidence captured under `screenshots/TASK-20260709-017-global-scan-search-plan/`.

## No-Spawn Reason

The owner did not explicitly request sub-agents in this implementation turn. The current multi-agent tool policy only permits spawning after explicit user request for sub-agents/delegation. Main thread is the single writer.
