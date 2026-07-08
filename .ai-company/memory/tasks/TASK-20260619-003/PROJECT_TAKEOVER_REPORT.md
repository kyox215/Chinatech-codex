# RepairDesk Project Takeover Report

- Task: `TASK-20260619-003`
- Date: 2026-06-19
- Owner / 老板: Hexiang Huang / 鹤祥
- Operating model: Owner -> Integration Lead / CEO Agent -> scoped departments / agents
- Code boundary: no business-code edits were made for this takeover baseline
- Skills executed: `context-rehydrate`, `project-health-check`, `department-memory-sync`, `capability-review`

## Executive Baseline

RepairDesk is an active Next.js internal operations system for Chinatech, covering repair orders, customer CRM, buyback/resale, inventory, message templates, platform onboarding, store settings, and mobile task/detail workflows.

The project is currently buildable and testable after distinguishing a sandbox-only Turbopack issue:

| Gate | Result | Evidence |
|---|---|---|
| `npm run agents:check` | passed | `EVIDENCE.md#E-017` |
| `.ai-company` v3 validation | passed | `EVIDENCE.md#E-018` |
| `npm run lint` | passed | `EVIDENCE.md#E-019` |
| `npm run typecheck` | passed | `EVIDENCE.md#E-016` |
| `npm run test` | passed, 37 files / 220 tests | `EVIDENCE.md#E-020` |
| `npm run build` | passed outside sandbox; sandbox failure was port permission | `EVIDENCE.md#E-021` |

No confirmed P0 production blocker was found in this read-only takeover. The highest current risks are baseline contamination from a dirty worktree and 99 `* 2.*` duplicate files, live legacy `src/routes/orders.index.tsx` coupling, and unverified production Supabase/deployment state.

## Business Map

| Area | Verified facts | Evidence | Status |
|---|---|---|---|
| Business | Chinatech is a phone repair / electronics repair, buyback, resale, and accessory shop in Floridia, Siracusa, Italy. | `AGENTS.md`, root owner instructions | verified |
| Primary users | Owner/manager, front desk, technician, sales/inventory staff, platform administrator. | `src/server/auth-context.ts`, `src/features/stores/server/store.repository.ts`, `src/features/platform/server/platform.repository.ts` | verified from code roles |
| Core workflows | Orders, customers, buyback, inventory, messages, settings, onboarding/platform approval, mobile order task/detail flows. | `src/app/*`, `src/features/*`, `src/shared/config/navigation.ts` | verified |
| Languages | Chinese is the primary UI/rule language; Italy/EUR context appears in data/settings. | `src/app/layout.tsx`, `src/features/platform/server/platform.repository.ts`, migrations | verified |

## Technical Map

| Layer | Map | Evidence | Status |
|---|---|---|---|
| App shell | Next.js App Router under `src/app`; route pages are intended to stay thin and import `features/*/screens`. | `docs/ARCHITECTURE.md`, `src/app/*/page.tsx` | verified |
| Client data API | Client code uses `@/lib/repairdesk/api` to call `/api/repairdesk/[...path]`. | `src/lib/repairdesk/api.ts`, `src/app/api/repairdesk/[...path]/route.ts` | verified |
| Server API | Central router dispatches GET/POST repairdesk paths to feature services and repositories. | `src/server/api/repairdesk-router.ts` | verified |
| Features | Auth, buyback, capture, customers, dashboard, inventory, messages, orders, platform, settings, stores. | `src/features/` | verified |
| UI system | `src/styles.css` is the color source; reusable patterns live in `src/lib/ui-patterns.ts`, `src/lib/component-patterns.ts`, and `src/components/ui/*`. | `AGENTS.md`, `docs/ARCHITECTURE.md` | verified |
| Legacy debt | `src/features/orders/screens/order-list-screen.tsx` still imports `@/routes/orders.index`. | `src/features/orders/screens/order-list-screen.tsx` | verified |

## Data Map

