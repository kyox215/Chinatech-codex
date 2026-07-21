# Release Plan — TASK-20260721-001-orders-filter-removal

## Approval and target

- Owner approval: `部署` received in the main Codex task on 2026-07-21 CEST.
- Target: Vercel production project `chinatech-codex`, domains `chinatech.in` and `www.chinatech.in`.
- Release owner and observer: CEO-Orchestrator / Integration Lead.
- Release unit: Orders toolbar filter-entry removal, its regression assertion, and this task evidence.

## Pre-release gates

- No database migration, environment-variable, dependency, API, permission, tenant, or data-contract change belongs to this release unit.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run test`: 331 files / 2,163 tests pass on the rebased release candidate.
- `npm run build`: pass.
- Orders Playwright regression: 3 tests pass at mobile, tablet, and desktop widths on the rebased release candidate.
- Security review: PASS; see `SECURITY_REVIEW.md`.
- Quality gate: PASS; see `QUALITY_GATE.md`.

## Deployment strategy

1. Rebase the scoped commit onto the current `origin/main` without replacing the active memory context of another task.
2. Push `codex/orders-remove-filter-20260721`.
3. Create a focused PR into `main`, verify the PR diff and expected head SHA, then merge.
4. Let the existing Vercel Git integration build the exact merged `main` commit.
5. Do not declare release success until the exact deployment is `READY` and the production Orders route passes smoke and visual verification.

## Baseline and rollback

- Pre-release `origin/main`: `d796feca69d12ef9884baaae7bf690b4c5202e16`.
- Pre-release production deployment: `dpl_63vFKJhMDrHh5zGQxsdcVKurEGBZ` (`READY`).
- Rollback trigger: deployment/build failure, production HTTP 5xx, Orders route failure, missing primary toolbar actions, or unexpected filter drawer availability.
- Rollback action: immediately promote the recorded pre-release deployment or revert the release merge commit, then repeat smoke and error-log checks.
- Data recovery: not applicable; this release applies no migration or data mutation.

## Observation criteria

- Exact merged commit is the production deployment source.
- `https://chinatech.in/orders` responds successfully, allowing the expected authentication redirect when unauthenticated.
- Production toolbar has no button named `筛选`; queue, search, archive, scan, and new-order controls remain present for the controlled authenticated check.
- New deployment build errors: zero.
- New production runtime error/fatal evidence attributable to the deployment: zero during the release observation window.

## Concurrent-main note

The current `main` already contains the separately governed store-purge code and its migration file. This release neither adds nor applies that migration and must preserve its existing task memory and production state without claiming approval for any store-purge database action.
