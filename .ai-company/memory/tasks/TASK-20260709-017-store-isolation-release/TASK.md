---
schema_version: 1
task_id: "TASK-20260709-017-store-isolation-release"
title: "Store isolation runtime hardening and migration release"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "DATA", "DOC", "INT", "QA", "RELEASE", "SECURITY"]
created_at: "2026-07-09T13:56:38Z"
updated_at: "2026-07-09T14:11:43Z"
---
# Task — Store isolation runtime hardening and migration release

## Owner request

老板要求：设置目标并开始计划；任务完成后自动推送到 `main`，并应用数据库迁移。

Interpretation:

- Continue from the previous A/B store isolation audit.
- Complete the next safe store-isolation hardening slice, not the entire multi-phase platform roadmap in one batch.
- Treat `origin/main` push as approved after local gates pass.
- Treat production database migration as approved only for a scoped, preflighted, explicitly named migration/reconciliation step; do not apply broad historical migrations.

## Business value

Complete the next safe store A/B isolation hardening slice, keep production database migrations controlled, and ship verified changes to main.

## Scope in

- Use a clean worktree based on latest `origin/main`.
- Refine the A/B store isolation hardening scope into one shippable implementation slice.
- Inspect current migration history and avoid unsafe historical replay.
- Implement runtime/API/database hardening only where it directly supports the selected slice.
- Add or update tests proving A/B store isolation behavior.
- Run quality gates and record exact results.
- Commit, push to `origin/main`, and apply the approved migration scope only after preflight evidence exists.

## Scope out

- Broad `supabase db push`, `--include-all`, or batch marking all missing historical migrations as applied.
- Applying draft offline sync RPC migrations unless separately approved.
- Replaying old workflow/data-update migrations without product/data review.
- Store support-access Phase 3, lifecycle/closure Phase 4, and feature flag Phase 5 unless the scoped slice requires a small enabling change.
- Destructive SQL, data deletion, secret handling, paid service changes, customer-facing announcements, or deployment outside the code/database changes needed here.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Use `/private/tmp/repairdesk-store-isolation-release` as the implementation worktree; the original checkout is dirty and behind `origin/main`.
- `supabase migration list` currently shows old local migration history gaps; these are not proof that all old SQL should be applied.
- Supabase project target is `xluzcoduqsdvjoouqhkc` / `ChinaTech_date`.

## Acceptance criteria

- [ ] Use clean worktree based on latest origin/main.
- [ ] Do not run broad supabase db push or include-all against production.
- [ ] Produce an explicit migration reconciliation plan before applying any production DDL.
- [ ] Implement only scoped store-isolation hardening with tests.
- [ ] Run required lint/typecheck/test/build or record exact blockers.
- [ ] Push scoped verified commit to origin/main after gates pass.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner wants automatic push to `main` after completion | observed | owner message 2026-07-09 | accepted after gates pass |
| Owner wants database migrations applied | observed | owner message 2026-07-09 | accepted only for scoped, preflighted migration steps |
| Clean implementation worktree exists | observed | `/private/tmp/repairdesk-store-isolation-release`, `git status --short --branch` | baseline is `origin/main` at `e072fcca` |
| Original checkout is dirty and behind | observed | `git status --short --branch` in original checkout | do not implement there |
| Supabase project is linked to `xluzcoduqsdvjoouqhkc` | observed | `supabase/config.toml`, MCP project list, `supabase link` | use this project only |
| Remote migration history still has older local-only gaps | observed | `supabase migration list` | migration reconciliation required before production DDL |
| Prior task `TASK-20260709-015` applied `20260709125247_repairdesk_historical_schema_reconcile` | observed | task memory and migration file | do not duplicate that work |
| Exact store-isolation slice to implement | assumption | prior A/B isolation audit | default to next high-value runtime route/object gate unless code inspection selects safer slice |

## Decision and approval points

- D1: Do not run broad `supabase db push`, `--include-all`, or batch historical migration repair.
- D2: Production DDL must have a named SQL file or exact SQL, rollback/preflight notes, and post-apply verification query.
- D3: If inspection shows the next safe slice requires changing role/permission behavior with visible staff impact, pause and record a plan delta before shipping.
- D4: If Supabase CLI/MCP reports drift, lock timeout, or partial application risk, stop migration execution and report the blocker.

## Work packages

## WP-01 Intake, Baseline, And Migration State

- Owner: Integration Lead
- Goal: establish safe worktree, target project, migration history, and release boundary.
- Validation: `git status`, `supabase migration list`, prior task memory, official Supabase changelog/docs.
- Exit: safe execution plan and blocked actions recorded.

## WP-02 Select Store-Isolation Slice

- Owner: Integration Lead with DATA/API/SEC review pass in main thread.
- Goal: choose one shippable hardening slice from the previous audit, prioritizing runtime route/object-level authorization or missing DB guardrail with low data risk.
- Validation: code references and acceptance tests mapped before edits.
- Exit: exact files and tests listed before implementation.

## WP-03 Implementation

- Owner: single writer, main thread.
- Goal: minimal code and/or migration change.
- Validation: targeted tests after each increment.
- Exit: scoped diff only.

## WP-04 Quality, Security, Data, Release Gates

- Owner: Integration Lead.
- Goal: run lint/typecheck/test/build, migration preflight, and review tenant/PII risks.
- Validation: command outputs and query evidence in `EVIDENCE.md`.
- Exit: PASS or explicit blocker.

## WP-05 Apply Migration, Push Main, Closeout

- Owner: Integration Lead.
- Goal: apply approved migration scope, verify remote state, commit, push `origin/main`, checkpoint memory.
- Validation: post-apply query, `git status`, `git log`, push result.
- Exit: task closed with no-screenshot reason or screenshot if UI is affected.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- `origin/main` contains the scoped commit if gates pass.
- Production database contains only the approved migration effects, with post-apply verification.
