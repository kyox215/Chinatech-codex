# TASK-20260709-022 Independent Store Isolation Plan Implementation

Status: verified
Owner: Hexiang Huang / 鹤祥
Executor: Integration Lead / CEO Agent
Created: 2026-07-09T21:40:26Z
Risk: R3 for production database actions; R1/R2 for documentation and local governance updates
Autonomy: L2 for local scoped changes; production database apply remains approval-gated and currently blocked

## Owner Goal

Implement the independent-store isolation plan, push completed work to `main`, and apply database changes where safe.

## Current Decision Boundary

The implementation target is the independent-store statement:

- Platform is not a headquarters.
- Stores are not platform branches.
- Platform is a system service provider.
- Each store is an independent private tenant.
- Store A and Store B business data must remain completely isolated.

## In Scope For This Slice

- Strengthen canonical documentation so product, permissions, data isolation, release, and database gates all follow the independent-store model.
- Add an execution checklist that future code/database work must pass before claiming complete isolation.
- Record the current database application status based on existing migration-history evidence and current CLI availability.
- Push the scoped documentation and task-memory changes to `main` after validation.

## Out Of Scope For This Slice

- Runtime authorization code changes.
- New Supabase migration files.
- `supabase db push`, `supabase migration repair`, linked migration apply, schema-cache reload, or production data mutation.
- Vercel deployment.
- UI changes or screenshots.

## Verified Facts

| Fact | Evidence |
|---|---|
| Clean implementation worktree is based on latest `origin/main` at `9eb141e9`. | `/private/tmp/repairdesk-isolation-implementation`, `git status --short --branch` |
| Supabase CLI is available as `2.101.0`. | `supabase --version` with escalated filesystem permission due telemetry write |
| Production/linked database apply is not safe from this slice. | `docs/SHARED_DB_TENANT_PHASE5R_MIGRATION_RECONCILIATION_PLAN.md` and `docs/SHARED_DB_TENANT_PHASE5R_REMEDIATION_PACKAGE.md` document seven remote-only migration versions with missing exact SQL and no authorized linked apply |
| Current plan already records that Phase 5 live verification is blocked on migration-history mismatch. | `docs/SHARED_DB_TENANT_ONBOARDING_EXECUTION_PLAN.md` |

## Risk Classification

- Documentation/governance updates: R1/R2, reversible.
- Tenant-isolation implementation and production database action: R3, because wrong apply could mutate production schema/history or weaken privacy guarantees.
- Database apply outcome for this slice: blocked by migration-history reconciliation, not executed.

## Agent Plan

Single-thread execution.

No spawned sub-agents because the current multi-agent tool explicitly requires the user to ask for sub-agents/delegation/parallel agents. The owner asked to execute the plan but did not request sub-agents. Data, Security, QA, Release, and Documentation reviews are performed by the Integration Lead using the project skills and recorded as hand reviews.

## Acceptance Criteria

- Canonical docs clearly state the independent-store model and complete A/B store isolation requirements.
- Role/permission plan ties support access, platform visibility, and field-level projection to the independent-store declaration.
- Shared DB tenant plan states the database application gate truthfully: shared DB is the target, but production apply remains blocked until migration-history reconciliation is resolved.
- No new DB migration is created unless a safe, specific schema change is identified.
- If database apply is unsafe, the final report explicitly says why it was not applied.
- Validation evidence is recorded.

## Result Before Release

- Documentation/governance implementation is complete and validated.
- Database apply was not executed because the Phase 5R migration-history reconciliation gate is unresolved.
- Ready to commit and push scoped changes to `main`.

## Visual Evidence

No screenshot is expected unless UI changes are introduced. This slice is docs/rules/database-governance only.
