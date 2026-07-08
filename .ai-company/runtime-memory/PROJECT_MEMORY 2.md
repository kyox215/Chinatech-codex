# PROJECT MEMORY

- Project ID: chinatech-repairdesk
- Owner: Hexiang Huang / 鹤祥
- Version: 1
- Status: active
- Last verified: 2026-06-19 CEST

## Product and business overview

Chinatech RepairDesk is a Next.js internal management system for a phone repair and electronics shop in Floridia, Siracusa, Italy. It supports repair orders, customers, buyback, inventory, payments, messaging, platform settings, and mobile task/detail workflows.

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

## Authentication, authorization and sensitive data

Sensitive areas: customer PII, phone numbers, repair history, device identifiers, attachments/photos, payment states, staff actions, tenant/store isolation, Supabase credentials, and external communications.

Client components must not import `src/server/*`. Server-side validation is required for critical business rules, permissions, store isolation, payments, inventory movement, and workflow transitions.

## Environments, build, deploy and operations

- Package scripts include `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run agents:check`.
- Rules-only changes should run `npm run agents:config`, `npm run agents:templates`, and `npm run agents:check`.
- Full app gates are required for code/UI changes unless clearly blocked by unrelated worktree state or environment failure.

## Active decisions and ADR index

- AI Company OS v2.0 adopted as subordinate governance package under `.ai-company/`.
- RepairDesk Integration Lead remains the only user-facing decision owner.
- Generic AI Company OS roles map into existing RepairDesk departments rather than replacing them.
- Project charter lives at `docs/project-charter.md`.

## Risks, technical debt and exceptions

- Current worktree may contain unrelated modified/untracked files; validation results must be attributed carefully.
- Generic OS docs can create procedural duplication if not filtered through `.ai-company/REPAIRDESK_ADOPTION.md`.
- Build failures may sometimes be environment-specific; rerun and classify before treating them as code regressions.

## Current roadmap and work in progress

- Active task: `TASK-20260619-001` AI Company OS adoption into RepairDesk project rules and memory.

## Evidence and authoritative sources

- `AGENTS.md`
- `AI智能部门管理/部门化管理设计.md`
- `.agents/README.md`
- `.agents/repairdesk-multiagent.yaml`
- `.ai-company/REPAIRDESK_ADOPTION.md`
- `docs/project-charter.md`
- `package.json`

## Review triggers

- New architecture, UI standard, Supabase schema, security, payment, messaging, or customer data rule.
- Owner requests a different autonomy level or AI employee operating model.
- Agent rule checks fail or project docs conflict with implementation.
