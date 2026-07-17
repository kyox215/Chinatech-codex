# Handoff / Resume — TASK-20260717-001-worktree-delivery-integration

## Current handoff

- **Status:** local release candidate ready; waiting for Owner D3 production/push approval.
- **Last verified:** 2026-07-17T01:59:56Z.
- **Workspace/branch:** `/private/tmp/repairdesk-worktree-delivery-final-20260717`; `codex/worktree-delivery-final-20260717`.
- **Source preservation:** stash `60dc732c316f5152befa15a48b0fdef4d81b0aba`, ref `preserve/worktree-delivery-20260716`, recovery directory `/private/tmp/repairdesk-preservation-verify-20260716`; all original content remains recoverable.
- **Root checkout:** clean `main@origin/main@7a1d2330`. The first 18 residuals are recoverable through stash/ref `1186ee89`; 25 branch-switch conflict copies are recoverable through stash/ref `6147070d`. Do not restore either cleanup stash onto main.
- **Completed:** latest-main integration; Kiosk/order/print/notify/mock/cache/feature-gate/dialog fixes; PG17 migration replays; 997 tracked duplicate/conflict paths removed, including 303 PNG copies (290 under `screenshots/`); invalid worktree metadata pruned; root residuals archived.
- **Validation:** post-cleanup Agent rules, lint, typecheck, 203 files/1398 Vitest, 7 files/34 focused tests, Webpack production build 22/22 routes and diff checks pass. The content-identical runtime candidate before repository-only cleanup also passed standard Turbopack, Settings 67/67 and desktop 44/44 E2E.
- **Local closeout commits:** `31abfa04` business/security hardening, `d7899aed` customer nested dialogs, `27dd3a24` lint hygiene, `a971e207` exact duplicate cleanup, `55e3c0fa` stale snapshot cleanup/document correction, `3a9b48ff` extensionless duplicate cleanup. Nothing from this candidate has been pushed.
- **Release blockers by policy:** production has not received `20260714180000_kiosk_integrity_expand.sql` or `20260717030000_order_device_custody_security_hardening.sql`; `main` auto-deploys, so code must not be pushed before DB-first apply/postcheck authorization.
- **Residual risk:** Kiosk create/review remains guarded but not one database transaction. Do not silently widen this task into a new RPC; open a dedicated DATA/SEC task if Owner wants full atomicity.
- **Environment risk:** the root path is under Documents/File Provider synchronization. A branch switch produced complete old-blob ` 2` conflict copies. If it recurs, migrate the development clone to a non-synchronized path; do not hide the files with `.gitignore`.
- **Resume order:** read `TASK.md`, `EVIDENCE.md`, latest `CHECKPOINTS.md`; fetch/prune; verify candidate SHA, zero duplicate scan and migration history; obtain explicit D3 approval; apply the two forward migrations in order with postchecks; only then push app and verify Vercel/runtime.
- **Rollback:** application can roll back to prior READY deployment; database changes must use a new forward-fix migration, never drop columns/constraints or rewrite applied history.