| Domain | Main tables / objects observed | Evidence | Status |
|---|---|---|---|
| Repair orders | `repair_orders`, `order_events`, workflow/status/transition columns, payment and approval state, attachments. | `supabase/migrations/20260517143000_repairdesk_schema.sql`, later order migrations | verified by migration files |
| Customers / devices / CRM | `customers`, `devices`, `customer_tags`, `customer_interactions`, `customer_followups`, performance RPCs. | `supabase/migrations/20260518170000_customer_crm.sql`, `20260616141938_customer_list_v2_fast_loading.sql` | verified by migration files |
| Buyback / resale inventory | `inventory_items`, quality checks, transactions, events, resale workflow and sale rules. | `supabase/migrations/20260610234427_buyback_resale_inventory.sql`, `20260611102805_repairdesk_remote_schema_compatibility.sql` | verified by migration files |
| Store / tenancy | `stores`, `staff_profiles`, `store_memberships`, `store_invitations`, store-scoped settings/templates. | `20260611002831_enterprise_multi_store_foundation.sql`, `20260611074644_repairdesk_auth_multistore_bootstrap_safe.sql` | verified by migration files |
| Audit | `audit_logs`, `platform_audit_logs`, write helpers around mutations. | `src/server/audit.ts`, `src/server/api/repairdesk-router.ts`, platform migrations | verified |
| Storage | Private buckets/tables for order and inventory attachments; direct client storage intentionally not assumed. | `20260613122452_order_attachments.sql`, `20260617143000_inventory_attachments.sql` | verified by migration files |

## Permission Map

| Actor / role | Verified permission behavior | Evidence | Status |
|---|---|---|---|
| Owner / 老板 | Project authority and business decision owner; AI does not gain production/legal/financial authority by default. | `AGENTS.md`, `.ai-company/policies/*` | verified policy |
| System actor | Used when browser auth config is absent or E2E bypass is active. | `src/server/auth-context.ts`, `src/shared/lib/e2e-auth-bypass.ts` | verified |
| Logged-in staff | Must have Supabase auth claims and an active `staff_profiles` row when auth is configured. | `src/server/auth-context.ts` | verified |
| Store member | Must have active store membership; active store resolves from cookie or first membership. | `src/server/auth-context.ts`, `src/features/stores/server/store.repository.ts` | verified |
| Platform admin | Required for onboarding approval/rejection. | `src/features/platform/server/platform.repository.ts` | verified |
| Store owner/manager | Can manage store members and message templates. | `src/features/stores/server/store.repository.ts`, `src/features/messages/server/message-settings.service.ts` | verified |
| Inventory writer | `owner`, `manager`, `technician`, `sales` can write inventory paths. | `src/server/api/repairdesk-router.ts` | verified |
| Tenant guard | Real Supabase repositories are tested to use strict store context instead of legacy default-store fallback. | `src/server/tenant-guard.test.ts` | verified |

## Deployment And Dependency Map

| Area | Verified facts | Evidence | Status |
|---|---|---|---|
| Runtime | Node `22.12.0` is configured. | `.nvmrc`, `.github/workflows/ci.yml` | verified |
| Framework | Next.js `16.2.6`, React `19.2.0`, TypeScript `5.8.3`, Tailwind `4.2.1`. | `package.json` | verified |
| Data/auth | Supabase client/server packages and SSR helpers are installed. | `package.json`, `src/server/supabase.ts`, `src/utils/supabase/*` | verified |
| State/query | TanStack React Query is the current query layer; TanStack Router is legacy debt, not package dependency. | `package.json`, `src/routes/*` | verified |
| Tests | Vitest unit tests and Playwright E2E are configured. | `package.json`, `playwright.config.ts`, `tests/` | verified |
| CI | Pull request/push CI runs lint, typecheck, test, build; E2E workflow is manual. | `.github/workflows/ci.yml`, `.github/workflows/e2e.yml` | verified |
| Deploy | `vercel.json` declares Next.js framework and `npm run build`. | `vercel.json` | verified |
| Env | `.env.example` documents Supabase URL, service role placeholder, and public publishable key; `.gitignore` excludes `.env*` and `supabase/.temp`. | `.env.example`, `.gitignore` | verified |

## Facts, Assumptions, Conflicts, Unknowns

### Verified Facts

