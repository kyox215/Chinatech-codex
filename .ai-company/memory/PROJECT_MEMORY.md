# PROJECT MEMORY

- Project ID: chinatech-repairdesk
- Owner: Hexiang Huang / 鹤祥
- Version: 2
- Status: active
- Last verified: 2026-07-19 CEST

## Product and business overview

Chinatech RepairDesk is a Next.js internal management system for a phone repair and electronics shop in Floridia, Siracusa, Italy. It supports repair orders, customers, buyback, inventory, payments, messaging, platform settings, and mobile task/detail workflows.

2026-07-04 product direction update: multi-store planning should treat RepairDesk as a privacy-first platform for independent partner store owners, not as one headquarters company with branch employees. Each store is a private tenant controlled by its own store owner. Platform operators manage the system, cooperation status, and support controls, but should not have default access to store business data. The active long-term plan is `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md`; progress and owner decisions are tracked in `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`.

2026-07-18 store lifecycle release: `TASK-20260717-007-store-lifecycle-implementation` shipped immutable-UUID preflight, structured access reasons, recent-TOTP owner rename, reversible close/archive/restore gates, DB+Storage export/restore proof and approval-locked resumable purge controls. Six migrations are applied to `xluzcoduqsdvjoouqhkc` and implementation commit `55cb7ab5` is included in `main`; all five lifecycle feature flags remain off, and no real store rename, close, export or purge occurred.

2026-07-18 order-cost Phase 2 release: `TASK-20260718-008-order-cost-phase2` applied six additive
migrations and deployed business commit `b8932b2c`. The production slice has append-only cost
revisions, quote-based operating-margin reporting, supplier/parts lots and allocation, minimized
CSV export, guarded history backfill and immutable original-currency snapshots. All five Phase 2
child flags remain absent/off, no production backfill ran, and procurement/backfill tables stayed
empty. Owner Option B accepts unproven physical restore/RPO/RTO and the pre-existing full-history
replay failure for this release only; it does not close the independent recovery P0.

2026-07-18 Inventory V2 Chinatech canary: `TASK-20260718-013-inventory-v2-production-canary`
supersedes the prior production-off statement from `TASK-20260718-011-inventory-product-v2-plan`.
Four linked migrations are applied; ten new tables remain RLS-on with no browser grants, and three V2
RPCs remain service-role-only. Only Chinatech is allowlisted with schema/shadow/commands/UI enabled;
V1 mutations remain enabled. Production rollback-only intake/sale/reconcile passed with zero residual
rows, desktop/mobile six-step entry is verified, and AI image recognition remains optional and dormant.
Second-store rollout, AI provider activation, V1 retirement and data cleanup remain separate D4 work.

2026-07-18 workspace integration release: `TASK-20260718-012-workspace-integration-release` safely
reconstructed three proven release units on latest `main`: workflow-progress order sorting,
custody-safe unlock retention and tenant store/print address propagation. Production applied only
`20260718150000_neutralize_store_settings_identity_defaults.sql`; store-settings row count, timestamp,
fingerprint, RLS, policies and ACL were unchanged. Business closeout `main@de5f8b49` and Vercel
deployment `dpl_FueK1juPvAp8UJrE1FdvPxRYRy4o` were exact-SHA READY before the final memory-only sync.
The mixed original checkout was preserved; reverify the live remote SHA before any next release.

## Users, roles and core workflows

- Owner / manager: business decisions, oversight, approvals, reporting.
- Front desk: customer intake, customer search, order creation, quoting, payment, pickup, communication.
- Technician: diagnosis, repair tasks, notes, photos, parts, completion.
- Customer-facing indirect flows: receipts, status communication, pickup, warranty context.

## Architecture and module map

- Next.js App Router in `src/app/`; route files stay thin.
- Business UI belongs under `src/features/*`.
- Shared pure helpers belong under `src/shared/lib`.
- Cross-feature entity rules belong under `src/entities/*`.
- App data access goes through `@/lib/repairdesk/api` or feature API facades.
- Design patterns come from `src/lib/ui-patterns.ts`, `src/lib/component-patterns.ts`, `src/components/ui/*`, and `src/styles.css`.

## Data, API and integration map

