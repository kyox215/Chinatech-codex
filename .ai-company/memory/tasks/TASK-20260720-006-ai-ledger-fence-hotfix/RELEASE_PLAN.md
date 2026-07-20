# Release Plan — AI ledger lifecycle fence hotfix

## Release unit and approval

- Target: linked Supabase project `xluzcoduqsdvjoouqhkc`.
- Exact database unit: `20260720065246_ai_usage_bucket_store_fence_hotfix.sql`.
- Application code/config unit: none. No Vercel deployment, AI flag, Vision, policy, pricing, model, secret or quota change is required.
- Git unit: scoped candidate files only; preserve the dirty primary checkout and unrelated work.
- Approval state: Owner explicitly approved scoped commit/push and production migration `20260720065246` on 2026-07-20. No Vercel deploy, PR merge, other migration, Vision smoke, flag/policy/model/secret/quota change or lifecycle mutation is authorized.

## Pre-apply gates

1. Fetch `origin` and verify/reconcile the candidate against current `origin/main` in an isolated worktree.
2. Verify migration SHA-256 matches E-005 and `git diff --check` passes.
3. Re-run focused tests and, if any source/dependency/base changed, the full quality gates.
4. Confirm the exact linked project and that migration history aligns through `20260720013000`.
5. Run `supabase db push --linked --dry-run`; stop unless the only pending file is `20260720065246`.
6. Re-run aggregate-only production preflight; stop unless total reserved, non-active-store reserved and expired reserved are all zero.
7. Confirm no concurrent database release or lifecycle mutation window is active.
8. Obtain explicit Owner approval for the exact Git delivery and production migration command.

## Apply sequence

1. Create a scoped commit containing the reviewed migration, tests, docs and task memory; push through the Owner-approved Git path.
2. Recheck linked dry-run after the push and immediately before apply.
3. Apply only `20260720065246` through the linked migration workflow. Do not use `--include-all`, migration repair, SQL Editor or manual history edits.
4. A five-second lock timeout is an expected safe stop: record it, make no force/unlock change, verify no migration-history row was added, then retry only after the lock owner is understood.

## Zero-cost post-apply checks

- Migration history contains exactly one new `20260720065246` row.
- `repairdesk_lifecycle_fence_ai_assistant_usage_buckets` is bound once to `repairdesk_enforce_ai_usage_bucket_store_write`.
- `repairdesk_00_reserved_ai_usage_transition_fence` is bound once to `repairdesk_block_store_transition_with_reserved_ai_usage`.
- `anon` and `authenticated` cannot execute either trigger function; AI table RLS and existing grants are unchanged.
- Reserved/non-active-reserved/expired-reserved aggregate counts remain zero before smoke.
- No new `STORE_LIFECYCLE_STORE_REQUIRED`, `AI_BUDGET_UNAVAILABLE`, error or fatal event appears after the migration timestamp.

## Canary and observation

1. Execute exactly one synthetic, non-PII ChinaTech order-text request through the normal authenticated service path. Do not call OpenAI directly and do not use a real customer/order/device identifier.
2. Require HTTP 200, one request-row increase, terminal `succeeded`, one provider attempt, three consistent bucket updates, cost at or below the 308 micro-USD reservation ceiling, and a successful privacy-safe audit row.
3. Do not execute a production Vision smoke; Vision remains a separate D4 and is covered locally by service/PG17 tests.
4. Observe at least 15 minutes: HTTP 503/error/fatal counts, budget-unavailable count, open/stale reservations, request/attempt/token/micro-USD deltas and duplicate-charge indicators.
5. Stop on any permission drift, cross-store effect, PII exposure, unreserved dispatch, unresolved reservation, duplicate charge, ledger mismatch or repeated 503.

## Recovery

- Immediate containment: turn off paid AI through the existing approved flag/deploy mechanism while preserving local/manual search.
- Database recovery: prefer a corrected forward migration. A compensating migration may restore the prior trigger only while paid AI is off, because the prior trigger recreates the known outage.
- Do not drop usage tables, delete/alter ledger rows, edit applied migration files, repair history, change policy/limits, or erase audit evidence.
- The migration contains no data transformation, so no backup restore/backfill is expected. Trigger DDL failure inside the transaction rolls back as a unit.

## Release record

- Owner approval: received for the exact scoped Git delivery and migration `20260720065246`.
- Git commit/push: release commit `bbdb98c1a51232db2003decafb78532c940cebf3` pushed non-force to `origin/codex/ai-ledger-fence-hotfix-20260720`; primary checkout and `main` preserved.
- Production migration: exactly `20260720065246` applied successfully to `xluzcoduqsdvjoouqhkc`; catalog, bindings, ACL, RLS, browser grants and reservation aggregates passed; final dry-run reports up to date.
- Canary: exactly one synthetic non-PII order-text service request (`961f26bf-5e56-44a8-90da-c19ebe794a63`) returned HTTP 200, used one provider attempt and settled at `130 micro-USD`; audit and all three bucket scopes are consistent.
- Observation: 15 minutes / 16 polls completed at `2026-07-20T12:54:57.951982Z` with zero open, bad, cross-store, reserved, overrun, window-bad-audit and Vercel runtime errors. No rollback was required.
- Application release: none required or performed. Existing production Vercel deployment remains unchanged.
- Follow-up: integrate the full hotfix branch into `main` before the next database release; PR merge was not part of this approval.