| ID | Fact | Evidence |
|---|---|---|
| F-001 | The main app is Next.js App Router with server API catch-all at `/api/repairdesk/[...path]`. | `src/app`, `src/app/api/repairdesk/[...path]/route.ts` |
| F-002 | Current validation gates pass except sandboxed build, which passes outside sandbox. | `EVIDENCE.md#E-016` through `EVIDENCE.md#E-021` |
| F-003 | There are 99 `* 2.*` duplicate files currently visible in the workspace. | `EVIDENCE.md#E-012` |
| F-004 | The worktree contains tracked modifications outside this takeover, including business/UI files. | `git status --short`, `git diff --stat` |
| F-005 | Order list is still a live wrapper around legacy `src/routes/orders.index.tsx`. | `src/features/orders/screens/order-list-screen.tsx` |
| F-006 | Real Supabase repositories have a tenant guard test to require strict store context. | `src/server/tenant-guard.test.ts` |

### Assumptions

| ID | Assumption | Why it is only an assumption | Next verification |
|---|---|---|---|
| A-001 | Vercel is the intended production deployment target. | `vercel.json` exists, but no live project/deployment was inspected. | Verify connected Vercel project when release work begins. |
| A-002 | The local migration folder reflects production schema intent. | Production Supabase migration state was not queried. | Compare remote migration history before any data/schema work. |
| A-003 | The current dirty worktree came from previous owner/agent work. | It existed before current memory writes, but authorship is not proven. | Ask owner or inspect Git history before cleanup. |

### Conflicts

| ID | Conflict | Impact | Interim rule |
|---|---|---|---|
| C-001 | Generic AI Company OS rules vs RepairDesk-specific AGENTS/rules. | Generic roles could override local architecture/UI/security rules. | RepairDesk root rules win; AI Company OS is subordinate. |
| C-002 | Dirty worktree and untracked duplicates vs clean health baseline. | Failures or diffs can be misattributed. | Treat gates as current-state evidence; isolate cleanup before code work. |
| C-003 | App Router target vs live `src/routes/orders.index.tsx` dependency. | Architecture drift and harder refactors. | Do not add new `src/routes` code; migrate deliberately. |
| C-004 | Manual E2E workflow vs release confidence. | UI regressions may pass PR CI. | Keep E2E manual until stable auth/data fixtures are defined. |

### Unknowns

| ID | Unknown | Risk | Next verification |
|---|---|---|---|
| U-001 | Current production Supabase schema and RLS policy state. | Schema drift or tenant leaks during release. | Remote migration/RLS audit with owner-approved access. |
| U-002 | Production backup/restore and data retention policy. | Customer/device/payment data loss or privacy exposure. | Operations/security review. |
| U-003 | Live auth users, platform admins, store memberships, and staff roles. | Owner/admin lockout or over-permissioned staff. | Permission inventory with owner approval. |
| U-004 | External messaging provider/provider policy, if any. | Customer communication or compliance gaps. | Product/security review before external sending. |
| U-005 | Performance behavior on realistic order/customer/inventory volume. | Slow shop workflows. | Seed/load test or production-observed metrics. |

## P0/P1/P2 Risk And Debt Register

### P0

| ID | Risk | Status | Owner | Next action |
|---|---|---|---|---|
| P0-001 | No confirmed P0 blocker found in this takeover. | monitor | Integration Lead | Reclassify immediately if production secrets, tenant leak, data loss, or deploy failure is proven. |

### P1

| ID | Risk / debt | Impact | Evidence | Owner | Recommended next action |
|---|---|---|---|---|---|
| P1-001 | Dirty worktree plus 99 duplicate `* 2.*` files. | Baseline contamination, accidental imports, slower review, possible duplicate tests/migrations. | `git status --short`, `git diff --stat`, `rg --files -g '* 2.*'` | Operations + QA | Create cleanup inventory; delete/archive only after owner confirms no needed files. |
| P1-002 | Live legacy `src/routes/orders.index.tsx` dependency. | App Router architecture drift; large old page remains in critical order workflow. | `src/features/orders/screens/order-list-screen.tsx` | Architecture + Frontend | Plan and execute staged migration to `src/features/orders/screens`. |
| P1-003 | Production Supabase state not verified. | Release or migration assumptions may be wrong. | local-only inspection | Data + Security | Remote schema/RLS/migration audit before production DB work. |
| P1-004 | Large high-blast-radius modules. | Harder review and higher regression risk. | `wc -l`: order detail 3165, order repository 2711, buyback workspace 2323, inventory screen 2006 | Architecture + QA | Split by workflow with tests before feature expansion. |
| P1-005 | Attachment/customer PII operational policy unknown. | Privacy, retention, and backup risk. | storage migrations and unknown ops policy | Security + Operations | Define retention/access/backups before external release. |

