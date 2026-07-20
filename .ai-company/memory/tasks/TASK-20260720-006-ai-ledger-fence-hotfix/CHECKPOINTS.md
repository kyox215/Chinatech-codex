# Checkpoints — TASK-20260720-006-ai-ledger-fence-hotfix

## 2026-07-20T06:48:24Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-07-20T07:25:00Z — Release candidate checkpoint

- **Phase:** validated release candidate; production approval gate.
- **Workspace:** isolated worktree `/private/tmp/repairdesk-ai-ledger-fence-hotfix-20260720`, branch `codex/ai-ledger-fence-hotfix-20260720`, baseline `origin/main@0a0ec0f5a7b3aa4fc992977da172732576686379`.
- **Completed:** confirmed the production failure occurs before OpenAI dispatch; created the single forward migration, static regression coverage, PostgreSQL behavior fixture, concurrency proof, operator docs and release plan.
- **Database evidence:** PG17 applied the hotfix twice and returned `ai_usage_lifecycle_fence_harness_passed`; reserve-first and close-first sessions each produced one committed side and one complete rollback. Production aggregate-only preflight is 0 / 0 / 0 for reserved / non-active reserved / expired reserved.
- **Quality evidence:** agents, lint, typecheck, focused 8/95, full 319/2105, production build and `git diff --check` pass. Initial build attempts were environment-only failures (missing isolated OCR dependency, then blocked Google Fonts); exact lockfile install and network-enabled rerun passed without source or lockfile changes.
- **Migration evidence:** local and remote history align through `20260720013000`; linked dry-run lists only `20260720065246` and did not apply it.
- **Independent reviews:** DATA GO, SEC PASS/GO, QA technical PASS / production CONDITIONAL.
- **Decisions:** use a table-specific mixed-bucket trigger; freeze global identity and forbid global delete; retain active-store shared fence; block lifecycle exit while any reservation is unsettled; reuse `STORE_LIFECYCLE_BLOCKED` with PII-free detail.
- **Production status:** no Git push, migration apply, Vercel deploy, flag/policy/secret change, provider smoke or external customer communication occurred.
- **Approval blocker:** Owner must explicitly approve committing/pushing this exact candidate and applying only migration `20260720065246` to linked production.
- **Residual risks:** future `stores.status active→suspended` could strand an in-flight reservation and must receive an equivalent guard before a suspension write path is enabled; open/expired reservation intentionally blocks close until maintenance/finalization settles it; full historical migration reset drift is outside this hotfix.
- **Visual evidence:** no related task page can represent a database trigger repair before production apply; alternative evidence is the migration, PG17 harness sentinel, aggregate-only production query and full quality gates. No screenshot was fabricated.
- **Next:** after explicit approval, revalidate SHA/history, create a scoped commit, push without unrelated files, apply only the named migration, verify catalog/ACL/aggregates, run one non-PII order-text smoke, and observe at least 15 minutes.

## 2026-07-20T12:27:58Z — Production release authorized

- **Phase:** production release authorized; no production write yet.
- **Approval:** Owner replied `批准` to the exact selected action `批准上线热修复 20260720065246`.
- **Refreshed evidence:** fetched `origin`; candidate and `origin/main` remain `0a0ec0f5`; migration SHA remains `fdbd4b605fdbb2147a475f4d2adea7d43b5041e1ad5e4f1102de0222a23ca89d`; project `xluzcoduqsdvjoouqhkc` is `ACTIVE_HEALTHY` on PostgreSQL 17; history ends at `20260720013000`; linked dry-run lists only `20260720065246`; reservations are 0 / 0 / 0; concurrent schema-release/lifecycle-mutation sessions are 0 / 0.
- **Scope:** scoped Git commit/push and exactly one linked production migration are approved. No Vercel deploy, PR merge, other migration, Vision smoke, flag/policy/model/secret/quota change or lifecycle mutation is authorized.
- **Stop conditions:** any remote-base drift, migration-hash drift, extra pending migration, nonzero reservation, concurrent release/lifecycle mutation, lock timeout or post-apply invariant failure.
- **Next:** commit and push the isolated candidate branch; repeat dry-run; apply only the named migration; run zero-cost postchecks, one non-PII order-text canary and a minimum 15-minute observation.