- Important domains: orders, customers, inventory, buyback, messages, settings/platform, server/API, Supabase migrations.
- Customer search and order workflows have explicit RepairDesk rules in `AI智能部门管理/部门化管理设计.md`.
- Supabase/database work is high-risk and requires DATA/API/SEC/QA review plus explicit approval for production-impacting actions.
- Verified current data domains include repair orders/events/workflows, customers/devices/CRM, buyback/resale inventory, store tenancy, staff profiles, store memberships, store invitations, message templates, store settings, audit logs, platform onboarding, and private attachment storage.
- Closed `TASK-20260716-001-dashboard-handoff-priority` defines the current Dashboard contract: `dashboard/priority-summary` ranks the complete actor-visible active order set before applying its display limit, preserves technician membership assignment scope, and returns an allowlisted non-financial handoff DTO. Dashboard actions only navigate to permission-checked task/detail pages. The old `dashboard/summary` endpoint is retained temporarily for rolling-client compatibility.
- Closed `TASK-20260716-002-orders-mobile-filter-loading-plan` defines the current Orders list performance contract: first fetch store/view/assignment-scoped narrow index rows, then one store-scoped detail query capped at 50 IDs. Mobile queue controls use two columns below 360px and three columns from 360px, expose pending/error/offline/latest-intent states, and omit the mobile funnel plus redundant selected-queue summary. Production evidence did not justify a database migration.
- `TASK-20260716-003-customer-finance-order-correction-plan` and `docs/ORDER_LIFECYCLE_CORRECTION_STANDARD.md` define the current customer/order lifecycle contract: retained history is separate from valid repair/finance facts; cancelled/custom-cancelled/voided/deleted rows contribute zero to valid counts, active work, quoted total and receivables; routine edits are changed-fields-only; terminal correction/reopen/Owner safe void use dedicated audited atomic commands. Production migrations `20260716221119`, `20260716221139`, `20260716221159` and `20260716221448` are applied and postchecked.
- Closed `TASK-20260716-005-device-custody-status-implementation` defines the independent nullable custody state and audited mutation paths. Migration `20260717182220` supersedes its credential-clearing rule: moving to `with_customer` or returning a device no longer clears stored unlock credentials; only an authorized explicit unlock update clears them. New-order UI requires an explicit custody choice, while legacy NULL remains unknown. Both `20260716235650` and `20260717182220` are present in linked production history.
- Closed `TASK-20260717-004-order-diagnosis-quote-implementation` defines the current intake-to-quote contract: unknown intake creates no fake price, customer report/diagnosis/charge lines remain distinct, technicians diagnose and hand off, and Owner/Manager/Sales publish and confirm notification. Quote and confirmed-send are separate versioned, idempotent, service-role-only atomic RPCs; opening WhatsApp does not write sent state. Migration `20260717213518` and business application `main@6e511c56` are live and postchecked.
- Conditional `TASK-20260718-009-ai-assistant-implementation` defines the dormant AI Phase 0–2 contract: staff order assistance is limited to server-derived actor/store/RBAC and two read-only tools with server-built cards; inventory label recognition may only populate an employee-reviewed page-memory form draft before the ordinary save path. Parent/child flags, empty store allowlist, zero quota and fake provider fail closed. Production `main@8bef230` is verified READY without AI/OpenAI environment names, key sync, external calls, migration, image/draft persistence or public entry. Any live provider, persistent draft, workflow expansion or public assistant remains a separate R4/D4 task.
- Conditionally closed `TASK-20260718-011-ai-assistant-cost-governance` released the dormant Phase 3A cost-governance extension on `main@d84dae86` / READY `dpl_8nFPJjX3dY7Xbh9KTxBCdc5wRVfF`. Capability/RBAC and an all-request abuse guard remain ahead of a conservative deterministic order planner; deterministic hits use no provider quota. Complete local label candidates may skip cloud upload but remain reviewed, unsaved packaging claims. `TASK-20260718-013-inventory-v2-production-canary` later applied the durable atomic quota migration as empty, dormant governance infrastructure: policy/bucket/request rows remain zero, OpenAI provider remains fail-closed, and all budget/privacy/key/live AI activation decisions remain separate D4 work.
- Conditional `TASK-20260718-014-ai-assistant-live-pilot` supersedes only the dormant order-text statement: ChinaTech employee order text is live on `main@152caa1c` / READY `dpl_946N6xMftqrRpKTzGmnDBmbjrR2y` under `ai-runtime-v2`, explicit minimal reasoning, one-attempt durable budget settlement, a USD 50 monthly cap and a ChinaTech-only allowlist. The v2 one-shot passed HTTP/ledger/audit and the 30-minute observation ended with zero open/bad/overrun/Vision/cross-store/runtime-error counts. Vision/photos, PII, writes, public/customer AI, other stores and model/budget changes remain separate R4/D4 work; authenticated production UI proof and the 24-hour read-only review remain open.
- Closed `TASK-20260719-004-ai-processing-mode-usage` gives eligible staff an explicit default-local versus controlled-model choice and gives `finance:aggregate_read` users current-store aggregate usage in both Settings and the assistant sheet. Local mode never silently upgrades, model mode retains the existing provider/privacy/quota/budget/audit gates, and clients cannot choose store/model/key/price/budget. The production release reused the existing ledger with no migration or configuration change; non-pilot stores remain fail-closed and do not mount the assistant.
- Closed `TASK-20260719-005-ai-search-accuracy-collapsible-ui` makes original-message device intent a trusted server constraint even in explicit model mode: schema-valid but empty, broad or conflicting provider plans cannot remove or replace it, and any repository result outside the effective device constraint fails closed. The business release `main@d9c86ac1` / READY `dpl_4k8Jt4wCwCErZqz4m4SN9rfo5xEf` also makes usage and processing/help disclosures independently collapsible while keeping the current mode and model external-send/usage meaning visible. It changes no model, key, budget, allowlist, database or production data.
- Closed `TASK-20260719-006-ai-natural-language-order-actions` extends the trusted read boundary to Order Query V2: high-confidence device, Europe/Rome relative-date, completion, payment/workflow, quoted-service and order-level parts constraints are reconciled from the original message and displayed as typed evidence. The business release `main@6aa8199a` / READY `dpl_FjoBwRCaMKfiNoHofdi3jDNeYqgU` combines mode and usage into one collapsed composer row and keeps cards inline with a separate explicit order link. Quote rows remain quote evidence, `parts_status` remains an order marker, and the owner-only `mark_parts_ordered` candidate remains production-disabled behind the absent `AI_ORDER_INLINE_ACTIONS_ENABLED` flag; enabling it or performing a write smoke is a separate D4 decision.
- Closed `TASK-20260719-007-ai-natural-language-query-v3` makes Order Query V3 a closed-world read compiler: model output is advisory, while executable device/date/scope/finance/workflow constraints must be supported by the original message. Valid absolute/open/range/rolling/calendar/all-history dates resolve in Europe/Rome; invalid, reversed or ambiguous dates clarify instead of broadening, and archive/all-history fails closed without `order:archive_browse`. The business release `main@445b5e8117fd5bd8fcad33eb4ea120a5688e1816` / READY `dpl_9e2FqCMMyfKuRiyHVHcbUzm7NVSc` adds exact collapsible scope and safer Apple/iPhone family matching without migration, configuration, provider-policy or production-write expansion.
- Closed `TASK-20260719-007-fast-app-recovery` replaces the generic Next `/offline` Service Worker document with a dependency-free recovery shell and requires CSS marker plus React runtime double readiness before exposing the app. Runtime source `main@1119ef5d` is `READY` at `dpl_3RmTx8EKHszdMvMpbeNYG57B21H9`; both canonical domains, SW v4/probe/fallback, authenticated 390x844/1440x900 views and scoped runtime-error checks passed. The linked database stayed 91/91 up to date, so Supabase application was an intentional zero-write no-op. This is not full offline-first; real-iPhone background/BFCache/network-switch behavior remains an owned observation item.

