# MEMORY INDEX

- Memory system status: `ACTIVE_CODEX_NATIVE_MINIMAL`
- Owner: Integration Lead / CKMO duties
- Last audit: 2026-07-17 CEST
- Current active context: [ACTIVE_CONTEXT.md](ACTIVE_CONTEXT.md)

## Active company/project memory

- [COMPANY_MEMORY.md](COMPANY_MEMORY.md)
- [PROJECT_MEMORY.md](PROJECT_MEMORY.md)
- [BACKLOG.md](BACKLOG.md)
- [GLOSSARY.md](GLOSSARY.md)
- [CAPABILITY_REGISTRY.md](CAPABILITY_REGISTRY.md)
- [LESSONS_LEARNED.md](LESSONS_LEARNED.md)
- [OPEN_CONFLICTS.md](OPEN_CONFLICTS.md)

## Department index

- RepairDesk department definitions remain in `AI智能部门管理/部门化管理设计.md`, `.agents/department-roster.md`, `.agents/skills/`, and `.codex/agents/`.
- Formal department memory files live under `departments/*.md`.
- Initial RepairDesk department baseline was synchronized by `tasks/TASK-20260619-003/PROJECT_TAKEOVER_REPORT.md`.

## Agent index

- The main Codex thread currently acts as CEO Agent and Integration Lead.
- Codex Native specialist definitions live under `.codex/agents/`; formal capability memory lives under `agents/<agent-id>.md`.
- Current all-agent capability baseline: [agents/AGENT_CAPABILITY_BASELINE_20260619.md](agents/AGENT_CAPABILITY_BASELINE_20260619.md).

## Active task index

- [TASK-20260718-009-ai-assistant-implementation](tasks/TASK-20260718-009-ai-assistant-implementation/TASK.md): Conditionally closed production release of the dormant AI Phase 0–2 safe slice; bounded staff order reads and image-to-unsaved-inventory-form review are live in code but all AI capabilities remain fail-closed with no production key, external call, migration or public activation. Phase 3–5 require separate D4 tasks.

- [TASK-20260718-008-order-cost-phase2](tasks/TASK-20260718-008-order-cost-phase2/TASK.md): Conditionally closed production order-cost Phase 2 release; six migrations and business `main@b8932b2c` are live, all five child flags remain off, no backfill ran, and Owner Option B leaves physical-restore/full-history recovery debt open.

- [TASK-20260718-095500-order-create-navigation-release](tasks/TASK-20260718-095500-order-create-navigation-release/TASK.md): Closed production fix for canonical `/orders/{id}` navigation after successful creation from both the direct page and list Dialog; E2E, full app gates, screenshot, exact main SHA and Vercel READY/runtime smoke are recorded.

- [TASK-20260717-007-store-lifecycle-implementation](tasks/TASK-20260717-007-store-lifecycle-implementation/TASK.md): Closed production schema/code release for UUID-bound store lifecycle P0-P5; six migrations and implementation commit `55cb7ab5` are verified on `main`, while all runtime flags and real store mutations remain off.

