# Memory Delta — TASK-20260711-001-seatable-repairdesk-import

- SeaTable repair import can now proceed from the local export created through the owner’s logged-in in-app browser session: `/tmp/repairdesk-seatable-import/riparazione-default.csv`.
- For RepairDesk, production SeaTable import is not covered by the local-only `db:import:seatable -- --apply` script. Use dry-run preview first and design a production staging/import/swap path before writing.
- The import mapper now treats `到货一通知` as `parts_arrived` with `notify_status=sent`, and `修好一通知` as `notified`.
- Detailed import previews should be written to a local 0600 file, redacted by default, and not printed with raw warning values. Full PII preview requires explicit `--preview-include-pii` and must not be copied to chat/memory/screenshots.
- Default redacted preview must also redact warning raw values; otherwise phone/problem data can leak through warning payloads.
- Existing SeaTable/reset scripts must not be used for production “only clear test data”; they are store-domain clear/import tools. Production cleanup needs import-batch provenance and child-to-parent deletion checks.
- The safe package now supports deterministic UUIDv5 entities, source/batch-namespaced public numbers, fixed fallback timestamps, redacted manifests and read-only production preflight. It does not provide production apply.
- Target project/store/active owner and zero global collisions were verified read-only. The baseline is stored only in the private preflight artifact.
- Cleanup preview found 20 triple-marked demo orders: 13 eligible for owner review and 7 blocked by extra events or attachments. Payment-ledger blockers were zero.
- Four rows have deposits greater than quotation; this is a production blocker in the target-bound manifest and must not be silently truncated.
- Imported historical customers must not infer SMS/marketing consent, and created events must not retain raw source rows.
- Owner approved `raise_quotation_to_deposit` for the four money-overage rows and accepted all default fallbacks; the production batch imported all 6284 rows successfully.
- For one-time high-risk imports, a private non-Data-API schema with explicit API-role revokes, deterministic batch/entity provenance, set-based inserts and store-scoped advisory locking provided an auditable production path without weakening the existing local-only apply guard.
- Final production commit must reuse the exact transaction body that passed a forced-rollback rehearsal; compare the files so only the final `ROLLBACK`/`COMMIT` statement differs.
- Retain exact test-parent before-images and imported entity IDs through a bounded rollback window. Automatic rollback must fail closed after any new order event, payment, message, attachment, CRM activity, external reference or row update.
- Production import completed with other-store counts unchanged, zero outbound side effects, zero inferred notification/marketing/SMS consent and a PII-free audit record.
- Capability review: this is strong task-specific evidence for DATA/SEC-guided import execution, but one successful production migration does not justify any permission or autonomy upgrade.