## Authentication, authorization and sensitive data

Sensitive areas: customer PII, phone numbers, repair history, device identifiers, attachments/photos, payment states, staff actions, tenant/store isolation, Supabase credentials, and external communications.

Client components must not import `src/server/*`. Server-side validation is required for critical business rules, permissions, store isolation, payments, inventory movement, and workflow transitions.

`TASK-20260620-004/PERMISSION_MATRIX_BASELINE.md` is the current local evidence baseline for authentication, staff roles, tenant controls, platform-admin actions, sensitive business actions, and approval boundaries. It is not an implementation change and does not prove live Supabase parity.

`TASK-20260619-230350-l2-025-role-policy-decision-package/ROLE_POLICY_DECISION_PACKAGE.md` is the current Owner-approval package for role policy. It recommends Option A, but Option A is not approved or implemented until the Owner explicitly approves and follow-up implementation/test tasks close.

`TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` is the current audit-log redaction/minimization policy draft. It defines audit payload field categories, event-specific allowlists, forbidden data classes, approval boundaries, and implementation follow-ups. It is not evidence that audit sanitizer code, retention policy, or production historical cleanup is implemented.

`TASK-20260712-002-global-staff-permissions` implements the Owner-approved global store role policy: technicians and front desk can see amounts only on authorized individual orders; aggregate finance, profit and bulk output remain separately gated. Technician object authorization uses same-store `assignee_membership_id` and fails closed before the pending assignment migration. `TASK-20260713-001-order-active-status-homepage` supersedes the default-home visibility predicate: every `completed` or `cancelled` order belongs to history regardless of payment, delivery or custody evidence, while every nonterminal order remains in the operational queue. Custody-return and settlement contradictions remain available through authorized history, exact search and order detail; they no longer pull terminal rows back into the default homepage. Production migration apply remains a separate approval gate.

`TASK-20260712-005-buyback-guided-evidence` verifies the local guided-buyback contract: Sales may prepare seller/declaration data and hand off, while only Owner/Manager may capture or read restricted identity/signature evidence and finalize. Full document numbers are not persisted; signed snapshots bind legal text, device, seller, amount, payment and declarations. Finalize is versioned/idempotent/atomic, resale requires wipe/IMEI/activation-lock checks, returned buybacks reset those checks, and quality-check writes use CAS. The migration and dedicated storage policy are local code evidence only; production Supabase apply/deploy, retention/legal review and staged-file cleanup remain separate approval gates.

`TASK-20260714-001-buyback-sensitive-evidence-feature-off` remains the production runtime containment authority: code from `main@70d211b2` keeps all buyback attachment, identity/signature, payment/finalize and legacy-evidence paths server-default-deny, and every role sees the same four-step quote/evaluation/save workflow. `TASK-20260714-002-buyback-supabase-schema-staging` supersedes only the database-absence statement: production now contains dormant migration `20260712150000`, including an empty RLS agreement table, invoker finalize RPC, nine evidence fields and a private empty bucket, but all runtime table DML/RPC EXECUTE remain revoked and the application feature stays off. Re-enablement still requires a separate Owner-approved legal/data/security/release task; the older six-step implementation is design history, not active production behavior.

`TASK-20260716-003-customer-finance-order-correction-plan` projects finance and lifecycle authority explicitly: individual customer finance is omitted rather than fabricated for restricted readers; Manager/Owner can correct/reopen terminal orders, Owner alone can void, and browser roles cannot execute terminal RPCs. The RLS-enabled/no-policy terminal-operation table is an intentional deny-by-default evidence boundary behind service-role-only commands.

