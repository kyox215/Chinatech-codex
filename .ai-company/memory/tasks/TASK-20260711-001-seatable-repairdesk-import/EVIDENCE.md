# Evidence — TASK-20260711-001-seatable-repairdesk-import

## 2026-07-10T22:04:19Z

- Browser access attempted for the owner-provided SeaTable URL.
- Result: SeaTable redirected to its login page; workspace and view identifiers are intentionally omitted from repository evidence.
- Chrome extension backend was unavailable; available browser backend was Codex In-app Browser only.

## 2026-07-10T22:06:28Z

- Code changed:
  - `src/features/orders/import/seatable-riparazione.ts`
  - `src/features/orders/import/seatable-riparazione.test.ts`
  - `scripts/import-seatable-riparazione.ts`
- Verification:
  - `git diff --check -- scripts/import-seatable-riparazione.ts src/features/orders/import/seatable-riparazione.ts src/features/orders/import/seatable-riparazione.test.ts` passed.
  - `npx vitest run src/features/orders/import/seatable-riparazione.test.ts` passed: 1 file, 7 tests.
  - `npm run typecheck` passed.

## 2026-07-10T22:10:43Z

- Sub-agent review completed:
  - FLOW/Sage: status mapping confirmed; `到货一通知` should remain parts-stage with notify side status.
  - DATA/Delta: production import requires batch provenance, deterministic IDs, collision checks, and no broad clear.
  - SEC/Cipher: production import/reset/delete remains NO-GO; current scripts cannot safely mean “only clear test data”.
- Additional code change: `--preview-out` defaults to redacted PII and requires `--preview-include-pii` for full local details.
- Verification rerun:
  - `git diff --check -- scripts/import-seatable-riparazione.ts src/features/orders/import/seatable-riparazione.ts src/features/orders/import/seatable-riparazione.test.ts .ai-company/memory/ACTIVE_CONTEXT.md .ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import` passed.
  - `npx vitest run src/features/orders/import/seatable-riparazione.test.ts` passed: 1 file, 7 tests.
  - `npm run typecheck` passed.
  - `npx eslint scripts/import-seatable-riparazione.ts src/features/orders/import/seatable-riparazione.ts src/features/orders/import/seatable-riparazione.test.ts` passed.

## Data and Safety Evidence

- Existing script clears only rows with `.eq("store_id", storeId)` and requires backup before destructive local apply, but this still clears the whole target store domain and is not suitable for production “test data only” cleanup.
- Existing safety helper requires exact project ref, UUID store id, and `MUTATE_REPAIRDESK:<projectRef>:<storeId>` confirmation.
- Existing workflow plan states SeaTable apply is local-only and production import needs a separate staging/import/swap plan.

## 2026-07-10T22:36:20Z

- Browser access succeeded after owner login; workspace and view identifiers are intentionally omitted:
  - Browser title: `ChinaTech (1) - RIPARAZIONE`.
  - `RIPARAZIONE` table reports 6272 total rows and 16 columns.
  - View list observed: `进行中`, `需要处理的`, `默认`.
- Export/convert evidence:
  - Private filtered-view workbook: 5666 rows; rejected as incomplete.
  - Private default-view workbook: converted to an owner-only CSV with 6284 non-empty rows and 16 columns.
- Dry-run evidence:
  - Owner-only default preview: mode `0600`, restricted pseudonymized row fields, warning values redacted by default.
  - Owner-only full review file: mode `0600`; private location intentionally omitted.
  - Preview counts: 6284 orders, 3664 customers, 6284 devices, 0 suppliers.
  - Totals: quotation EUR 334902.50; deposits EUR 39192.51.
  - Warnings: 604.
- Mapped status summary:
  - completed 5485
  - cancelled 623
  - parts_arrived 58
  - parts_ordered 43
  - notified 40
  - mail_in_progress 13
  - unfixed_pickup 9
  - diagnosing 9
  - repaired 4
- Verification rerun:
  - `npx vitest run src/features/orders/import/seatable-riparazione.test.ts` passed: 1 file, 8 tests.
  - `npx eslint scripts/import-seatable-riparazione.ts src/features/orders/import/seatable-riparazione.ts src/features/orders/import/seatable-riparazione.test.ts` passed.
  - `npm run typecheck` passed.
  - `git diff --check` passed for touched import/task files.

## 2026-07-10T22:52:04Z

