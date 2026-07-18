---
schema_version: 1
department: operations
status: active
owner: Operations Department / Integration Lead
last_verified_at: 2026-07-18
review_trigger: relevant-task-or-quarterly-review
---

# Business Operations Department Memory

## Mission and boundary

Support, customer communication, vendors, financial/legal escalation, and operating procedures.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain runbooks, deployment readiness, backup/restore, incident handoff, and workspace hygiene.
- First priority: continue workspace hygiene by deciding whether generated/ignored output cleanup is worth doing; source-tree duplicate files and empty duplicate directories are now clean.

## Verified rules and conventions

- As of `TASK-20260709-220940-task` closeout on 2026-07-10, the original checkout `main` was protected and synced to `origin/main` at `d2e3cff1`: old local HEAD is preserved at `preserve/original-main-before-sync-20260710-0030`, original pre-sync dirty/untracked work is saved in `stash@{1}`, and later external mobile-performance residual is saved in `stash@{0}`. Use stash messages to identify restore targets because numeric indices can shift.
- Duplicate `* 2.*` files must not be deleted without owner confirmation.
- Differing duplicate review result corrected by `TASK-20260619-006`: 18 remove-after-Owner-confirmation, 12 remove-after-domain-confirmation, and 2 backlog/salvage-only candidates.
- Batch A cleanup completed in `TASK-20260619-006`; Batch B and Batch C remain intentionally untouched.
- Batch B semantic confirmation completed in `TASK-20260619-008`; the 12 Batch B duplicates are ready for a separate Owner-approved deletion task.
- Batch B cleanup completed in `TASK-20260619-009`; the 12 confirmed stale duplicates were deleted, while Batch C and other duplicate-like files remain for separate decisions.
- Batch C review completed in `TASK-20260619-010`; one file is delete-only and one file should preserve a future E2E backlog idea before deletion.
- Batch C cleanup completed in `TASK-20260619-011`; both reviewed Batch C duplicate files were deleted after preserving `QA-BACKLOG-20260619-001`.
- Current byte-identical duplicate cleanup completed in `TASK-20260619-012`; 70 verified byte-identical duplicate files were deleted, and the Git-visible byte-identical duplicate count is now 0.
- Three now-different duplicate files remain and must be reviewed in a separate task before delete/merge decisions: `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, and `src/server/tenant-guard.test 2.ts`.
- `TASK-20260619-013` reviewed the three now-different duplicate files and classified all three as delete-only candidates for a later explicit cleanup task.
- `TASK-20260619-014` deleted those three reviewed duplicate files; final Git-visible untracked ` 2` duplicate scan with canonical counterparts reports `same=0 diff=0 missing=0 nonfiles=0`.
- `TASK-20260619-015` removed the 14 confirmed empty duplicate directories. Remaining duplicate-like paths are generated/ignored outputs only and should not be treated as source-tree conflicts.
- Production data, deploy, destructive commands, and external communication require explicit owner approval.
- For approved production imports, retain a current target-domain before-image, receipt hashes, exact imported IDs and exact deleted-parent before-images. Rehearse both transaction rollback and selective post-commit recovery; stop automatic rollback after later business activity.
- `TASK-20260714-001-buyback-sensitive-evidence-feature-off` used a clean isolated worktree and one writer, pushed code commit `70d211b2` to `main`, and exact-SHA verified Vercel production, aliases, HTTP and empty error/5xx observation. Linked Supabase postchecks were read-only. Older deployments are not safe rollback targets because they reopen sensitive evidence capture; stop `/buyback` and forward-fix unless the Owner explicitly accepts that risk for a severe whole-system outage.
- `TASK-20260714-002-buyback-supabase-schema-staging` serialized the production database release from frozen `main@66aa468e`: exact dry-run selected one migration, official CLI apply succeeded, post-apply dry-run is up to date and delayed observation stayed empty/revoked. Eight completed physical backups were visible, but PITR is off and no restore drill was performed; recovery remains feature-off plus revoke/forward-fix.
- `TASK-20260716-003-customer-finance-order-correction-plan` observed one successful exception path using an isolated worktree and serialized DB executor when CLI authentication was unavailable: exact pending migration parity, current-schema PG17 restore/replay, pgTAP, immediate migration-list re-read and metadata/ACL/data/advisor postchecks before application push. Treat this as a proposed bounded exception requiring Owner/release approval, not an approved general fallback and not proof that CLI dry-run, historical migration reset or PITR restore is healthy.
- The same task's application release is scoped-verified at Vercel deployment `dpl_Buv1EGr9wizVgZ1YogCKgwSGenbq` for exact SHA `e83527379ddc048940ac628fb72821d60b2c8c91`. An initial author-identity rejection was contained before build/alias change; the Owner-linked retry reached `READY`, passed anonymous login/protected-route/API checks, and showed no scoped runtime error cluster or error/fatal log during observation.
- Settings must be split into independent code-only, member, Kiosk, workflow, order-data preview/export,
  and order-data Apply release units. Use a clean latest-main worktree, serialized release owner, exact
  target/config/migration assertions, observation owner, and rollback/forward-fix record.
- `TASK-20260717-004-order-diagnosis-quote-implementation` completed a serialized DB-first release from an isolated worktree while preserving the dirty primary checkout. A concurrent main/migration-replay repair was absorbed before non-force push; the single pending migration was applied and postchecked before `main@6e511c56` reached Vercel READY with clean 15-minute error observation.
- `TASK-20260717-007-store-lifecycle-implementation` used an isolated latest-main worktree to preserve unrelated root changes, applied exactly six reviewed lifecycle migrations, and non-force pushed implementation SHA `55cb7ab5`. Keep all five flags off until a separate activation task proves disposable-store flows, encrypted sink/KMS and restore; any real purge needs a second exact-target approval.
- `TASK-20260718-009-ai-assistant-implementation` released the AI Phase 0–2 code as an intentionally dormant unit from an isolated worktree. The operational proof combines exact `main@8bef230`, READY deployment `dpl_HWmQRHjy9XRYPMvLT1E1oraee7jr`, absence of production AI/OpenAI variable names, anonymous auth/API smoke, empty error-level observation and READY rollback deployment `dpl_5tbk1iFUafSExZK3ezWAkxoawQSi`. No key, migration or live provider was released.

## Interfaces and dependencies

`TASK-20260718-008-order-cost-phase2` verifies the serialized database-first release sequence:
atomic release lock, fresh remote/history/dry-run/backup/advisor assertions, exact migration apply,
postchecks, non-force main push, exact-SHA Vercel READY, child flags absent, browser/log/data
observation, then lock release. Owner exceptions must be recorded separately and do not convert a
scoped slice into broad recovery certification.

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Serialized DB-first release | Data + Security + QA + Integration Lead | Freeze exact migrations, replay target schema, apply one sequence, postcheck before app push | Stop on remote interleave/anomaly; preserve additive schema and forward-fix, never destructive rollback | TASK-20260716-003-customer-finance-order-correction-plan E-014, E-022..E-025 | scoped_verified |
| Dormant AI code release | Architecture + Security + QA + Integration Lead | Exact Git/deploy identity plus env-name-only fail-closed proof, anonymous denial smoke, error observation and READY rollback | Keep all flags absent/off; roll back deployment or revert scope commit; rotate provider key only on suspected leak | TASK-20260718-009-ai-assistant-implementation E-033–E-039 | scoped_verified_dormant |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| OPS-20260619-001 | Physical backup visibility is verified, but PITR is off and no isolated restore drill or complete recovery procedure is verified | Operational risk | Operations + Platform | recovery-baseline and restore-drill task | open |
| OPS-20260619-002 | Dirty worktree plus generated/ignored duplicate-like output can still create noise | Review/release risk | Operations + QA | generated-output cleanup if disk/workspace noise matters | monitoring |
| OPS-20260619-003 | Duplicate cleanup without fresh scan and explicit path list could remove semantic evidence | Governance/review risk | Operations + QA | before deleting newly discovered or now-different duplicate-like files | open |
| OPS-20260619-004 | Batch C cleanup could lose the attachment-inventory E2E idea | QA backlog loss | Operations + QA | backlog note created and Batch C duplicates deleted by TASK-20260619-011 | closed |
| OPS-20260713-001 | A Settings candidate can become stale or lose release ownership as main advances | Wrong artifact or uncontained release | Operations + Integration Lead + Owner | require fresh origin, exact target/baseline, on-call, window and recovery owner before push/PR/deploy | open |
| OPS-20260718-002 | Inventory V2 Web code is deployed while schema/RPC/allowlist remain intentionally inactive | An operator could enable child flags out of order or remove the V1 rollback path | Operations + Data + Security + Owner | run the release runbook in order; schema-ready first, one-store canary later, keep legacy mutations on during observation | contained_by_runbook_and_flags_off |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk operations baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Added cleanup-batch decision package from differing duplicate review | TASK-20260619-005 | Integration Lead | active |
| 2026-06-19 | Removed Batch A stale duplicates and corrected cleanup counts | TASK-20260619-006 | Integration Lead | active |
| 2026-06-19 | Confirmed Batch B is ready for deletion approval package | TASK-20260619-008 | Integration Lead | active |
| 2026-06-19 | Removed 12 confirmed stale Batch B duplicate files; Batch C remains | TASK-20260619-009 | Integration Lead | active |
| 2026-06-19 | Classified Batch C as one delete-only file plus one salvage-first E2E backlog idea | TASK-20260619-010 | Integration Lead | active |
| 2026-06-19 | Preserved Batch C E2E backlog idea and removed two Batch C duplicate files | TASK-20260619-011 | Integration Lead | active |
| 2026-06-19 | Removed 70 current byte-identical duplicate files and preserved three now-different duplicates for review | TASK-20260619-012 | Integration Lead | active |
| 2026-06-19 | Classified the three remaining now-different duplicates as delete-only candidates | TASK-20260619-013 | Integration Lead | active |
| 2026-06-19 | Deleted the three reviewed remaining duplicate files and cleared Git-visible duplicate-file scan | TASK-20260619-014 | Integration Lead | active |
| 2026-06-19 | Removed 14 confirmed empty duplicate directories and classified remaining duplicate-like paths as generated output | TASK-20260619-015 | Integration Lead | active |
| 2026-07-10 | Protected dirty original checkout with branch/stash and synced local `main` to latest `origin/main` | TASK-20260709-220940-task | Integration Lead | active |
| 2026-07-11 | Added verified import backup/receipt, dual rollback rehearsal and bounded private-staging retention | TASK-20260711-001-seatable-repairdesk-import | Integration Lead | verified |
| 2026-07-14 | Recorded exact-SHA production feature-off release, no-write Supabase postcheck and unsafe-rollback boundary | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Integration Lead | active |
| 2026-07-14 | Recorded serialized dormant-schema apply, exact migration parity, backup/PITR evidence and forward-fix recovery boundary | TASK-20260714-002-buyback-supabase-schema-staging | Integration Lead + release reviewer | scoped_verified |
| 2026-07-16 | Recorded serialized four-migration DB-first apply with clone replay and exact postchecks | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + DATA/SEC/QA reviewers | scoped_verified |
| 2026-07-17 | Recorded exact-SHA Vercel release, contained identity block, production auth-boundary smoke and clean runtime observation | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + release reviewers | scoped_verified |
| 2026-07-13 | Recorded Settings split-release, serialized integration, observation and rollback ownership contract | TASK-20260712-004-settings-center-master-plan | Integration Lead + WP08 release reviewer | no_go |
| 2026-07-17 | Recorded serialized single-migration quote release, concurrent-main absorption, exact-SHA deployment and clean runtime smoke | TASK-20260717-004-order-diagnosis-quote-implementation | Integration Lead + DATA/SEC/QA/Release reviewers | scoped_verified |
| 2026-07-18 | Recorded serialized six-migration cost release, exact business SHA deployment, dormant flags and clean database/runtime observation | TASK-20260718-008-order-cost-phase2 | Integration Lead + DATA/SEC/QA reviewers | scoped_verified_option_b |
| 2026-07-18 | Recorded exact-SHA dormant AI release, no-key/no-flag configuration proof, anonymous smoke, clean error observation and READY rollback target | TASK-20260718-009-ai-assistant-implementation | Integration Lead + Security/QA/Release reviewers | scoped_verified_dormant |
| 2026-07-18 | Released Phase 3A dormant code by non-force push; verified exact-scope and final-main READY deployments, flags/key absent, fake/fail-closed provider, auth/API smoke, zero error/fatal/5xx and pre-scope READY rollback | TASK-20260718-011-ai-assistant-cost-governance | Integration Lead + Release reviewer | scoped_verified_dormant |
| 2026-07-18 | Recorded exact-migration apply, non-force main integration, exact-SHA READY deploy, production smoke, rollback target and preservation of the mixed source checkout | TASK-20260718-012-workspace-integration-release | Integration Lead + Data/Security/QA reviewers | scoped_verified |
