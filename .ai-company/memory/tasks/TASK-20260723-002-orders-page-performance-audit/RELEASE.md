# Release Record — TASK-20260723-002-orders-page-performance-audit

## Release unit

- Target: GitHub `main` and linked Vercel production project `chinatech-codex`.
- Scope: order list lazy dialog chunks, reduced `/orders` preload, existing queue-summary client integration, and matching tests/task evidence.
- Database: no migration files, no Supabase command and no production data mutation.
- Owner approval: explicit request “推送main 并部署” on 2026-07-23.

## Pre-release gates

- Remote `main` equals local base `0fe2b317` before commit.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 341 files / 2272 tests.
- `npm run build`: PASS.
- Controlled Chromium order-detail intent load and deferred customer preload: PASS.
- `git diff --check`: PASS.

## Deployment and observation

- Strategy: direct Owner-approved `main` push; linked Vercel production deployment, with CLI fallback only if Git integration does not create the deployment.
- Success: deployment reports Ready, production domain responds, `/orders` reaches the expected authentication or application boundary, and no immediate deployment errors are present.
- Observation window: inspect deployment/build state and production HTTP response immediately after Ready.

## Rollback

- Trigger: failed build, production 5xx, broken order list, permission/store isolation regression, or unavailable new/detail dialog.
- Code rollback: revert the release commit on `main` and push; no database rollback is required.
- Platform rollback: Vercel rollback/promote the previous known-good production deployment if alias recovery is faster.
- Data limitation: none introduced by this release; no schema or data writes are part of the unit.