### P2

| ID | Risk / debt | Impact | Evidence | Owner | Recommended next action |
|---|---|---|---|---|---|
| P2-001 | E2E is manual-only. | PR CI may miss visual/user-flow regressions. | `.github/workflows/e2e.yml` | QA | Add stable mock-auth smoke E2E once duplicate baseline is clean. |
| P2-002 | TypeScript strictness is softened by `allowJs` and unused checks disabled. | Dead code and accidental exports linger. | `tsconfig.json` | Architecture | Tighten incrementally after cleanup. |
| P2-003 | Build needs sandbox exception on this Mac. | Agents may misclassify Turbopack permission failure as code failure. | sandbox build failed, unsandboxed build passed | Operations | Document rerun rule in task memory and health checklist. |
| P2-004 | Docs still contain TanStack Start/Router replication material. | Future agents may follow stale docs. | `rg TanStack src docs package.json` | Documentation | Mark old docs as archival or migrate current guidance. |
| P2-005 | Several feature folders also have ` 2` directories. | Search and tooling noise. | `find src/features -maxdepth 2 -type d` | QA + Operations | Include in duplicate cleanup inventory. |

## Department Memory Initialization

Formal department memory is initialized in `.ai-company/memory/departments/`. This report is the evidence baseline for all departments; individual files should keep only durable, department-owned rules and handoff boundaries.

| Department | Initial responsibility | Current capability need |
|---|---|---|
| Product | Maintain shop workflow scope, acceptance criteria, role/business rules. | Translate owner tasks into testable shop outcomes. |
| Architecture | Own App Router/feature boundaries, large-module split strategy, dependency direction. | Reduce `src/routes` and large-module debt. |
| Backend | Own API router, service/repository contracts, server validation, audit logging. | Preserve strict store context and mutation auditing. |
| Data | Own Supabase schema, migrations, RLS, indexes, storage, data-quality checks. | Verify production parity before schema/data actions. |
| Frontend | Own screens/components, route thinness, query keys, responsive behavior. | Migrate legacy list screen and reduce large UI files. |
| Design | Own RepairOS visual language, density, mobile detail standards, tokens. | Prevent ad hoc UI divergence. |
| QA | Own gate selection, E2E strategy, duplicate-baseline verification. | Keep check results attributed to the right root cause. |
| Security | Own auth, roles, tenant isolation, secrets, PII/storage posture. | Audit production roles and retention policy. |
| Platform | Own Vercel/Supabase deployment, CI, runtime, env management. | Verify live project state and sandbox exception notes. |
| Operations | Own runbooks, release readiness, backups, incident handoff. | Establish backup/restore and deployment checklists. |
| Documentation | Own rule/doc drift and archival labels. | Mark stale TanStack-era docs. |
| Memory | Own task evidence, checkpoints, durable facts, conflict register. | Keep facts/assumptions/conflicts separated. |

## Agent Capability, Permission, And Limits Baseline

Capability levels are evidence-based and conservative. Unless separately approved, all agents inherit L2 controlled execution limits: no destructive commands, production writes, secrets handling, deployment, external communication, or customer-data changes without explicit owner approval.

