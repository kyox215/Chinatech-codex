# RepairDesk Functional Refactor Handoff

Last verified: 2026-06-20 CEST
Owner: Hexiang Huang / Chinatech
Repository: `chinatech-repairdesk-next`
Purpose: give another GPT, engineer, or refactor agent enough current system knowledge to rebuild or restructure the project without losing business behavior.

## Scope

This package documents system functionality only. It intentionally excludes UI design direction, visual tokens, layout advice, Figma material, screenshots, and style guidance.

Included:

- Business modules and user-facing system capabilities.
- Current run commands, environment variable names, Supabase local ports, and validation commands.
- API route map, client API facade, server service/repository boundaries, Zod validation, data types, migrations, and tables.
- Refactor risks, protected business invariants, and suggested rebuild phases.
- Source file manifest used to produce this handoff.

Excluded:

- `.env.local` values and any production secrets.
- Full customer data, real customer PII, passwords, service role keys, or private files.
- UI redesign instructions, color/design tokens, screenshots, visual comparisons, and Figma artifacts.

## Package Files

- `SYSTEM_FUNCTIONAL_MAP.md` - complete functional map by business domain.
- `RUNBOOK.md` - how the project runs locally and how to verify it.
- `API_AND_DATA_CONTRACTS.md` - API, type, server, data, storage, and migration contracts.
- `REFACTOR_NOTES.md` - suggested refactor sequence, risks, and invariants to preserve.
- `FILE_MANIFEST.md` - current files, directories, migrations, tests, and scripts used as evidence.
- `README_FOR_REFACTOR.md` - this entry file.

## Current System Summary

RepairDesk is a Next.js App Router + Supabase system for a phone repair and electronics resale shop. It supports:

- Repair orders from intake, diagnosis, quote, approval, parts, repair, notification, pickup, completion, cancellation, and rework.
- Customer CRM, devices, phone lookup, interaction history, tags, follow-ups, and messaging.
- Inventory for second-hand electronics and buyback/resale items, including intake, checks, expenses, sale, attachments, and SeaTable import.
- Buyback quote workflow for iPhone/electronics intake and handoff into inventory.
- Message templates and store settings for WhatsApp/SMS manual workflows.
- Multi-store onboarding, active-store switching, staff roles, invitations, platform approval, and store isolation.
- Audit logging, server-side business validation, and private attachment metadata routed through the server.

## Current Architecture Snapshot

- Next.js route files live in `src/app`.
- Interactive business screens live in `src/features/*/screens`.
- Client calls use `src/lib/repairdesk/api.ts` or feature API/query-key facades.
- The single HTTP API entry is `src/app/api/repairdesk/[...path]/route.ts`.
- API dispatch and Zod validation live in `src/server/api/repairdesk-router.ts` and `src/server/api/repairdesk-schemas.ts`.
- Business persistence lives in feature server services/repositories under `src/features/*/server`.
- Shared types live in `src/lib/repairdesk/types.ts`.
- Supabase migrations live in `supabase/migrations`.
- Mock fallback lives in `src/lib/mock/api.ts` and feature testing files.

## Important Refactor Rule

Do not start with a big-bang rewrite. First preserve the existing contracts:

1. `src/lib/repairdesk/types.ts`
2. `src/lib/repairdesk/api.ts`
3. `src/server/api/repairdesk-router.ts`
4. `src/server/api/repairdesk-schemas.ts`
5. Supabase migrations and table relationships
6. Existing tests under `src/features/**`, `src/server/**`, `src/shared/**`, and `tests/e2e/**`

Only after contract coverage exists should modules be split or rebuilt.

## Suggested Prompt For Another GPT

```txt
You are taking over a Next.js App Router + Supabase RepairDesk system for Chinatech.
Read this package first:
- README_FOR_REFACTOR.md
- SYSTEM_FUNCTIONAL_MAP.md
- RUNBOOK.md
- API_AND_DATA_CONTRACTS.md
- REFACTOR_NOTES.md
- FILE_MANIFEST.md

Goal: plan and execute a system refactor without losing existing business behavior.
Do not redesign UI. Do not change database schemas without migrations. Do not expose secrets.
First produce a migration-safe refactor plan that preserves API, data, auth, store isolation,
order workflow, customer CRM, inventory/buyback, messaging, and audit behavior.
```
