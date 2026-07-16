# Production Import Approval Package — SeaTable RIPARAZIONE

Status: **historical approval draft — superseded by the recorded Owner approval and completed 2026-07-11 production import**.

This file preserves the pre-execution decision gates. It is not a current runbook and must not be reused to authorize or rerun the import. The authoritative outcome is in `TASK.md`, the 2026-07-11T08:08:40Z checkpoint, `EVIDENCE.md`, and the final handoff.

This package defines the gates required before any production write or delete. It does not authorize production mutation by itself.

## Current Prepared Inputs

| Input | Path / Value |
|---|---|
| Converted source CSV | `/tmp/repairdesk-seatable-import/riparazione-default.csv` |
| Redacted dry-run preview | `/tmp/repairdesk-seatable-import/preview-redacted.json` |
| Full local preview | `/tmp/repairdesk-seatable-import/preview-full-pii-local.json` |
| Warning review CSV | `/tmp/repairdesk-seatable-import/data-audit-review.csv` |
| Data audit report | `.ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import/DATA_AUDIT_REPORT.md` |

Dry-run counts:

- Orders: 6284.
- Customers: 3664.
- Devices: 6284.
- Quotation total: EUR 334902.50.
- Deposit total: EUR 39192.51.
- Warnings: 604.
- Additional money invariant blockers: 4 rows where deposit exceeds quotation.

## Read-Only Production Preflight Result

Result: `FAIL` by design; no production mutation was executed.

- Target project and ChinaTech store were verified.
- Store status is active; the configured account is an active owner and matches `stores.owner_user_id`.
- Global collision count for deterministic customer/device/order/event IDs and batch public numbers: 0.
- Target baseline: 21 customers, 22 devices, 17 suppliers, 21 repair orders, 70 order events.
- Other-store guardrail baseline: 1 customer, 1 device, 1 repair order, 1 order event.
- Cleanup preview found 20 orders with three independent demo-batch markers.
- 13 orders have no attachment, payment-ledger, or extra-event blocker and are eligible for owner review.
- 7 orders are blocked from cleanup review because of additional events; 3 of those also have attachments.
- Payment ledger rows in the target store: 0.
- Reports are stored as private `0600` files under `/tmp/repairdesk-seatable-import/`.

## Required Owner Decisions

Before production mutation, owner must explicitly decide:

1. Whether to accept P2 fallbacks:
   - 237 historical/cancelled/completed rows without valid phone.
   - 134 missing model rows imported as `Sconosciuto`.
   - 99 missing brand rows imported as `Sconosciuto`.
   - 4 historical rows missing created date.
2. Whether to fix or accept P1 rows:
   - 14 active orders without valid phone.
   - 8 active/history rows missing created date.
   - 2 unrecognized status rows defaulting to `diagnosing`.
3. Whether `欠款 已拿走` should remain `completed + partial payment`.
4. Whether historical `FATTO` rows with remaining balance should keep unpaid/partial payment status.
5. Whether to import cancelled rows as archive records or exclude them.

## Production Gate Checklist

No production write/delete may run until all boxes are checked:

- [x] Target Supabase project ref confirmed.
- [x] Target `store_id` confirmed.
- [x] Owner/admin membership for target store confirmed.
- [x] Current target-store row counts captured for `customers`, `devices`, `repair_orders`, `order_events`, `customer_interactions`, `message_logs`, attachments, payment ledger, and related customer/order child tables.
- [x] Other-store row counts captured as a guardrail.
- [x] Exact 20-order backup written to a private local path with mode `0600`; five Storage attachment files are included.
- [x] Exact cleanup restore procedure documented and successfully rehearsed in a linked rollback-only transaction.
- [ ] P1 data-review decision captured.
- [x] Test-data cleanup rules defined and executed against the exact approved 20-order ID set.
- [x] Test-data cleanup preview generated and approved. Owner explicitly approved deletion of all 20 orders, including the 7 rows with additional activity.
- [x] Import batch id chosen and recorded.
- [x] Collision checks pass for public order numbers and deterministic entity identifiers.
- [ ] Final owner approval captured immediately before mutation.

Cleanup mutation approval was captured and the cleanup completed. This does not constitute approval for the later 6284-row SeaTable import.

## Safe Execution Design

### 1. Preflight Only

Run read-only checks:

- Target store exists.
- Target owner/admin exists for the store.
- Existing target-store counts are known.
- Other-store counts are known.
- Preview counts match the local audit report.
- Import candidate rows have stable source identifiers.

Stop if any read-only check fails.

### 2. Backup

Backup all target store rows that can be affected:

- `customers`
- `devices`
- `repair_orders`
- `order_events`
- `customer_tag_assignments`
- `customer_followups`
- `customer_interactions`
- `message_logs`
- any additional child tables discovered by schema inspection

Backup must include the exact `store_id`, timestamp, table counts, and file path.

### 3. Cleanup Preview

Do not clear the whole store domain. Generate candidate deletion lists using explicit test-data rules only.

Allowed candidate signals can include:

- Import/test batch markers.
- Known seed public numbers.
- Known test customer names/phones from non-production seed data.
- Rows created by previous local/demo import.

Disallowed cleanup rule:

- "Delete all rows for this store" is not acceptable for production.

### 4. Import

Import rows in dependency order:

1. Suppliers if any.
2. Customers.
3. Devices.
4. Repair orders.
5. Order events.

Each imported row should carry provenance when schema supports it:

- `import_batch_id`
- `source_system = seatable`
- `source_table = RIPARAZIONE`
- `source_row`
- `source_file`

If schema does not yet support provenance columns, keep provenance in `order_events.payload` and a local import manifest.

### 5. Post-Import Verification

Read-only checks after import:

- Target store order count increased by expected imported order count minus approved cleanup count.
- Other-store row counts are unchanged.
- Status distribution matches preview within zero tolerance unless documented.
- Quotation and deposit totals match preview.
- Sample orders can load through the app API.
- Customer search can find sample imported customers.

### 6. Rollback

Rollback path must be chosen before mutation:

- Preferred: delete by `import_batch_id` plus restore backup for cleaned rows.
- Fallback: restore full backed-up target-store domain from backup.

Rollback is not considered verified until at least a local/staging rehearsal or dry-run restore plan exists.

## Stop Conditions

Stop immediately if:

- Target `store_id` is unknown.
- Backup cannot be created.
- Cleanup preview includes rows that cannot be proven as test data.
- Other-store guardrail counts change.
- Import count differs from preview.
- Money totals differ from preview.
- Any command would require production mutation without final owner approval.

## Recommended Next Implementation Step

Implement a safe local command first:

```bash
npm run db:import:seatable -- \
  --file /tmp/repairdesk-seatable-import/riparazione-default.csv \
  --preview-out /tmp/repairdesk-seatable-import/preview-redacted.json
```

Then add separate production-grade commands:

- `--preflight-prod`
- `--cleanup-preview`
- `--import-batch-id <id>`
- `--apply-prod` gated by project ref, store id, backup dir, approval phrase, and P1 review confirmation

Current `--apply` remains local-only and must not be used for production.
