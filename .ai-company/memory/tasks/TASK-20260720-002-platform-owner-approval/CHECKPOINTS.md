# Checkpoints — TASK-20260720-002-platform-owner-approval

## 2026-07-20T21:31:13Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-20T21:31:14Z — Scoped release candidate isolates platform approval authority to the verified canonical project owner. App, migration, focused and full test evidence are green; production writes are not yet applied.

- **Phase:** release_ready
- **Completed/current state:** Scoped release candidate isolates platform approval authority to the verified canonical project owner. App, migration, focused and full test evidence are green; production writes are not yet applied.
- **Next:** Obtain final DATA and QA gates, commit the exact allowlist, revalidate origin and linked migration dry-run, then deploy app first and apply the database migration only after production verification.
- **Decision:** Deploy from an isolated origin/main worktree; retain hardened app if schema rollback is required; do not include unrelated root changes.
- **Blocker:** Database apply remains conditional on final DATA/QA review, fresh preflight, active release lease, and verified application deployment.
- **Evidence:**
  - 55 focused tests and 2152 full-suite tests passed; lint, typecheck, Node 24 build, migration-history alignment, candidate-only dry-run, and aggregate preflight counts passed.
- **Recorded by:** RepairDesk Integration Lead
## 2026-07-20T21:50:55Z — R4/L1 scoped candidate passed PostgreSQL 17 production-schema replay, negative and positive authorization fixtures, 2152-test sequential suite, lint, typecheck, and Node 24 production build. No production write has occurred.

- **Phase:** release_candidate_verified
- **Completed/current state:** R4/L1 scoped candidate passed PostgreSQL 17 production-schema replay, negative and positive authorization fixtures, 2152-test sequential suite, lint, typecheck, and Node 24 production build. No production write has occurred.
- **Next:** Stage and commit the exact 16-file allowlist, deploy the hardened application first, observe and smoke it, then perform fresh live database gates before applying only migration 20260720231500.
- **Decision:** Risk/autonomy corrected to R4/L1. Root dirty worktree remains excluded. Database rollback must retain the hardened app and use a separately approved forward-fix migration.
- **Blocker:** Database apply remains blocked until exact app deployment is READY and observed, and fresh linked migration, identity/history/collision, size/lock, backup, and lease gates pass.
- **Evidence:**
  - PostgreSQL replay validated constraint, triggers, function ACLs, non-owner denial, review_scope bypass denial, owner approval, and transactional removal order. Final rerun: 329 files and 2152 tests passed; lint/typecheck exit 0; 27-page build passed.
- **Recorded by:** RepairDesk Integration Lead
