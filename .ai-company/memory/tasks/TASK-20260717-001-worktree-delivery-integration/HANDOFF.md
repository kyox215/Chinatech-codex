# Handoff / Resume — TASK-20260717-001-worktree-delivery-integration

## Current handoff

- **Status:** local release candidate ready; waiting for Owner D3 production/push approval.
- **Last verified:** 2026-07-17T01:31:00Z.
- **Workspace/branch:** `/private/tmp/repairdesk-worktree-delivery-final-20260717`; `codex/worktree-delivery-final-20260717`.
- **Source preservation:** stash `60dc732c316f5152befa15a48b0fdef4d81b0aba`, ref `preserve/worktree-delivery-20260716`, recovery directory `/private/tmp/repairdesk-preservation-verify-20260716`; original checkout remains untouched.
- **Completed:** latest-main integration; Kiosk/order/print/notify/mock/cache/feature-gate/dialog fixes; PG17 migration replays; 203/1398 Vitest; standard build; Settings 67/67 and desktop 44/44 E2E; four independent read-only reviews.
- **Local closeout commits:** `31abfa04` business/security hardening, `d7899aed` customer nested dialogs, `27dd3a24` lint hygiene; task evidence is the final local documentation commit. Nothing from this candidate has been pushed.
- **Release blockers by policy:** production has not received `20260714180000_kiosk_integrity_expand.sql` or `20260717030000_order_device_custody_security_hardening.sql`; `main` auto-deploys, so code must not be pushed before DB-first apply/postcheck authorization.
- **Residual risk:** Kiosk create/review remains guarded but not one database transaction. Do not silently widen this task into a new RPC; open a dedicated DATA/SEC task if Owner wants full atomicity.
- **Resume order:** read `TASK.md`, `EVIDENCE.md`, latest `CHECKPOINTS.md`; fetch/prune; verify candidate SHA and migration history; obtain explicit approval; apply the two forward migrations in order with postchecks; only then push app and verify Vercel/runtime.
- **Rollback:** application can roll back to prior READY deployment; database changes must use a new forward-fix migration, never drop columns/constraints or rewrite applied history.
