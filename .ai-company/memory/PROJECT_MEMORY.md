# PROJECT MEMORY

- Project ID: chinatech-repairdesk
- Owner: Hexiang Huang / 鹤祥
- Version: 2
- Status: active
- Last verified: 2026-06-20 CEST

## Product and business overview

Chinatech RepairDesk is a Next.js internal management system for a phone repair and electronics shop in Floridia, Siracusa, Italy. It supports repair orders, customers, buyback, inventory, payments, messaging, platform settings, and mobile task/detail workflows.

2026-07-04 product direction update: multi-store planning should treat RepairDesk as a privacy-first platform for independent partner store owners, not as one headquarters company with branch employees. Each store is a private tenant controlled by its own store owner. Platform operators manage the system, cooperation status, and support controls, but should not have default access to store business data. The active long-term plan is `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md`; progress and owner decisions are tracked in `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`.

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

## Authentication, authorization and sensitive data

Sensitive areas: customer PII, phone numbers, repair history, device identifiers, attachments/photos, payment states, staff actions, tenant/store isolation, Supabase credentials, and external communications.

Client components must not import `src/server/*`. Server-side validation is required for critical business rules, permissions, store isolation, payments, inventory movement, and workflow transitions.

`TASK-20260620-004/PERMISSION_MATRIX_BASELINE.md` is the current local evidence baseline for authentication, staff roles, tenant controls, platform-admin actions, sensitive business actions, and approval boundaries. It is not an implementation change and does not prove live Supabase parity.

`TASK-20260619-230350-l2-025-role-policy-decision-package/ROLE_POLICY_DECISION_PACKAGE.md` is the current Owner-approval package for role policy. It recommends Option A, but Option A is not approved or implemented until the Owner explicitly approves and follow-up implementation/test tasks close.

`TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio/AUDIT_LOG_REDACTION_POLICY.md` is the current audit-log redaction/minimization policy draft. It defines audit payload field categories, event-specific allowlists, forbidden data classes, approval boundaries, and implementation follow-ups. It is not evidence that audit sanitizer code, retention policy, or production historical cleanup is implemented.

## Environments, build, deploy and operations

- Package scripts include `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run agents:check`.
- Rules-only changes should run `npm run agents:config`, `npm run agents:templates`, and `npm run agents:check`.
- Codex One Command Mode v3.2 is integrated at `.ai-company/ONE_COMMAND_MODE.md`; root `AGENTS.md` remains the executable entry for Owner Simple Mode, while the adapter is the long-form natural-language task intake reference.
- Safe local cleanup can delete ignored generated artifacts such as `.next/`, `dist/`, `storybook-static/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo`, `.DS_Store`, and Python `__pycache__/` after confirming they are not Git-tracked. Do not auto-delete screenshots, exports, governance memory, migrations, source files, or `node_modules/` without a separate approval decision.
- In the current dirty RepairDesk checkout, blanket `git clean -nd` / `git clean -ndX` is unsafe because it would remove untracked governance files, screenshots, exports, migrations, source files, environment/deployment state, or dependencies. Cleanup should use explicit paths only.
- Full app gates are required for code/UI changes unless clearly blocked by unrelated worktree state or environment failure.
- Owner visual evidence rule: every task closeout must include screenshot path(s) for relevant task/result pages when a UI, preview, browser-visible result, or workflow page exists. Pure docs/backend/data/scripts/non-UI tasks must explicitly state the no-screenshot reason and provide alternate evidence. Screenshots must not expose secrets, production credentials, full customer PII, or unnecessary sensitive data.
- Owner AI-employee rule: when the Owner asks for departments, AI employees, sub-agents, multi-agent execution, review, or simulation, the Integration Lead must use real Codex sub-agent spawning when tooling is available. Each closeout must record spawned agent ids/nicknames/roles/modes/results, or a concrete no-spawn reason. Department labels alone are not evidence of AI employee execution.
- 2026-06-19 takeover validation passed: `npm run agents:check`, `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`, `npm run lint`, `npm run typecheck`, `npm run test` (37 files / 220 tests), and `npm run build` outside sandbox. Sandboxed `npm run build` can fail with Turbopack `Operation not permitted` while binding to a port; rerun outside sandbox before classifying as code failure.

## Active decisions and ADR index

- AI Company OS Codex Native v3.0 adopted as subordinate governance package under `.ai-company/`, `.codex/`, and `.agents/skills/`.
- Codex One Command Mode v3.2 adopted as the RepairDesk natural-language Owner task intake layer under `.ai-company/ONE_COMMAND_MODE.md`.
- RepairDesk Integration Lead remains the only user-facing decision owner.
- Generic AI Company OS roles map into existing RepairDesk departments rather than replacing them.
- Project charter lives at `docs/project-charter.md`.

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

- Latest conditionally closed task: `TASK-20260710-009-security-reliability-hardening-release`. Customer read/auth/schema/pagination/script/E2E hardening and atomic/idempotent payment recording are live at `cee5a1b4`; existing page layout/UI was preserved.
- TASK-009 established a durable payment command boundary: BFF authorization and validation, service-role-only invoker RPC, immutable ledger/idempotency key, advisory lock and order row lock in one transaction. A migration-slice PASS must never be summarized as an environment-wide Database Gate PASS.
- TASK-009 linked audit found 17 legacy public tables with RLS disabled and direct browser-role access, a from-zero migration reset failure at `20260611102805`, missing backup/PITR restore proof and one plaintext unlock pattern pending policy. These are independent P0/policy follow-ups.
- TASK-009 also exposed a shared-workspace release-coordination failure: separate executors can race on DB/Git/deploy state. Future production releases require a serialized release lock plus remote state assertions immediately before and after writes.
- Latest closed task before this active work: `TASK-20260619-234449-l2-030-audit-project-for-similar-governanc` similar governance execution drift audit.
- Active handoff candidate: Phase 2 tenant isolation audit, using `.ai-company/memory/ACTIVE_CONTEXT.md` and `TASK-20260704-009-independent-partner-store-platform` as Phase 1 baseline evidence.
- 30-day focus: contain the 17 legacy-table browser grants after consumer discovery; repair/reconstruct the migration recovery baseline; record backup/PITR and run an isolated restore drill; add a serialized release lock and payment observability; continue Phase 2 tenant isolation, role-policy and audit-minimization work.
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

## Review triggers

- New architecture, UI standard, Supabase schema, security, payment, messaging, or customer data rule.
- Owner requests a different autonomy level or AI employee operating model.
- Agent rule checks fail or project docs conflict with implementation.
