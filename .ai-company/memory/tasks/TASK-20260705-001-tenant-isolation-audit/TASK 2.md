---
schema_version: 1
task_id: "TASK-20260705-001-tenant-isolation-audit"
title: "Independent partner store Phase 2 tenant isolation audit"
status: "conditional"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Architecture", "Data", "Documentation", "QA", "Security"]
created_at: "2026-07-04T23:29:36Z"
updated_at: "2026-07-04T23:49:50Z"
closed_at: "2026-07-04T23:49:50Z"
---
# Task — Independent partner store Phase 2 tenant isolation audit

## Owner request

Continue the independent partner-store platform plan, set the active goal, and use real sub-agents to complete the next phase. The requested next phase is Phase 2 tenant-isolation audit and hardening.

## Business value

Prove and harden store-private data boundaries before production rollout or platform support access work.

## Scope in

- Inventory tenant-boundary enforcement for major local business domains:
  - repair orders, customers, inventory, buyback, messages/templates, settings/stores, platform onboarding/support surfaces, attachments/storage, and shared router/auth context.
- Review API/router/repository paths for `store_id` filtering, active-store resolution, membership checks, role checks, and object-level authorization.
- Review local Supabase migrations/policies/tests for tenant isolation, storage scoping, indexes, constraints, and cross-store denial coverage.
- Review platform-admin routes so platform operators see platform metadata by default, not partner-store business data, unless an explicit support/access grant is designed later.
- Implement safe local fixes/tests/docs when the problem is clear, low-blast-radius, and does not require production data access or destructive migration.
- Record audit evidence, residual risks, and approval-gated follow-ups in task memory and Phase 2 progress docs.

## Scope out

- No production Supabase migration, data backfill, policy execution, storage bucket change, deploy, or customer-facing release without explicit Owner approval.
- No broad role-policy implementation beyond local audit-safe fixes; role-policy Option A remains separately approval-gated.
- No platform support impersonation/business-data access feature in this phase; only review and design boundaries.
- No unrelated cleanup of dirty worktree files, generated screenshots, legacy route files, or duplicate artifacts.
- No secret inspection beyond confirming code paths do not expose or depend on secrets incorrectly.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Treat current worktree as dirty and shared. Stage/commit/push only if the Owner explicitly asks later and after scoped diff review.
- Main thread remains Integration Lead and single writer. Sub-agents are read-only reviewers for this phase unless a later explicit scoped write package is issued.
- Code evidence wins over memory. Production parity is unknown until an owner-approved remote audit verifies it.

## Acceptance criteria

- [x] All major business API/repository surfaces are inventoried for store_id filtering and object-level authorization.
- [x] Platform routes are reviewed to confirm they expose only allowed metadata by default and no store business data without owner grant.
- [x] Storage/attachment paths are audited for store scoping and sensitive-data exposure.
- [x] Cross-store denial test gaps are identified and safe local fixes/tests are implemented where feasible.
- [x] Production-impacting migrations or policy changes are documented as approval-gated and not executed automatically.

Evidence: `PHASE2_TENANT_ISOLATION_AUDIT_REPORT.md` and `EVIDENCE.md`.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |
| Phase 1 independent partner-store baseline closed locally | observed | `.ai-company/memory/tasks/TASK-20260704-009-independent-partner-store-platform/` and `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md` | use as baseline only, not production approval |
| Production Supabase parity is not verified | observed | `OPEN_CONFLICTS.md` CONFLICT-20260619-006 | approval required before live schema/policy claims |
| Owner explicitly requested sub-agents | observed | current chat request | spawn 2-4 read-only reviewers and record outputs |

## Decision and approval points

- R3 / L2: local audit, local reversible code/test/doc fixes allowed.
- Approval required before any production migration/policy/storage execution, deploy, destructive data action, live customer/staff communication, secret handling, or platform support access model that exposes partner-store business data.
- If audit finds a P0 isolation hole, stop feature work and switch to incident-response framing with containment options.

## Work packages

1. Integration Lead: restore context, maintain task contract, inspect shared router/auth entry points, own final integration and safe local patches.
2. Solution Architect sub-agent, read-only: map API/repository/module boundary and object-level authorization design gaps.
3. Data Reviewer sub-agent, read-only: audit schema/migrations/storage/RLS/index/constraint coverage for tenant isolation.
4. Security Reviewer sub-agent, read-only: threat model cross-store access, platform-admin visibility, attachments, sensitive fields, audit logging.
5. QA Reviewer sub-agent, read-only: inventory denial-test coverage and propose/verify local test plan.
6. Integration Lead: consolidate findings into a Phase 2 audit report, implement safe local fixes/tests where clear, run gates, checkpoint memory.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.

## Verification plan

- Static inventory: `rg` scans for store/auth/platform/storage access patterns.
- Targeted tests first: tenant guard/router/repository tests touched by findings.
- Full gates as feasible for code changes: `npm run lint`, `npm run typecheck`, `npm run test`; `npm run build` only if code changes warrant it and environment allows.
- No UI screenshot is required if the phase remains backend/audit/documentation only; provide report paths and command evidence instead.