- [TASK-20260619-001](tasks/TASK-20260619-001/TASK_MEMORY.md): AI Company OS v2.0 adoption into RepairDesk project rules and runtime memory. Migrated from legacy runtime memory.
- [TASK-20260619-002](tasks/TASK-20260619-002/TASK.md): Upgrade RepairDesk AI Company OS rules to Codex Native v3.0.
- [TASK-20260619-003](tasks/TASK-20260619-003/TASK.md): RepairDesk project takeover and health baseline.
- [TASK-20260619-004](tasks/TASK-20260619-004/TASK.md): L2-001 duplicate files and dirty worktree inventory.
- [TASK-20260619-005](tasks/TASK-20260619-005/TASK.md): L2-002 review of 32 differing duplicate files before cleanup decision.
- [TASK-20260619-006](tasks/TASK-20260619-006/TASK.md): L2-003 cleanup of approved Batch A duplicate files.
- [TASK-20260619-008](tasks/TASK-20260619-008/TASK.md): L2-004 Product/Data confirmation for Batch B order workflow duplicate semantics.
- [TASK-20260619-009](tasks/TASK-20260619-009/TASK.md): L2-005 cleanup of confirmed-stale Batch B duplicate files.
- [TASK-20260619-010](tasks/TASK-20260619-010/TASK.md): L2-006 review of Batch C duplicate salvage candidates.
- [TASK-20260619-011](tasks/TASK-20260619-011/TASK.md): L2-007 preservation of Batch C backlog idea and duplicate cleanup.
- [TASK-20260619-012](tasks/TASK-20260619-012/TASK.md): L2-008 cleanup of current byte-identical duplicate files.
- [TASK-20260619-013](tasks/TASK-20260619-013/TASK.md): L2-009 review of remaining now-different duplicate files.
- [TASK-20260619-014](tasks/TASK-20260619-014/TASK.md): L2-010 delete reviewed remaining duplicate files.
- [TASK-20260619-015](tasks/TASK-20260619-015/TASK.md): L2-011 duplicate directory and generated-output hygiene.
- [TASK-20260619-016](tasks/TASK-20260619-016/TASK.md): L2-012 active context drift hygiene.
- [TASK-20260619-017](tasks/TASK-20260619-017/TASK.md): L2-013 task registry hygiene inventory.
- [TASK-20260619-018](tasks/TASK-20260619-018/TASK.md): L2-014 stale documentation drift inventory.
- [TASK-20260619-019](tasks/TASK-20260619-019/TASK.md): L2-015 active documentation fix batch A.
- [TASK-20260619-020](tasks/TASK-20260619-020/TASK.md): L2-016 archive snapshot banners for historical planning docs.
- [TASK-20260619-021](tasks/TASK-20260619-021/TASK.md): L2-017 active documentation metadata convention.
- [TASK-20260619-022](tasks/TASK-20260619-022/TASK.md): L2-018 legacy route migration plan refresh.
- [TASK-20260619-023](tasks/TASK-20260619-023/TASK.md): L2-019 order-list legacy route migration implementation contract.
- [TASK-20260619-024](tasks/TASK-20260619-024/TASK.md): L2-020 order-list migration pre-implementation baseline gate.
- [TASK-20260619-025](tasks/TASK-20260619-025/TASK.md): L2-021 order-list legacy route migration implementation.
- [TASK-20260620-001](tasks/TASK-20260620-001/TASK.md): Order detail manual status transition repair.
- [TASK-20260620-002](tasks/TASK-20260620-002/TASK.md): L2-022 legacy `src/routes/*` classification and cleanup approval package.
- [TASK-20260620-003](tasks/TASK-20260620-003/TASK.md): L2-023 legacy `src/routes/*` deletion preflight contract.
- [TASK-20260701-004](tasks/TASK-20260701-004-one-command-mode-v32-integration/TASK.md): Codex One Command Mode v3.2 RepairDesk governance integration.
- [TASK-20260701-005](tasks/TASK-20260701-005-project-garbage-cleanup/TASK.md): Safe generated-artifact cleanup and repository garbage inventory.
- [TASK-20260701-006](tasks/TASK-20260701-006-project-cleanup-second-pass/TASK.md): Second-pass explicit-path cleanup and unsafe `git clean` inventory.
- [TASK-20260710-009](tasks/TASK-20260710-009-security-reliability-hardening-release/TASK.md): Conditional closeout of the security/reliability/payment release; scoped main and production are live, with legacy-table and recovery P0 follow-ups.
- [TASK-20260712-002](tasks/TASK-20260712-002-global-staff-permissions/TASK.md): Global staff permissions, individual-vs-aggregate finance policy, archived order queue and stable technician assignment scope.
- [TASK-20260712-005-buyback-guided-evidence](tasks/TASK-20260712-005-buyback-guided-evidence/TASK.md): Closed guided buyback, restricted identity/signature evidence, role handoff, atomic finalize and resale-safety scope; production migration/deploy remain NO-GO.
- [TASK-20260714-001-buyback-sensitive-evidence-feature-off](tasks/TASK-20260714-001-buyback-sensitive-evidence-feature-off/TASK.md): Closed production containment release; sensitive buyback evidence/finalize is server-default-deny, all roles use four quote-only steps, and Supabase remains intentionally unchanged.
- [TASK-20260714-002-buyback-supabase-schema-staging](tasks/TASK-20260714-002-buyback-supabase-schema-staging/TASK.md): Closed scoped production migration; dormant buyback evidence schema is present but empty, private and inaccessible to runtime roles, while feature activation remains NO-GO.
- [TASK-20260716-001-dashboard-handoff-priority](tasks/TASK-20260716-001-dashboard-handoff-priority/TASK.md): Closed beginner-friendly actor-scoped Dashboard priority and store-handoff workbench; full gates, screenshots, independent reviews and `main` integration are recorded.
- [TASK-20260716-002-orders-mobile-filter-loading-plan](tasks/TASK-20260716-002-orders-mobile-filter-loading-plan/TASK.md): Closed production Orders mobile density, queue loading-state and bounded tenant-safe list-query optimization; exact main/deploy, screenshots and no-migration evidence are recorded.
- [TASK-20260716-003-customer-finance-order-correction-plan](tasks/TASK-20260716-003-customer-finance-order-correction-plan/TASK.md): Closed production customer history/valid-finance split, dual repair/payment states and audited terminal correction/reopen/Owner safe void; four migrations, main push, exact-SHA Vercel deployment and runtime smoke are verified.
- [TASK-20260716-004-device-left-status-plan](tasks/TASK-20260716-004-device-left-status-plan/TASK.md): Planning-complete proposal for independent order device custody across create/detail/cancel/complete/pickup/unlock/offline/data paths; no implementation or production change has occurred.
- [TASK-20260712-004](tasks/TASK-20260712-004-settings-center-master-plan/TASK.md): Active Settings Center master plan; WP00–WP09 form a local candidate and evidence package on a fresh latest-main integration branch. Task-local reports are not production authorization; push/PR, database, feature flags and production remain NO-GO pending current gates and Owner approval. See [WP09 integration report](tasks/TASK-20260712-004-settings-center-master-plan/WP09_LATEST_MAIN_INTEGRATION_REPORT.md), [visual evidence](tasks/TASK-20260712-004-settings-center-master-plan/WP09_VISUAL_EVIDENCE.md), [acceptance matrix](tasks/TASK-20260712-004-settings-center-master-plan/WP08_ACCEPTANCE_MATRIX.md), [release packet](tasks/TASK-20260712-004-settings-center-master-plan/WP08_RELEASE_READINESS_PACKET.md), and [operator guide](../../docs/SETTINGS_CENTER_OPERATOR_GUIDE.md).
- [TASK-20260716-005-device-custody-status-implementation](tasks/TASK-20260716-005-device-custody-status-implementation/TASK.md): Closed production implementation of independent custody, audited receive/return/correction flows and legacy-NULL preservation. Its unlock-clearing rule is historical and superseded by `20260717182220` plus TASK-20260717-008.
- [TASK-20260717-004-order-diagnosis-quote-implementation](tasks/TASK-20260717-004-order-diagnosis-quote-implementation/TASK.md): Closed production unknown-intake, diagnosis, atomic formal quote and staff-confirmed WhatsApp notification workflow; migration `20260717213518`, business main SHA `6e511c56` and exact READY deployment are verified.
- [TASK-20260717-008-desktop-novice-ui-implementation](tasks/TASK-20260717-008-desktop-novice-ui-implementation/TASK.md): Closed production desktop beginner workflow simplification with exact-field guidance, custody credential retention, terminal/permission guards, full desktop evidence, Vercel READY proof and linked Supabase no-op verification.
- [TASK-20260717-employee-invite-registration](tasks/TASK-20260717-employee-invite-registration/TASK.md): Closed employee email Invite/Magic Link registration with prefetch-safe confirmation, atomic store authorization, delivery states, applied Supabase migrations/Auth templates, full gates, responsive evidence and verified `www.chinatech.in` production release.