| Agent profile | Initial capability | Default permission | Main limit |
|---|---|---|---|
| `project_explorer` | C2 for read-only repo mapping | read-only preferred | Cannot modify or decide implementation alone. |
| `product_analyst` | C1 for PRD/intake from verified facts | read-only/doc write when assigned | Cannot invent business policy. |
| `solution_architect` | C1/C2 for local architecture review | read-only/doc write when assigned | Requires evidence before architecture changes. |
| `implementer` | C1 for bounded approved code changes | workspace-write when assigned | No broad refactor or overlapping file ownership. |
| `data_reviewer` | C1 for local migration/RLS review | read-only by default | No production SQL without owner approval. |
| `security_reviewer` | C1 for local auth/secret/PII review | read-only by default | No secret exposure or permission changes. |
| `qa_reviewer` | C2 for local gate execution/interpretation | read-only by default | Cannot bless release without full acceptance evidence. |
| `ux_reviewer` | C1 for RepairOS/UI standards review | read-only/doc write when assigned | Needs screenshots/browser evidence for visual claims. |
| `documentation_reviewer` | C2 for docs/rules sync | docs/memory write when assigned | Must not override root RepairDesk rules with generic OS rules. |
| `release_reviewer` | C1 for release checklist preparation | read-only/doc write when assigned | No deploy/push/promote authority. |
| `memory_steward` | C2 for task memory/evidence/checkpoints | `.ai-company/memory` write when assigned | Must not store secrets or unsupported facts. |
| `capability_auditor` | C1 for capability review | read-only/doc write when assigned | Capability upgrades require evidence and owner/lead acceptance. |

## 30 / 60 / 90 Day Roadmap

### First 30 Days

1. Stabilize baseline: inventory and owner-confirm cleanup of duplicate `* 2.*` files and dirty worktree.
2. Mark old TanStack-era docs as archival or align them to Next App Router.
3. Produce production-readiness map: Vercel project, Supabase project, env vars, DB migration parity, RLS policy parity.
4. Create permission matrix from code and confirm business intent with owner.
5. Plan `src/routes/orders.index.tsx` migration into `src/features/orders`.
6. Convert this takeover into repeatable health-check runbook.

### 60 Days

1. Execute staged order-list migration away from legacy `src/routes`.
2. Split largest screens/repositories by workflow with targeted tests.
3. Add stable mock-auth E2E smoke to PR or scheduled CI.
4. Add data-quality checks for orders/customers/inventory state invariants.
5. Define attachment/customer PII retention, backup, and restore procedures.
6. Tighten TypeScript/project hygiene after duplicate cleanup.

### 90 Days

1. Complete production release governance: rollback, monitoring, backups, owner approval flow.
2. Establish role/access quarterly review for staff/store/platform admins.
3. Add operational dashboards or logs for order, payment, inventory, and approval errors.
4. Finish high-value module splits for order detail, inventory, buyback, and repositories.
5. Produce shop-user training SOPs in Chinese with Italian customer-facing terminology where needed.

## First L2 Autonomous Task Batch

These are suitable for L2 controlled execution because they are reversible, evidence-focused, and avoid production/customer data.

| Task ID | Task | Scope | Required verification |
|---|---|---|---|
| L2-001 | Duplicate-file cleanup inventory | Produce a reviewed list of all `* 2.*` files and likely canonical counterpart; no deletion yet. | `rg --files -g '* 2.*'`, owner confirmation checkpoint |
| L2-002 | Permission matrix document | Generate docs-only matrix from code for platform/store roles and API write paths. | `rg`, focused source references, no code change |
| L2-003 | Legacy routes migration plan | Create staged plan to remove `src/routes/orders.index.tsx` dependency. | Import graph evidence, no implementation |
| L2-004 | Stale docs audit | Label or list TanStack-era docs that conflict with current App Router rules. | `rg TanStack`, docs-only diff |
| L2-005 | Production readiness checklist | Draft Vercel/Supabase/env/backup checklist without accessing secrets. | checklist review, no live production action |
| L2-006 | Health-check runbook | Convert current gates and sandbox-build exception into repeatable SOP. | `agents:check`, `validate`, lint/typecheck/test/build evidence |

## Closeout Criteria For This Takeover

- Task evidence index records source files and command results.
- Project memory, conflict register, department memory, and capability registry are synchronized.
- No business code is changed.
- Owner receives a concise summary with risks, roadmap, and next L2 tasks.
