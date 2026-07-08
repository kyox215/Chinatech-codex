# Worktree Package Plan

Verified on 2026-07-02 against the current `main` worktree.

## Executive Summary

Do not use blanket `git add .`.

Current worktree state:

- Staged files: 0
- Modified tracked files: 67
- Untracked files: 1248
- `git diff --check`: passed
- `screenshots`: 76M
- `exports`: 59M

The current dirty tree should be handled as separate packages. Each package needs explicit staging, validation, and closeout.

## Package A: Performance Optimization

Recommended priority: first.

Why: this package is cohesive, recently validated, and has clear user value for loading speed and response time.

Tracked source/config files:

- `src/app/providers.tsx`
- `src/components/command-palette.tsx`
- `src/features/dashboard/screens/dashboard-screen.tsx`
- `src/features/inventory/api/query-keys.ts`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/inventory/server/inventory.service.ts`
- `src/features/inventory/testing/mock-api.ts`
- `src/features/orders/api/query-keys.ts`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/lib/mock/api.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/types.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-schemas.ts`

Untracked support/evidence files:

- `src/components/use-command-palette.ts`
- `src/lib/repairdesk/api.test.ts`
- `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`
- `.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/`
- `screenshots/TASK-20260701-007-performance-optimization/`

Recommended validation before any commit:

- `npm run typecheck`
- `npm run lint`
- Focused Vitest for API/performance changes
- `npm run test`
- `npm run build`
- Relevant Playwright request-monitor smoke if available

Hold:

- No deploy or push without owner approval.

## Package B: Governance / AI Company OS

Recommended priority: second, after the performance package is safely separated.

Tracked files:

- `.agents/README.md`
- `.agents/integration-checklist.md`
- `.agents/repairdesk-multiagent.yaml`
- `.agents/task-package-template.md`
- `.ai-company/memory/ACTIVE_CONTEXT.md`
- `.ai-company/memory/tasks/TASK-20260620-014006-repairdesk-figma-ui-system/CHECKPOINTS.md`
- `.ai-company/memory/tasks/TASK-20260620-014006-repairdesk-figma-ui-system/EVIDENCE.md`
- `AGENTS.md`
- `AI智能部门管理/templates/agenda-intake.md`
- `AI智能部门管理/部门化管理设计.md`
- `scripts/agents/check-agent-config.mjs`
- `tools/ai_company.py`
- `docs/project-charter.md`

Untracked governance roots:

- `.ai-company/`
- `.agents/skills/`
- `.codex/`

Recommended validation:

- `npm run agents:config`
- `npm run agents:templates`
- `npm run agents:check`
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`

Hold:

- Do not mix governance with UI or performance commits.
- Do not stage all `.ai-company/memory/tasks/` without reviewing whether old task-memory imports are intended to be versioned.

## Package C: Figma / RepairOS UI System

Recommended priority: later.

Why: this package is large, cross-feature, and evidence-heavy.

Tracked areas:

- `docs/ARCHITECTURE.md`
- `docs/COMPONENT_GENERATION_DECLARATION.md`
- `docs/GPT_PROJECT_REPLANNING_BRIEF.md`
- `docs/ORDERS_FULL_EXPORT.md`
- `docs/ORDERS_SPEC.md`
- `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md`
- `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md`
- `docs/REFACTOR_EXECUTION_PLAN.md`
- `docs/REPAIROS_COMPACT_ARCHITECTURE.md`
- `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`
- `docs/RESPONSIVE_DENSITY_PLAN.md`
- `docs/UI_CHECKLIST.md`
- `docs/UI_PAGE_GENERATION_DECLARATION.md`
- `src/features/buyback/**`
- `src/features/customers/**`
- `src/features/messages/screens/messages-screen.tsx`
- `src/features/platform/screens/platform-admin-screen.tsx`
- `src/features/settings/screens/settings-screen.tsx`

Untracked evidence:

- Many `screenshots/figma-ui-system-20260620/*.png`

Recommended validation:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Targeted Playwright screenshot/overflow checks

Hold:

- Avoid committing every screenshot. Select only evidence needed for the release/task record.

## Package D: Orders UI / Density

Recommended priority: after Package A.

Tracked files currently overlapping order work:

- `src/features/orders/components/order-list-filters.tsx`
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/screens/order-task-screen.tsx`

Untracked evidence examples:

- `screenshots/TASK-20260701-001/`
- `screenshots/TASK-20260701-003-new-order-mobile-public-no/`
- `screenshots/TASK-20260701-008-order-mobile-list-lightweight/`
- `screenshots/order-*`
- `screenshots/responsive-density/`

Important current observation:

- The current dirty tree does not show active `20260702` unlock or order-card-density paths in `git status`.
- Treat any older summary mentioning those paths as stale unless a later scan finds them again.

## Package E: Database / Supabase

Recommended priority: separate approval lane.

Current untracked migrations:

- `supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql`
- `supabase/migrations/20260620120000_customer_interactions_store_id_repair.sql`

Recommended validation:

- Review migration contents.
- Confirm whether each migration has already been applied locally or remotely.
- Do not run production `supabase db push` without owner approval.

Hold:

- Do not bundle migrations into UI/performance commits.
- Do not delete migration files without confirming whether they are historical repair artifacts.

## Package F: Exports / Large Evidence

Recommended priority: last.

Current size:

- `exports`: 59M
- `screenshots`: 76M

Observed risk:

- `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST/source/` contains a full source snapshot plus `supabase/.temp` metadata from that snapshot.

Recommended action:

- Keep as local evidence until owner confirms whether to archive externally, ignore, or delete.
- Do not commit full `exports/` by default.
- If a handoff zip is needed, commit only the intended zip or move it outside the repo after approval.

## First Execution Slice

This task started with a safe additive slice:

- Create task memory under `.ai-company/memory/tasks/TASK-20260702-003-worktree-cleanup-execution/`
- Record current package boundaries.
- Leave business code, migrations, evidence, staging, commits, and push untouched.
