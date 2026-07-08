---
schema_version: 1
task_id: "TASK-20260705-002-phase-21-isolation-hardening"
title: "Independent partner store Phase 2.1 pre-production isolation hardening"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Architecture", "Data", "Documentation", "QA", "Security"]
created_at: "2026-07-05T06:57:56Z"
updated_at: "2026-07-05T07:15:40Z"
closed_at: "2026-07-05T07:15:15Z"
---
# Task — Independent partner store Phase 2.1 pre-production isolation hardening

## Owner request

Independent partner store Phase 2.1 pre-production isolation hardening

## Business value

Reduce pre-production tenant isolation risks before support-access work by hardening store-scoped client caches, adding behavior-level cross-store denial tests, and preparing the owner approval package for role-policy enforcement.

## Scope in

- Add store-aware client cache boundaries for major business query key factories and active pages where the current store is available.
- Add behavior-level customer repository tests for selected high-risk tenant denial paths.
- Write an approval-gated role-policy implementation plan, without silently changing runtime role behavior.
- Update independent partner-store progress docs and task memory with validation, residual risk, and production boundary.

## Scope out

- No production Supabase migration, data backfill, RLS/storage policy execution, deploy, or release.
- No broad runtime role-policy enforcement until the Owner confirms the concrete role matrix.
- No unrelated cleanup of the existing dirty worktree or legacy generated artifacts.
- No UI redesign or navigation changes beyond query key/cache wiring.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Keep existing query-key roots as invalidation prefixes so current invalidation calls continue to work.
- Main thread is the single writer. No new sub-agent is spawned for this stage because the executable scope is narrow, low-conflict, and follows the previous Phase 2 read-only multi-agent audit.

## Acceptance criteria

- [x] Store-scoped React Query keys or cache invalidation are implemented for major feature query factories without changing production data.
- [x] Behavior-level tenant denial tests are added for selected high-risk customer repository paths.
- [x] Role-policy implementation is planned as an approval-gated package and not silently changed in runtime behavior.
- [x] Progress docs and task memory record verification, residual risks, and no-production-change boundary.

## Closeout evidence

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Target tests: `npm run test -- src/features/stores/api/query-keys.test.ts src/features/customers/server/customer.repository.test.ts` passed, 2 files / 6 tests.
- Full tests: `npm run test` passed, 52 files / 333 tests.
- `npm run build`: sandbox run failed due known Turbopack local port permission; approved non-sandbox rerun passed.
- `git diff --check`: passed.

## Residual risks

- Production Supabase schema/RLS/storage parity remains unverified and still requires explicit Owner approval.
- Runtime role-policy enforcement is not implemented in this task; the draft package is in `ROLE_POLICY_APPROVAL_PLAN.md`.
- Existing dirty worktree contains unrelated prior task changes; this task did not clean or revert them.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |
| Phase 2 closed conditionally | observed | `TASK-20260705-001-tenant-isolation-audit` | use as baseline; do not claim production parity |
| Query keys currently lack store scope | observed | `src/features/*/api/query-keys.ts` | implement optional store-aware suffixes |
| Customer repository behavior tests are missing | observed | no server customer repository test found | add targeted tests |

## Decision and approval points

- R3 / L2: local reversible code/test/docs changes allowed.
- Owner approval required before runtime role-policy enforcement, production Supabase verification, production migration, production storage/RLS changes, deploy, or platform support access.

## Work packages

1. WP-01 cache isolation: add optional active-store key suffixes while preserving root prefixes.
2. WP-02 behavior tests: add Supabase mock tests proving selected cross-store customer operations fail.
3. WP-03 role-policy plan: document the approval-gated implementation sequence and recommended role matrix checkpoint.
4. WP-04 validation and memory: run targeted/full gates as feasible, update progress docs, checkpoint, and close.

## Agent plan

- Real sub-agent spawning: not used in this stage.
- No-spawn reason: Phase 2 already used read-only Architecture/Data/Security/QA agents; Phase 2.1 executable changes are single-writer, low-conflict, and primarily test/cache wiring. A separate QA/security review can be added before production or role-policy runtime enforcement.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
