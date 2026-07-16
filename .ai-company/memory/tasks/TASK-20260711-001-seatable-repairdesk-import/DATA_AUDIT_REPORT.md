# Data Audit Report — SeaTable RIPARAZIONE Import

Generated at: 2026-07-10T22:45:00Z

## Scope

- Source workbook: private default-view export outside the repository; exact local path omitted.
- Converted CSV, pseudonymized preview, full local preview and warning review CSV: owner-only artifacts outside the repository; exact paths omitted.

No customer names, phone numbers, issue text, IMEI, or full PII are recorded in this report. Row-level preview artifacts remain restricted pseudonymized data, not anonymous data.

## Import Preview Summary

| Metric | Count / Amount |
|---|---:|
| Source rows imported by dry-run | 6284 |
| Customers | 3664 |
| Devices | 6284 |
| Orders | 6284 |
| Suppliers | 0 |
| Quotation total | EUR 334902.50 |
| Deposit total | EUR 39192.51 |
| Warning entries | 604 |
| Unique rows with warnings | 514 |
| Rows with multiple warnings | 58 |

## Status Distribution

| RepairDesk status | Count | Import decision |
|---|---:|---|
| completed | 5485 | Importable as historical completed orders |
| cancelled | 623 | Importable as cancelled/archive orders |
| parts_arrived | 58 | Active; review contact quality before production |
| parts_ordered | 43 | Active; review contact quality before production |
| notified | 40 | Active pickup/notification state |
| mail_in_progress | 13 | Active external repair state |
| unfixed_pickup | 9 | Historical/exception pickup state |
| diagnosing | 9 | Active; review unknown/ambiguous rows |
| repaired | 4 | Active repaired state |

## Payment Distribution

| Payment status | Count | Notes |
|---|---:|---|
| unpaid | 4517 | Many historical orders still have positive balance in source data; may be real or incomplete payment tracking |
| partial | 1075 | Deposit/balance imported separately |
| paid | 692 | Balance is zero after deposit/quotation parsing |

Additional amount checks:

- Zero quotation rows: 308.
- Rows with positive deposit: 1460.
- Rows with positive balance: 5592.
- Deposit greater than quotation: 4. These rows are production blockers until corrected or explicitly resolved; source rows are recorded in the redacted target-bound manifest.

## Warning Classification

| Severity | Count | Meaning |
|---|---:|---|
| P1 | 24 | Review before production import, especially active orders |
| P2 | 474 | Importable with fallback values if owner accepts quality tradeoff |
| INFO | 106 | Auto-acceptable informational warnings |

### P1 Review Items

| Category | Count | Recommendation |
|---|---:|---|
| Active orders without valid phone | 14 | Fix phone before production import when possible. If unavailable, import as placeholder customer and tag for follow-up. |
| Active/history rows missing created date | 8 | Fix dates when possible; otherwise import time will be used and historical ordering may be distorted. |
| Unrecognized status | 2 | Confirm original SeaTable status. Current fallback maps to `diagnosing`. |

### P2 Quality Items

| Category | Count | Recommendation |
|---|---:|---|
| Historical/cancelled/completed rows without valid phone | 237 | Can be accepted as placeholder historical customers if owner agrees. |
| Missing model | 134 | Can import as `Sconosciuto`; device search quality will be weaker. |
| Missing brand | 99 | Can import as `Sconosciuto`; device grouping/reporting quality will be weaker. |
| Historical rows missing created date | 4 | Can import with fallback date if owner accepts historical ordering drift. |

### INFO Items

| Category | Count | Recommendation |
|---|---:|---|
| One backup phone detected | 105 | Auto-accept; backup phone is stored in `contact_phones`. |
| Two backup phones detected | 1 | Auto-accept; backup phones are stored in `contact_phones`. |

## Source Status Mapping Review

| Source `STATO` | RepairDesk status | Count | Notes |
|---|---|---:|---|
| FATTO | completed | 5482 | Normal historical completed mapping |
| FATTO | unfixed_pickup | 2 | Problem text indicates unrepaired pickup; acceptable exception mapping |
| 作废 | cancelled | 619 | Normal cancelled mapping |
| 作废已通知 | cancelled | 4 | Cancelled with notification side status |
| 到货 | parts_arrived | 26 | Parts arrived |
| 到货 | unfixed_pickup | 1 | Problem text indicates unrepaired pickup; review if needed |
| 到货已通知 | parts_arrived | 32 | Parts arrived with notification side status |
| 下单 | parts_ordered | 16 | Parts ordered |
| IN CORSO | diagnosing | 6 | Active diagnosis/in-progress |
| IN CORSO | parts_ordered | 19 | Problem text indicates ordered parts |
| 修好 | repaired | 4 | Repaired, not necessarily notified |
| 修好已通知 | notified | 40 | Ready/notified |
| 修好已通知 | unfixed_pickup | 2 | Problem text indicates unrepaired pickup; review if needed |
| 寄修 | mail_in_progress | 13 | External repair |
| 寄修 | unfixed_pickup | 4 | Problem text indicates unrepaired pickup; review if needed |
| 久等 未答复 | diagnosing | 3 | Ambiguous waiting/no-answer state |
| 久等 未答复 | parts_ordered | 7 | Problem text indicates ordered parts |
| 欠款 已拿走 | completed | 3 | Completed with remaining balance |
| blank | parts_ordered | 1 | Status missing but problem text indicates ordered parts; review |

## Go / No-Go Recommendation

Conditional go for code-level import preparation; no-go for production write/delete until P1 review and R4 data gates are complete.

Recommended production preconditions:

1. Owner accepts the 474 P2 quality fallbacks, or provides corrections.
2. Owner reviews the 24 P1 items in `/tmp/repairdesk-seatable-import/data-audit-review.csv`.
3. Target Supabase project and target `store_id` are confirmed. Completed by read-only preflight on 2026-07-11.
4. Current owner/admin account and membership are confirmed for that store. Completed by read-only preflight on 2026-07-11.
5. A backup and restore plan exists and is tested or at least dry-run verified.
6. Production cleanup is batch/test-data scoped, not store-domain clear.
7. Import rows carry batch provenance and source row traceability.
8. Final owner approval is captured immediately before production write/delete.

## Next Execution Package

Proceed with a safe import package, not direct production apply:

1. Add batch provenance to import rows: `import_batch_id`, `source_table`, `source_row`, and `source_file`.
2. Add a preflight report command that compares preview counts with target store counts before mutation.
3. Add a test-data cleanup preview mode that lists candidate rows and requires explicit owner approval before deletion.
4. Keep production apply blocked until target store, backup, recovery, and owner approval are present.
