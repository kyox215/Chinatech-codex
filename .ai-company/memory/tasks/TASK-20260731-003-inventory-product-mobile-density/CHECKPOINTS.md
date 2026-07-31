# Checkpoints — TASK-20260731-003

## CP-01 — contract and baseline frozen

- Registry task/run/window and immutable context packet v2 verified.
- Classified `T3/R2/L2`; Owner approved push and production deployment.
- Nova, Aster and Gaia completed independent architecture/product, UX and data-contract reviews.
- Safe integration path fixed as `b2598713` + replayed production repair fix `a9e6db44`.

## CP-02 — implementation complete

- Isolated branch `codex/inventory-mobile-density-20260731` contains replay commit `b6332f8c`.
- Product list, quick intake, detail and edit density/access/compatibility changes complete.
- No product API, server, DTO, permission, schema, migration, dependency or environment change.
- Full planning document and affected UI standards synchronized.

## CP-03 — pre-release gates complete

- lint PASS; typecheck PASS; Vitest 388/388 files and 2538/2538 tests PASS.
- Production build PASS with canary configuration.
- Chromium 16/16 and WebKit 16/16 inventory E2E PASS.
- Ten final screenshots created from synthetic, masked fixtures and manually reviewed.
- Historical screenshots overwritten by regression tests were restored exactly from Git.
- Awaiting independent QA, final diff checkpoint, integration lease, commit/push/deploy and production smoke.

## CP-04 — independent QA blocker remediated

- Independent QA returned FAIL/NO-GO with one P1: observer-level `keepPreviousData` could preserve store A list data after switching to store B; it also found a P2 action-bar horizontal offset inherited from `surfaces.stickyActions`.
- Release stopped before commit. Query placeholder now returns previous data only when the previous list key matches the current exact store scope; cross-store and unscoped data return no placeholder.
- Added two query-option tests for same-store retention and cross-store/unscoped rejection.
- Added `mx-0` to both fixed action bars and E2E assertions for symmetric insets ≥8px.
- Remediation evidence: four targeted unit files / 13 tests PASS; typecheck PASS; lint PASS; Chromium density 5/5 PASS; WebKit density 5/5 PASS; regenerated screenshots visually centered.
- Integration lease v1 is held by this window until `2026-07-31T08:20:54Z` and must be rechecked before every external step.
- Awaiting the same QA reviewer's remediation verdict, then final diff, commit, remote reconciliation, push and deploy.

## CP-05 — quality gate PASS

- Same independent QA reran a real QueryObserver check: A→B yields no data and no placeholder; same-store filter change retains the previous result as intended.
- Query-option tests 2/2 PASS; action-bar screenshot and inset assertions PASS.
- Independent verdict: PASS / GO; P0/P1/P2 = 0/0/0.
- Post-remediation full Vitest: 389 files / 2540 tests PASS.
- Next: validate exact diff and lease, commit, reconcile latest remote `main`, push and deploy exact SHA.
