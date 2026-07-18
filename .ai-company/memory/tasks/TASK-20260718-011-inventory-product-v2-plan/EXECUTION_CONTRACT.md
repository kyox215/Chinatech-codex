# Inventory Product V2 Execution Contract

## Authority

- Owner approved implementation and direct push to `main` on 2026-07-18.
- Main thread is the only code writer and final integration owner.
- Production database apply, paid/real AI traffic and production deploy remain separate D4 gates.

## Base and isolation

- Base: `origin/main@f9b0ee8c2d8dd10c66ad8d2f6df85716a36ebcf2`.
- Worktree: `/private/tmp/repairdesk-inventory-v2-20260718`.
- Branch: `agent/inventory-v2-release-20260718`.
- The original dirty/diverged checkout is read-only for this implementation.

## Work packages

1. Baseline and architecture: inventory/AI/API/schema facts, ADR, flags and rollback.
2. Data foundation: additive catalog, variant, unit identifiers, movement, sale/payment/warranty tables plus atomic command RPCs; no destructive contract step.
3. Application contracts: types, validation, server repository/service/router, client API, mock parity and query keys.
4. Beginner UI: mobile/desktop unified V2 intake and sale flows, five-stage language, complete operational states and AI draft application.
5. Migration/reconciliation: deterministic preview queries and operational runbook; production apply remains gated.
6. Independent review: DATA/Architecture, UX/FE and QA/SEC read-only agents; main thread resolves findings.
7. Quality/release: targeted tests, full lint/typecheck/test/build, browser viewports/screenshots, diff/secret review, checkpoint, scoped commit and remote drift assertion before `HEAD:main`.

## Stop conditions

- Any need to delete historical data or disable V1 writes before verified rollback.
- Any production database mutation, deploy or real customer/AI data transmission without a separate approval.
- Remote `main` changes after the final base assertion; fetch and rebase/revalidate instead of force-pushing.
- P0/P1 security, tenant-isolation, atomicity or migration failure.

## Rollback

- Application: V2 UI/command flags default off until the migration and store release gate pass.
- Data: additive objects stay dormant; never emergency-drop them. Re-enable the V1 UI/write compatibility path during the observation window.
- Git: direct push must be fast-forward only; no force push.