- Data audit artifacts:
  - `.ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import/DATA_AUDIT_REPORT.md`
  - `.ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import/PRODUCTION_IMPORT_APPROVAL_PACKAGE.md`
  - `/tmp/repairdesk-seatable-import/data-audit-review.csv`
- Data audit summary:
  - Warning entries: 604.
  - Unique warning rows: 514.
  - Severity split: P1 24, P2 474, INFO 106.
  - P1 items: 14 active orders without valid phone, 8 missing created-date rows, 2 unrecognized status rows.
  - P2 items: 237 historical/cancelled/completed rows without valid phone, 134 missing model, 99 missing brand, 4 historical missing-date rows.
- Verification:
  - `git diff --check -- .ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import/DATA_AUDIT_REPORT.md .ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import/PRODUCTION_IMPORT_APPROVAL_PACKAGE.md` passed.
  - `/tmp/repairdesk-seatable-import/data-audit-review.csv` exists with mode `0600` and 605 lines including header.

## No Visual Screenshot

This stage is data/backend/script work. After login the browser-visible result is a customer-data grid, so no screenshot should be captured or published. Use the local preview files and command evidence instead.

## 2026-07-11T01:27:00+02:00 — Safe Import Package And Read-Only Production Preflight

- Implemented deterministic UUID entity IDs, batch/source-namespaced order numbers and fixed fallback timestamps.
- Import provenance is stored in `repair_orders.internal_tag`, created-event metadata and a private manifest. Raw source rows are no longer copied into events.
- Historical imports no longer infer SMS or marketing consent.
- Read-only production preflight verifies exact project/store, active owner identity, target/other-store baselines and global collisions.
- Cleanup preview requires three independent demo markers and excludes orders with extra events, attachments or payment-ledger entries.
- Read-only production result:
  - target store active and owner identity matched;
  - collision count 0;
  - 20 proven demo orders, 13 eligible for owner review, 7 blocked; 3 blocked orders have attachments; payment ledger count 0;
  - 4 source rows violate `deposit <= quotation`, therefore preflight result is `FAIL`;
  - no production insert, update or delete executed.
- Private `0600` artifacts:
  - `/tmp/repairdesk-seatable-import/import-manifest-target-bound.json`
  - `/tmp/repairdesk-seatable-import/production-preflight-redacted.json`
  - `/tmp/repairdesk-seatable-import/cleanup-preview-redacted.json`
- Verification: targeted Vitest 2 files / 15 tests passed; targeted ESLint passed; `npm run typecheck` passed; actual 6284-row dry-run reproduced audited totals.
- Final quality gate: `npm run test` passed 106 files / 715 tests; full lint, typecheck, agent checks and diff check passed.
- Final QA sub-agent was stopped after a prolonged no-result run; DATA and SECURITY independent reviews were completed and integrated, while final executable verification remained in the Integration Lead.

## 2026-07-11 — Owner Approved All 20 Demo Orders; Exact Backup Complete

- Owner explicitly instructed deletion of all 13 unblocked and all 7 previously blocked demo orders.
- Exact private backup completed at `/tmp/repairdesk-seatable-import/demo-order-backup-20260711/`:
  - 20 repair orders;
  - 65 order events;
  - 6 message logs;
  - 10 customer interactions;
  - 6 customer followups;
  - 5 attachment metadata rows and 5 downloaded Storage files;
  - 0 payment-ledger rows;
  - 0 external original-order references.
- Backup JSON and receipt use mode `0600`; attachment directory uses mode `0700` and files use `0600`.
- Local isolated Supabase restore environment could not start because the historical migration chain fails on missing `inventory_items.product_channel`; no production mutation occurred.
- Proposed linked production restore rehearsal is a single transaction with temporary delete/restore comparisons and unconditional rollback. Execution was rejected because separate explicit Owner approval is required for this live transaction.

## 2026-07-11 — Restore Rehearsal Passed And Exact Cleanup Completed

- Owner explicitly approved the linked production rollback-only rehearsal and formal deletion of all 20 demo orders plus related records and five Storage files.
- First rehearsal attempt safely failed on a missing `message_logs` cascade assumption; the transaction rolled back and read-only verification confirmed all 20/65/6/10/6/5 rows remained intact.
- Corrected rehearsal explicitly deleted all child tables, restored them, performed bidirectional row comparisons and returned `PASS`; the transaction then rolled back.
- Formal transaction committed exact deletions:
  - 20 repair orders;
  - 65 order events;
  - 6 message logs;
  - 10 customer interactions;
  - 6 customer followups;
  - 5 attachment metadata rows.