WP09 initially found a P1 tenant/legal exception because the signed versions, hashes, privacy notice and terms
hard-code Chinatech while capture/finalize was role-only. `origin/main@70d211b2` now contains the approved
feature-off containment: `BUYBACK_SENSITIVE_WORKFLOW_ENABLED` is hard-coded `false`, the UI exposes only the
four-step quote/evaluation/save flow, and Router/repository boundaries reject restricted upload, finalize and
legacy import. Preserve that fail-closed state. Re-enablement still requires a separately reviewed R4 release,
approved tenant/legal document identity, migration/storage/retention proof and explicit Owner authorization;
mutable display settings remain an invalid legal-document source.

The current Settings candidate replays fourteen Settings commits onto `origin/main@6717932e` in the clean
`codex/settings-center-closeout-20260716` worktree. The old HEAD and its dirty overlay are recoverable through
verified preservation refs/stash. Only the current branch's fresh gate may establish local evidence; older
WP09 counts and SHAs are historical. Push/PR, database work, real flags, deployment and production release
remain separately gated.

Device custody and unlock credentials are independent facts. Browser roles still cannot execute custody RPCs directly; completed devices cannot move back to shop custody without reopen and cancelled shop-held devices use dedicated audited return confirmation. Customer-held rows may retain credentials, but credential visibility/mutation stays separately permissioned and normal offline drafts/audit events never contain raw values. UI visibility is not authorization.

## Environments, build, deploy and operations

- Package scripts include `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run agents:check`.
- Rules-only changes should run `npm run agents:config`, `npm run agents:templates`, and `npm run agents:check`.
- Codex One Command Mode v3.2 is integrated at `.ai-company/ONE_COMMAND_MODE.md`; root `AGENTS.md` remains the executable entry for Owner Simple Mode, while the adapter is the long-form natural-language task intake reference.
- Cross-session orchestration Phase 0A is active in cooperative shadow mode under `.ai-company/orchestration.json`, `tools/orchestration`, and `$cross-session-orchestration`. New applicable top-level windows must start UNBOUND, read the shared Git-common-dir SQLite Registry, bind one explicit task/run/window/role, and verify an immutable Context Packet. `ACTIVE_CONTEXT.md` is only a foreground compatibility hint; binding or an integration lease never grants Git, deploy, migration, secret, production, or cross-task closure authority.
- Safe local cleanup can delete ignored generated artifacts such as `.next/`, `dist/`, `storybook-static/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo`, `.DS_Store`, and Python `__pycache__/` after confirming they are not Git-tracked. Do not auto-delete screenshots, exports, governance memory, migrations, source files, or `node_modules/` without a separate approval decision.
- In the current dirty RepairDesk checkout, blanket `git clean -nd` / `git clean -ndX` is unsafe because it would remove untracked governance files, screenshots, exports, migrations, source files, environment/deployment state, or dependencies. Cleanup should use explicit paths only.
- Full app gates are required for code/UI changes unless clearly blocked by unrelated worktree state or environment failure.
- Owner visual evidence rule: every task closeout must include screenshot path(s) for relevant task/result pages when a UI, preview, browser-visible result, or workflow page exists. Pure docs/backend/data/scripts/non-UI tasks must explicitly state the no-screenshot reason and provide alternate evidence. Screenshots must not expose secrets, production credentials, full customer PII, or unnecessary sensitive data.
- Owner AI-employee rule: when the Owner asks for departments, AI employees, sub-agents, multi-agent execution, review, or simulation, the Integration Lead must use real Codex sub-agent spawning when tooling is available. Each closeout must record spawned agent ids/nicknames/roles/modes/results, or a concrete no-spawn reason. Department labels alone are not evidence of AI employee execution.
- 2026-06-19 takeover validation passed: `npm run agents:check`, `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`, `npm run lint`, `npm run typecheck`, `npm run test` (37 files / 220 tests), and `npm run build` outside sandbox. Sandboxed `npm run build` can fail with Turbopack `Operation not permitted` while binding to a port; rerun outside sandbox before classifying as code failure.

## Active decisions and ADR index

- AI Company OS Codex Native v3.0 adopted as subordinate governance package under `.ai-company/`, `.codex/`, and `.agents/skills/`.
- Codex One Command Mode v3.2 adopted as the RepairDesk natural-language Owner task intake layer under `.ai-company/ONE_COMMAND_MODE.md`.
- ADR-20260718-002 adopts a project-scoped SQLite/WAL Registry plus task-local immutable Context Packets for Phase 0A cross-session identity; automatic GUI control, worktree assignment, integration, deploy and migration remain deferred.
- RepairDesk Integration Lead remains the only user-facing decision owner.
- Generic AI Company OS roles map into existing RepairDesk departments rather than replacing them.
- Project charter lives at `docs/project-charter.md`.
- Active order lifecycle and customer finance behavior lives at `docs/ORDER_LIFECYCLE_CORRECTION_STANDARD.md`; historical `docs/ORDERS_SPEC.md` cannot override it.
- The current device-custody addendum lives at the top of `docs/ORDERS_SPEC.md` and is backed by task `TASK-20260716-005-device-custody-status-implementation`; the rest of that document remains historical snapshot context.

## Risks, technical debt and exceptions

