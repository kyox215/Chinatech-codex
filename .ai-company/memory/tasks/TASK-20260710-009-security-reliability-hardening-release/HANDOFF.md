# Handoff / Resume — TASK-20260710-009-security-reliability-hardening-release

## Current handoff

- **Status:** conditionally closed; payment-only DB migration, scoped main push and automatic production deployment completed.
- **Last verified:** 2026-07-10T19:03:17Z.
- **Workspace/branch:** fetched `origin/main` is `cee5a1b4`; original dirty user assets remain outside the commit and must remain untouched.
- **Read first:** `TASK.md`, `EXECUTION_PLAN.md`, latest `CHECKPOINTS.md`, root `AGENTS.md`, health audit report.
- **Completed:** customer permission gates, trusted email evidence, runtime enums/payment precision, deterministic >1000 reads, destructive-script guards, CSRF origin resolution, strict E2E harness, and additive atomic/idempotent payment ledger/RPC.
- **Verified:** targeted code tests; pgTAP 19/19 on linked-schema clone; linked exact pending set; typecheck; full test 106/710; production build; E2E 11/11; linked post-apply catalog/privilege checks and final dry-run up to date.
- **Critical residual risk:** 17 linked public legacy tables still have RLS disabled with direct browser-role grants; full historical reset still fails; backup/PITR restore proof is absent. The Owner approved a bounded payment-only exception, not a normal environment Gate PASS.
- **UI boundary:** exclude `src/features/orders/forms/customer-intake-lookup.tsx`, TASK-010 task memory/screenshots, `next-env.d.ts`, old screenshots and every duplicate-like asset.
- **Release:** Vercel deployment `dpl_CehRUKZ7WhybvvJhbaFFQZjwnwKA` is Ready on production aliases; the initial 20-minute error query returned no entries.
- **First follow-up:** create a separate P0 legacy-table consumer-discovery/containment task and a separate recovery/restore-evidence task.
- **Stop:** do not apply unrelated migrations, TASK-010/TASK-011 UI work, duplicate assets, legacy-table RLS containment, unlock credential cleanup, schema-cache reload or rollback under TASK-009.