- Five already-backed-up Storage files were deleted and individually confirmed missing.
- Post-delete read-only verification:
  - ChinaTech remaining demo orders: 0;
  - ChinaTech remaining repair orders: 1;
  - ChinaTech remaining order events: 5;
  - other stores remain at 1 repair order and 1 order event;
  - other-store affected-table counts are unchanged.
- Private execution receipt: `/tmp/repairdesk-seatable-import/cleanup-execution-receipt.json`, mode `0600`.
- Exact backup remains at `/tmp/repairdesk-seatable-import/demo-order-backup-20260711/`.
- SeaTable import was not executed; four money-invariant rows and P1/P2 source decisions remain blocking.
- No screenshot: this is backend/data tooling and browser-visible evidence would expose customer data; private redacted reports are the substitute evidence.

## 2026-07-11 — Production Import Completed

- Owner selected `raise_quotation_to_deposit`, approved all 6284 rows including 623 cancelled rows, and accepted default fallbacks.
- Latest target backup: `/tmp/repairdesk-seatable-import/chinatech-before-seatable-import-20260711.json`, mode `0600`, SHA-256 `0b4c920ea278e5bc5ed4cafaa54aaf948badb9612c71bd32e812d00a4f6f95cc`.
- Private batch: `chinatech-riparazione-20260711-v2`; source SHA-256 `bad30cf0ed7a5b0623452c2f5c722052cc3471e1cdff6c05702a44190baa346b`; payload SHA-256 `2b07eb7b76b0e4b4f0a0a61d279b3feff77eb7dda01b847b7b45482c4186eca7`.
- Private staging contains 3664 customers, 6284 devices, 6284 orders, 6284 events and exact 20/20/20 test-parent before-images. Schema ACL is postgres-only; API-role table privileges are empty.
- Final transaction rollback rehearsal: PASS; post-rehearsal public baseline returned to 21 customers, 22 devices, 1 order and 5 events.
- Formal transaction: PASS and committed.
- Final target counts: 3665 customers, 6286 devices, 6285 orders and 6289 events, including one pre-existing real order and its records.
- Imported totals: quotation EUR 335021.50; deposit EUR 39192.51; money violations 0.
- Imported distributions: completed 5485, cancelled 623, parts_arrived 58, parts_ordered 43, notified 40, mail_in_progress 13, unfixed_pickup 9, diagnosing 9, repaired 4; paid 692, partial 1075, unpaid 4517.
- Exact remaining demo parents/tags: 0/0/0. Other-store customers/devices/orders/events remain 1/1/1/1.
- Outbound side effects: 0 message logs, 0 attachments, 0 payment-ledger rows. Consent true counts are 0 for required notification, marketing and SMS.
- Selective post-commit rollback rehearsal: PASS and forced rollback; committed import remained intact afterward.
- Receipt: `/tmp/repairdesk-seatable-import/production-import-receipt-v2.json`, mode `0600`, SHA-256 `302ac157147448f1e187df1d376d2a66aa180b441c9e21f1dac9eff620e34fe3`.
- Full verification: 106 Vitest files / 716 tests, ESLint, TypeScript, agent checks, diff check and production build passed. Initial build failure was sandbox-only port/process denial; escalated rerun passed.
- Visual verification was attempted on the production orders page but redirected to RepairDesk login because the in-app browser had no RepairDesk session. No login-page screenshot is used as result evidence; database verification and the private receipt are the substitute.

## 2026-07-16 — Latest-main repository packaging

- Baseline: `origin/main@6717932e`, isolated branch `codex/seatable-import-closeout-20260716`.
- Preserved latest-main rule: free-text problem/work fields cannot create notification or handover evidence; `修好已通知/修好一通知` map to `notified`, while notification-only states keep `delivered_at = null`.
- Secure-output contract: repository-local output and symlink targets rejected; private parent required; file mode forced to `0600`; production owner email accepted only from `SEATABLE_OWNER_EMAIL`.
- Local CLI dry-run: one synthetic row, `No mutation performed`; preview and manifest both `0600`, parent directory `0700`, `pii_mode=pseudonymized_restricted`, `production_mutation_authorized=false`.
- Verification: targeted 4 files / 24 tests; full 140 files / 960 tests; lint, typecheck, agents check and diff check PASS; webpack build PASS with 22 pages.
- Default Turbopack build was blocked by the isolated worktree's external dependency symlink; it did not report a source-code error.
- No production read, write, preflight, cleanup, reclassification or rollback command ran during packaging.