- Current worktree may contain unrelated modified/untracked files; validation results must be attributed carefully.
- Generic OS docs, skills, hooks, and `.codex/agents/*` can create procedural duplication if not filtered through `.ai-company/REPAIRDESK_ADOPTION.md`.
- Build failures may sometimes be environment-specific; rerun and classify before treating them as code regressions.
- Codex Native hooks require project trust before active use; static file presence alone is not proof of hook execution.
- 2026-06-19 L2-001 inventory found 104 Git-visible duplicate files, 14 Git-visible empty duplicate directories, and 11 ignored/generated duplicate-like Storybook paths. Of the 104 Git-visible duplicate files, 72 are byte-identical to canonical counterparts and 32 differ. Treat cleanup as separate owner-confirmed batches before broad code work.
- 2026-06-19 L2-002 review of the 32 differing duplicates found 18 remove-after-Owner-confirmation files, 12 remove-after-domain-confirmation semantic-conflict files, and 2 backlog/salvage-only candidates. Canonical non-` 2` files remain authoritative; do not merge duplicate migration/order-workflow content.
- 2026-06-19 L2-003 cleanup removed the 18 explicit Batch A stale duplicate files and updated `scripts/agents/check-agent-config.mjs` so agent checks no longer require the deleted deprecated duplicate. Batch B and Batch C remain intentionally untouched.
- 2026-06-19 L2-004 confirmed Batch B order workflow semantics: `mail_in_progress` is repair/external-repair, `repaired` remains repair until notification/pickup, and `quoted -> parts_ordered` remains valid. The 12 Batch B duplicates are stale and should be deleted in a follow-up Owner-approved cleanup task; do not merge their contents or rewrite historical canonical migrations.
- 2026-06-19 L2-005 removed the 12 confirmed-stale Batch B order workflow/migration duplicate files. Batch C (`scripts/check-agent-rules 2.mjs`, `tests/e2e/visual-overflow.spec 2.ts`), canonical non-` 2` files, canonical migration history, production data, dependencies, staging, commits, pushes, and deploys were intentionally untouched.
- 2026-06-19 L2-006 reviewed Batch C: `scripts/check-agent-rules 2.mjs` is delete-only after approval; `tests/e2e/visual-overflow.spec 2.ts` should first be converted into a future attachment-inventory overflow backlog idea or intentionally implemented before deletion. Neither file was deleted or merged in the review task.
- 2026-06-19 L2-007 preserved the attachment-inventory overflow E2E idea as `QA-BACKLOG-20260619-001` in `.ai-company/memory/BACKLOG.md`, then deleted the two Batch C duplicate files. Canonical scripts, canonical E2E tests, business code, production data, staging, commits, pushes, and deploys were untouched by L2-007.
- 2026-06-19 L2-008 removed 70 current byte-identical duplicate files after a fresh SHA-256 scan. Final closeout scan reports 0 byte-identical Git-visible duplicate files and 3 now-different duplicate files preserved for separate review: `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, and `src/server/tenant-guard.test 2.ts`. Canonical counterpart files, business code, production data, dependencies, staging, commits, pushes, and deploys were untouched.
- 2026-06-19 L2-009 reviewed the 3 remaining now-different duplicate files and classified all three as delete-only candidates for a later explicit cleanup task. Do not merge `.ai-company/README 2.md`, `src/features/orders/components/warranty-picker 2.tsx`, or `src/server/tenant-guard.test 2.ts` into canonical files; canonical files contain the newer/project-specific authority.
- 2026-06-19 L2-010 deleted exactly the 3 reviewed remaining now-different duplicate files. Final Git-visible untracked ` 2` duplicate scan with canonical counterparts reports `same=0 diff=0 missing=0 nonfiles=0`. Empty duplicate directories and ignored/generated duplicate-like output may still require separate cleanup.
- 2026-06-19 L2-011 removed 14 confirmed empty duplicate directories outside generated output roots. Post-cleanup empty-directory scan has no output, and Git-visible duplicate-file scan remains `same=0 diff=0 missing=0 nonfiles=0`. Remaining duplicate-like paths are 56 ignored/generated outputs under `.next/`, `storybook-static/`, `playwright-report/`, and `test-results/`; they are not source-tree conflicts.
- 2026-06-19 L2-012 isolated active-context drift: `TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui` is preserved as `on_hold` with a resume handoff, not closed. After L2-012 closeout, `ACTIVE_CONTEXT.md` should be idle unless a new task is deliberately created.
- 2026-06-19 L2-013 inventoried task-status memory: 19 pre-existing standard `TASK.md` records and 20 current records including L2-013. Five historical `complete` records were normalized to `closed` with `closed_at`; no standard task frontmatter should still use `status: "complete"`. One `conditional` task and one `on_hold` task remain intentionally.
- 2026-06-19 L2-014 inventoried stale documentation drift. P1 doc risks: `docs/UI_CHECKLIST.md` still routes new UI work to `src/routes/`, and `AI智能部门管理/templates/agenda-intake.md` still points non-micro task memory to `.ai-company/runtime-memory/tasks/`. Treat these as stale until fixed. TanStack export/planning docs in `docs/` need archive/snapshot labels before broad reuse.
- 2026-06-19 L2-015 fixed the two P1 active documentation drift items from L2-014: `docs/UI_CHECKLIST.md` now points route files to `src/app/` thin routes with `src/features/*/screens`, and `AI智能部门管理/templates/agenda-intake.md` now points non-micro task memory to `.ai-company/memory/tasks/<task_id>/` while marking `.ai-company/runtime-memory/` legacy trace-only.
- 2026-06-19 L2-016 added archive/snapshot banners to six historical/export/planning docs: `docs/ORDERS_SPEC.md`, `docs/ORDERS_FULL_EXPORT.md`, `docs/REFACTOR_EXECUTION_PLAN.md`, `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md`, `docs/GPT_PROJECT_REPLANNING_BRIEF.md`, and `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md`. These documents are preserved for context only and must not override current App Router, v3 memory, or RepairOS rules.
- 2026-06-19 L2-017 added status/owner/scope/last-reviewed metadata to seven core active authority docs: `docs/ARCHITECTURE.md`, `docs/UI_PAGE_GENERATION_DECLARATION.md`, `docs/COMPONENT_GENERATION_DECLARATION.md`, `docs/REPAIROS_COMPACT_ARCHITECTURE.md`, `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`, `docs/RESPONSIVE_DENSITY_PLAN.md`, and `docs/UI_CHECKLIST.md`.
- 2026-06-19 L2-018 refreshed the legacy route migration plan from current source facts. Six legacy files still exist under `src/routes/`; the only verified active-source `@/routes` import is `src/features/orders/screens/order-list-screen.tsx` importing `@/routes/orders.index`. Dashboard no longer has a verified active `@/routes/index` import in the current scan.
- 2026-06-19 L2-019 produced an implementation-ready contract for the order-list migration. The next code task should extract the legacy order-list route into feature-owned screen/component/model files, remove the `@/routes/orders.index` wrapper import, run full code gates, and leave `src/routes/*` deletion to a separate cleanup task.
- 2026-06-19 L2-020 established the pre-implementation validation baseline for the order-list migration: `npm run agents:check`, `npm run lint`, `npm run typecheck`, `npm run test` (37 files / 223 tests), and non-sandbox `npm run build` passed. Sandboxed `npm run build` failed with Turbopack port-binding `Operation not permitted`, then passed outside sandbox, so classify that build failure as environment-specific.
- 2026-06-19 L2-021 moved the active order list out of legacy `@/routes/orders.index`: `src/features/orders/screens/order-list-screen.tsx` now owns the screen directly, order-list UI/export helpers live under `src/features/orders/components/*` and `src/features/orders/model/*`, and `rg -n 'from "@/routes|@/routes' src` returns no matches. `npm run lint`, `npm run typecheck`, `npm run test` (38 files / 225 tests during migration; 38 files / 226 tests in the final dirty-workspace rerun), and non-sandbox `npm run build` passed. Remaining `src/routes/*` files were intentionally not deleted and should be classified/deleted in a separate cleanup task.
- 2026-06-20 TASK-20260620-001 fixed order detail manual status transitions: users can choose any enabled concrete order status except the current status; desktop uses an inline transition panel instead of a second `状态流转` Dialog; mobile keeps the Sheet; successful transitions write `status_changed`; approval, required-reason, disabled/current target, canonical-group target, and unpaid-completion protections remain. Validation passed: targeted workflow/mock tests, lint, typecheck, full Vitest (38 files / 228 tests), targeted order desktop E2E (3 viewports), non-sandbox build, and agent checks. Broader desktop E2E had one unrelated `/platform` 1440px `networkidle` timeout.
- 2026-06-20 TASK-20260620-002 classified the six remaining legacy `src/routes/*` files as delete-ready after Owner approval and post-deletion validation: `index.tsx`, `inventory.tsx`, `messages.tsx`, `orders.tsx`, `orders.index.tsx`, and `settings.tsx`. Current active source outside `src/routes` has no `@/routes` or direct `src/routes` imports. No legacy route files were deleted in the classification task; deletion remains a separate approval-gated cleanup task.
- 2026-06-20 TASK-20260620-003 produced the approval-gated deletion preflight contract for the classified legacy `src/routes/*` cleanup. Current baseline still has the same six files and no active source legacy-route references; `knip.json` still contains `src/routes/**` and should be cleaned only after approved deletion. Non-destructive baseline passed: `npm run agents:check`, `npm run lint`, `npm run typecheck`, `knip.json` JSON parse, active legacy route scan, and route-file existence recheck. No deletion was performed.
- 2026-06-20 TASK-20260620-004 produced the local permission and sensitive-action matrix baseline without changing business/auth/database/secret/production code. Verified controls include active-store actor resolution, strict store context in real repositories, platform-admin approval gates, owner/manager gates for message settings and order workflow configuration, owner/manager/technician/sales inventory writes, local tenant/RLS migrations, and private attachment storage posture. P1 follow-ups remain for order/customer mutation role policy, live Supabase parity, audit-log minimization, and self-service store creation policy.
- 2026-06-20 TASK-20260619-230350-l2-025-role-policy-decision-package produced the Owner-ready role-policy decision package without changing business/auth/database/secret/production code. Recommended Option A: viewer read-only; sales/front-desk owns customer-facing commercial work; technician owns repair/quality work; manager runs daily store admin; owner has full store authority; platform admin remains platform-only unless also a store member. Owner approval remains pending before any implementation.
- 2026-06-20 TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio produced the audit-log redaction/minimization policy without changing business code, audit code, database migrations, secrets, production data, deployment, staging, commits, or pushes. Validation passed: targeted policy/memory scan, targeted audit/sensitive-source scan, and `npm run agents:check`. Follow-up sanitizer implementation, forbidden-field tests, live audit-row review, retention, and historical cleanup remain approval-gated.
- 2026-06-20 TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re declared the Owner visual evidence rule in `AGENTS.md`, `.ai-company/policies/TASK_FLOW.md`, `.ai-company/policies/PROJECT_RULES.md`, and `.agents/integration-checklist.md`. It changes process only, not business code.
- 2026-06-20 TASK-20260619-232915-l2-029-enforce-real-sub-agent-spawning-for fixed the department-label drift by requiring real Codex sub-agent spawning for Owner-requested department/AI employee work when tooling is available, plus explicit no-spawn reasons when not. The fix itself used real DOC and QA sub-agents and recorded their conclusions.
- 2026-06-20 TASK-20260619-234449-l2-030-audit-project-for-similar-governanc audited the project for similar governance execution drift. No P0 issues were found and the L2-029 root real-sub-agent rule remains fixed, but P1/P2 support-surface gaps remain: sub-agent package schema/template parity, screenshot/no-screenshot report schema fields, checker coverage, nonstandard task frontmatter, one non-current active Figma task, department memory placeholders, and active-looking docs with stale legacy route examples.
- No active source currently imports `@/routes`; do not add new legacy route code. Remaining `src/routes/*` is cleanup debt, not an active dependency pattern.
- Production Vercel/Supabase state, live migration parity, staff/platform roles, backup/restore, and retention policies cannot be inferred from local repo inspection. TASK-009 supplies scoped live evidence only for commit `cee5a1b4`, Vercel deployment `dpl_CehRUKZ7WhybvvJhbaFFQZjwnwKA`, and payment migration `20260710145642`; it is not broad environment certification.
- Audit logs currently have a policy-ready P1 minimization follow-up: central audit writer/router paths can retain raw `before`, `after`, and `metadata.input` payloads in local source evidence. Do not claim this is fixed until sanitizer implementation and forbidden-field tests close.
- The separate task record `TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca` was normalized to `closed` by L2-013 after historical acceptance/checkpoint evidence review; do not resume it as an active health-check task without a new owner request.

## Current roadmap and work in progress

- Active `TASK-20260712-004-settings-center-master-plan` has locally implemented nine capability-driven
  Settings sections through WP07 plus WP08/WP09 historical evidence. The current clean integration replays
  all fourteen commits onto `origin/main@6717932e`; fresh current gates are required. Buyback feature-off,
  migration history and current Dashboard/Orders behavior are preserved. The task is not production-ready
  and remains split into code-only, member, Kiosk, workflow, order-data export/preview and order-data Apply
  release units.
- Recorded applied migration history through this scope is order-data `20260710150000`, member grants
  `20260712002317`, assignment scope `20260712003452`, Buyback `20260712150000` and assignment hardening
  `20260714004500`. The sole unapplied Settings candidate is Kiosk `20260714180000`. Verify linked history
  and an exact reviewed dry-run before any separately approved database action; never use `--include-all`.
  Kiosk/order-data flags stay exactly off, and member/workflow writes remain excluded until independent
  kill switches and atomic contracts exist.
- Latest conditionally closed task: `TASK-20260710-009-security-reliability-hardening-release`. Customer read/auth/schema/pagination/script/E2E hardening and atomic/idempotent payment recording are live at `cee5a1b4`; existing page layout/UI was preserved.
- TASK-009 established a durable payment command boundary: BFF authorization and validation, service-role-only invoker RPC, immutable ledger/idempotency key, advisory lock and order row lock in one transaction. A migration-slice PASS must never be summarized as an environment-wide Database Gate PASS.
- The legacy browser-role exposure found during linked audit received an exact Owner-authorized reversible
  privilege containment; immediate and minimum-observation checks passed. RLS/default-ACL/permissive-policy
  hardening, recovery-baseline failure, backup/PITR restore proof, the missing historical one-hour/24-hour
  observations and one plaintext unlock pattern remain independent R4/policy follow-ups.
- TASK-009 also exposed a shared-workspace release-coordination failure: separate executors can race on DB/Git/deploy state. Future production releases require a serialized release lock plus remote state assertions immediately before and after writes.
- Latest closed task: `TASK-20260717-004-order-diagnosis-quote-implementation`, the production unknown-intake, diagnosis, atomic quote and staff-confirmed WhatsApp workflow, validated through migration `20260717213518`, business `main@6e511c56`, exact READY deployment and clean runtime smoke.
- Active handoff candidate: Phase 2 tenant isolation audit, using `.ai-company/memory/ACTIVE_CONTEXT.md` and `TASK-20260704-009-independent-partner-store-platform` as Phase 1 baseline evidence.
- 30-day focus: close residual default-ACL/RLS/policy/function hardening after the browser-grant containment;
  repair/reconstruct the migration recovery baseline; record backup/PITR and run an isolated restore drill;
  add a serialized release lock and payment observability; continue Phase 2 tenant isolation, role-policy
  and audit-minimization work.
- 60-day focus: staged route migration, large-module splits, stable mock-auth E2E, data-quality checks, and PII/storage operations policy.
- 90-day focus: production release governance, role/access review, operational observability, module simplification, and shop-user SOPs.

## Evidence and authoritative sources

- `.ai-company/memory/tasks/TASK-20260619-003/PROJECT_TAKEOVER_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-003/EVIDENCE.md`
- `.ai-company/memory/tasks/TASK-20260619-004/DUPLICATE_WORKTREE_INVENTORY.md`
- `.ai-company/memory/tasks/TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md`
- `.ai-company/memory/tasks/TASK-20260619-006/CLEANUP_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-008/BATCH_B_SEMANTIC_CONFIRMATION.md`
- `.ai-company/memory/tasks/TASK-20260619-009/BATCH_B_CLEANUP_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-010/BATCH_C_REVIEW_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-011/BATCH_C_CLEANUP_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-012/BYTE_IDENTICAL_CLEANUP_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-013/REMAINING_DIFFERING_DUPLICATES_REVIEW.md`
- `.ai-company/memory/tasks/TASK-20260619-014/REVIEWED_DUPLICATES_CLEANUP_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-015/DUPLICATE_DIRECTORY_AND_GENERATED_OUTPUT_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-016/ACTIVE_CONTEXT_DRIFT_HYGIENE_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-017/TASK_STATUS_REGISTRY_AUDIT.md`
- `.ai-company/memory/tasks/TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md`
- `.ai-company/memory/tasks/TASK-20260619-019/TASK.md`
- `.ai-company/memory/tasks/TASK-20260716-002-orders-mobile-filter-loading-plan/CEO_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260716-003-customer-finance-order-correction-plan/EVIDENCE.md`
- `.ai-company/memory/tasks/TASK-20260716-005-device-custody-status-implementation/CEO_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260716-005-device-custody-status-implementation/EVIDENCE.md`
- `.ai-company/memory/tasks/TASK-20260717-004-order-diagnosis-quote-implementation/CEO_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260717-004-order-diagnosis-quote-implementation/EVIDENCE.md`
- `docs/ORDER_LIFECYCLE_CORRECTION_STANDARD.md`
- `.ai-company/memory/tasks/TASK-20260619-020/ARCHIVE_SNAPSHOT_BANNER_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-021/ACTIVE_DOC_METADATA_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-022/LEGACY_ROUTE_MIGRATION_PLAN_REFRESH.md`
- `.ai-company/memory/tasks/TASK-20260619-023/ORDER_LIST_MIGRATION_IMPLEMENTATION_CONTRACT.md`
- `.ai-company/memory/tasks/TASK-20260619-024/ORDER_LIST_PRE_IMPLEMENTATION_BASELINE.md`
- `.ai-company/memory/tasks/TASK-20260619-025/ORDER_LIST_MIGRATION_IMPLEMENTATION_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260620-001/ORDER_DETAIL_STATUS_TRANSITION_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260620-004/PERMISSION_MATRIX_BASELINE.md`
- `.ai-company/memory/tasks/TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md`
- `.ai-company/memory/tasks/TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re/TASK.md`
- `.ai-company/memory/tasks/TASK-20260619-232915-l2-029-enforce-real-sub-agent-spawning-for/SUBAGENT_REVIEW_REPORT.md`
- `.ai-company/memory/tasks/TASK-20260619-234449-l2-030-audit-project-for-similar-governanc/GOVERNANCE_EXECUTION_DRIFT_AUDIT.md`
- `.ai-company/memory/tasks/TASK-20260712-004-settings-center-master-plan/WP08_ACCEPTANCE_MATRIX.md`
- `.ai-company/memory/tasks/TASK-20260712-004-settings-center-master-plan/WP08_RELEASE_READINESS_PACKET.md`
- `docs/SETTINGS_CENTER_OPERATOR_GUIDE.md`
- `.ai-company/memory/BACKLOG.md`
- `AGENTS.md`
- `AI智能部门管理/部门化管理设计.md`
- `.agents/README.md`
- `.agents/repairdesk-multiagent.yaml`
- `.ai-company/REPAIRDESK_ADOPTION.md`
- `.ai-company/policies/CODEX_OPERATING_MODEL.md`
- `.ai-company/policies/PROJECT_RULES.md`
- `.ai-company/policies/TASK_FLOW.md`
- `.ai-company/memory/ACTIVE_CONTEXT.md`
- `.agents/skills/`
- `.codex/agents/`
- `docs/project-charter.md`
- `package.json`

## Employee invite registration authority

`TASK-20260717-employee-invite-registration` is the current authority for employee email invitations. Supabase Invite/Magic Link establishes a verified session only; the current Auth email must match an active, unexpired, non-owner business invitation and the service-role-only RPC must accept it atomically before any store access exists. Email GET pages never consume one-time tokens. Hosted Auth changes must preserve live MFA/OTP/redirect configuration. See `docs/EMPLOYEE_INVITE_REGISTRATION_RUNBOOK.md`.

## Review triggers

- New architecture, UI standard, Supabase schema, security, payment, messaging, or customer data rule.
- Owner requests a different autonomy level or AI employee operating model.
- Agent rule checks fail or project docs conflict with implementation.
