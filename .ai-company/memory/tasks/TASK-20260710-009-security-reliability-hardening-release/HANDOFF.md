# Handoff / Resume — TASK-20260710-009-security-reliability-hardening-release

## Current handoff

- **Status:** linked payment-only DB migration applied and post-apply checks passed; scoped commit/push pending.
- **Last verified:** 2026-07-10T18:44:52Z.
- **Workspace/branch:** local `main` equals fetched `origin/main` at `705c7511`; dirty user assets are listed in `EVIDENCE.md` and must remain untouched.
- **Read first:** `TASK.md`, `EXECUTION_PLAN.md`, latest `CHECKPOINTS.md`, root `AGENTS.md`, health audit report.
- **Completed:** customer permission gates, trusted email evidence, runtime enums/payment precision, deterministic >1000 reads, destructive-script guards, CSRF origin resolution, strict E2E harness, and additive atomic/idempotent payment ledger/RPC.
- **Verified:** targeted code tests; pgTAP 19/19 on linked-schema clone; linked exact pending set; typecheck; full test 106/710; production build; E2E 11/11; linked post-apply catalog/privilege checks and final dry-run up to date.
- **Critical residual risk:** 17 linked public legacy tables still have RLS disabled with direct browser-role grants; full historical reset still fails; backup/PITR restore proof is absent. The Owner approved a bounded payment-only exception, not a normal environment Gate PASS.
- **UI boundary:** exclude `src/features/orders/forms/customer-intake-lookup.tsx`, TASK-010 task memory/screenshots, `next-env.d.ts`, old screenshots and every duplicate-like asset.
- **First action:** stage only TASK-009 release files, validate cached diff, commit and push `main`.
- **Stop:** do not apply unrelated migrations, TASK-010/TASK-011 UI work, duplicate assets, legacy-table RLS containment, unlock credential cleanup, or PostgREST cache reload without a separate explicit scope.
