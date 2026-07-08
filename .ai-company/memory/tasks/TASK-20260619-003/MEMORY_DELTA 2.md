# Memory Delta — TASK-20260619-003

## Candidate project facts

- RepairDesk is currently a Next.js App Router app with the user-facing data path `src/lib/repairdesk/api.ts` -> `src/app/api/repairdesk/[...path]/route.ts` -> `src/server/api/repairdesk-router.ts` -> feature services/repositories. Source: `PROJECT_TAKEOVER_REPORT.md`. Status: accepted for project memory.
- Core business domains are orders, customers/devices/CRM, buyback, inventory, message templates, store settings, onboarding/platform approvals, attachments, audit logs, and mobile task/detail workflows. Source: local routes/features/migrations. Status: accepted for project memory.
- Current verification gates pass: `agents:check`, v3 validation, lint, typecheck, unit tests, and production build outside sandbox. Source: `EVIDENCE.md`. Status: accepted for project memory.
- The worktree is not clean and contains 99 `* 2.*` duplicate files. Source: `git status --short`, `rg --files -g '* 2.*'`. Status: open risk.
- `src/features/orders/screens/order-list-screen.tsx` still imports legacy `@/routes/orders.index`. Source: file inspection. Status: open architecture debt.

## Candidate department updates

- All departments should treat `PROJECT_TAKEOVER_REPORT.md` as the initial verified project baseline for 2026-06-19.
- QA and Operations should preserve the distinction between sandbox-only Turbopack build failure and code build health.
- Data and Security should require explicit owner approval before remote Supabase schema/RLS/role audits or production data operations.
- Documentation and Architecture should prevent stale TanStack-era docs from overriding current App Router rules.

## Candidate decisions / ADRs

- No new architecture decision was approved in this task. The takeover only records current facts, risks, and recommended roadmap.
- Interim rule retained: RepairDesk root rules and `.ai-company/REPAIRDESK_ADOPTION.md` override generic AI Company OS templates.

## Candidate lessons and capability evidence

- `project_explorer`, `qa_reviewer`, `documentation_reviewer`, and `memory_steward` have positive evidence on this task through mapping, verification interpretation, docs-only synchronization, and task memory updates.
- Capability levels remain conservative: most specialist agents are C1 until they complete scoped positive/boundary evaluations in their own domains.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
