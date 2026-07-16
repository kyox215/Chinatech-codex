# Handoff — TASK-20260711-001-seatable-repairdesk-import

## Resume Summary

The production objective is complete. Owner-approved cleanup removed the exact 20 proven demo parents, and 6284 SeaTable repair rows were imported after private staging, forced rollback rehearsal, guarded commit, independent verification and selective recovery rehearsal. Do not rerun the import or reclassification. Repository packaging was later recovered onto latest `origin/main` under `TASK-20260716-004`.

## Current Code Changes

- `src/features/orders/import/seatable-riparazione.ts`
  - Adds Chinese status mapping and modern side-status fields for imports.
  - Prioritizes strong source `STATO` labels such as `修好`, `修好已通知`, `到货已通知`, `寄修`, and `欠款 已拿走`.
- `src/features/orders/import/seatable-riparazione.test.ts`
  - Adds status and side-status tests.
- `scripts/import-seatable-riparazione.ts`
  - Adds `--preview-out` detailed dry-run JSON output.
  - Labels default row output as restricted pseudonymized data; it is not anonymous.
  - Requires an owner-only directory outside the repository, rejects symbolic-link targets, and forces output mode `0600` after every write.
  - Requires `--confirm-private-output` before full PII preview or warning values; production owner email comes from `SEATABLE_OWNER_EMAIL`, never a CLI argument.
  - Adds batch/fallback/manifest arguments plus read-only production preflight and cleanup preview.
  - Verifies target owner/store, baselines, money invariants and global collisions without enabling production mutation.
- `src/features/orders/import/seatable-import-provenance.ts`
  - Generates deterministic UUIDs, batch/source public-number namespaces and strict demo-test markers.

## Verified Commands

```bash
git diff --check -- scripts/import-seatable-riparazione.ts src/features/orders/import/seatable-riparazione.ts src/features/orders/import/seatable-riparazione.test.ts .ai-company/memory/ACTIVE_CONTEXT.md .ai-company/memory/tasks/TASK-20260711-001-seatable-repairdesk-import
npx vitest run src/features/orders/import/seatable-riparazione.test.ts
npm run typecheck
npx eslint scripts/import-seatable-riparazione.ts src/features/orders/import/seatable-riparazione.ts src/features/orders/import/seatable-riparazione.test.ts
```

The historical checks passed. During 2026-07-16 packaging, the latest-main targeted suite passed 4 files / 24 tests; full branch gates are recorded separately when complete.

## Local Data Artifacts

- Source workbook, CSV, previews, manifests, preflight, cleanup evidence and before-images are private owner-only artifacts outside the repository; exact paths are intentionally omitted.
- Repository-safe aggregate evidence is in `DATA_AUDIT_REPORT.md`, `EVIDENCE.md` and the status reclassification receipt.
- Private rollback material has a recorded retention date of 2026-07-18 and requires explicit privacy/data approval before cleanup.

Final imported batch: 6284 orders, 3664 customers, 6284 devices, quotation total EUR 335021.50 and deposit total EUR 39192.51. The later reclassification receipt includes one pre-existing real order, explaining its EUR 25 / 20 higher aggregate totals; reclassification did not change money.

## Review Conclusions

- FLOW: status mapping accepted; `到货一通知` is parts-arrived plus notified side status, not pickup-stage.
- DATA: deterministic IDs, batch provenance, collision checks, exact tenant scoping and no broad clear were implemented for the completed one-time production path.
- SEC: the repository script remains local-only for mutation; the completed production transaction used a separately reviewed private staging/transaction path and does not authorize future production use.

## Required First Action

Do not rerun production. For repository work, inspect the latest-main code and task-owned diff, run local tests only, and preserve private rollback material until its approved retention decision.

## Safe Read-Only Preflight Command

```bash
# Set SEATABLE_OWNER_EMAIL in a private process environment first.
npm run db:import:seatable -- --file <private-source.csv> --import-batch-id <batch> --fallback-date <ISO> --project-ref <ref> --store-id <uuid> --preflight-prod --manifest-out <private-dir>/import-manifest.json --preflight-out <private-dir>/production-preflight.json --cleanup-preview-out <private-dir>/cleanup-preview.json
```

The output directory must be outside the repository and owner-only (`0700`). Use `--preview-include-pii --confirm-private-output` only when a full local review file is explicitly required.

## Stop Conditions

- Do not run `--apply` against production with the current script; it is intentionally local-only.
- Do not clear any data without exact `store_id`, backup path, row-count preview, recovery plan and owner approval.
- Do not include full customer PII in memory, logs, screenshots or final chat.
