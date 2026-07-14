# WP-09 Latest-Main Integration Context Packet

Status: `local_evidence_committed_push_pr_owner_gate`
Prepared: 2026-07-14 CEST
Decision owner: RepairDesk Integration Lead / CEO Agent
Owner authorization: "开始下一步" after WP08 recommended a clean latest-main integration and local PR-preparation scope
Autonomy: L2 bounded execution
Risk: R3 because the change crosses Settings, orders, buyback, inventory, API, tenant boundaries, and staged migrations

## Objective

Create one clean, local, reviewable integration candidate from the freshly fetched `origin/main`, preserve
both current-main business changes and the twelve verified Settings commits, resolve every overlapping path
semantically, and rerun the full post-integration gate. The result is local PR preparation only.

## Verified baseline

- Initial target: `origin/main@54c29e2993ec5e0273e24ab4ef6ec302affc4a0f`.
- Refreshed target after main advanced during evidence preparation:
  `origin/main@70d211b2574257b6843763a5fd86e6e1b5e775a3`.
- Final target after the documentation-only feature-off closeout:
  `origin/main@d5384e88ca1e974d0aa58156728eb29092a7d7ff`.
- Source: `codex/settings-center-v2-20260712` at `d1b4dcaf0af34a881bf877efa3e45934a1bb7b73`.
- Merge base: `a76852f61b09f1b84ccf0def957312026d6eb3b3`.
- Divergence at the final target: target has 10 commits from the merge base; source has 12 commits.
- Integration worktree: `/private/tmp/repairdesk-settings-center-integration-20260714`.
- Integration branch: `codex/settings-center-v2-integrated-20260714`.
- The original checkout is dirty and must remain untouched.
- The source Settings worktree is clean and remains the rollback/reference point.
- The original checkout's `ACTIVE_CONTEXT.md` is stale at WP00. The source branch task record and current
  Git evidence establish WP08 as the latest verified phase.

## Scope and exclusions

In scope:

- Integrate the twelve Settings commits in their original order.
- Resolve overlapping code, tests, project memory, and documentation without whole-side replacement.
- Keep upstream buyback/order/inventory behavior and Settings tenant/draft/capability contracts.
- Run targeted regressions after conflict resolution, then the full local quality and browser gates.
- Regenerate only task-owned Settings evidence if the integrated UI materially differs.
- Produce a local integration report and PR-ready review packet.

Out of scope and not authorized:

- Push, PR creation, merge to `main`, deployment, production reads/writes, Supabase commands, migration
  apply, real feature-flag changes, secrets, retention decisions, customer communication, or external release.
- Expanding member, Kiosk, workflow, or order-data production authority.
- Destructive cleanup of the original checkout or any existing worktree.

## Must-preserve invariants

1. Current-main hard-coded sensitive-buyback feature-off, Router/repository deny boundaries, quote-only UI,
   and active-order/search behavior remain intact.
2. Settings capabilities remain server-computed and all store/tenant checks remain fail closed.
3. Client, server, mock, schemas, and shared types stay contract-compatible.
4. Kiosk production/review writes, order-data export, and order-data Apply remain default-off.
5. Workflow Apply remains locked; member/write transaction gaps are not represented as production ready.
6. No migration is rewritten, applied, or implied to be live.
7. Original dirty checkout changes and source-branch evidence remain untouched.

## Integration plan

1. Record the exact target/source refs and independent read-only task packages.
2. Replay the twelve commits in order onto the clean target branch; if `origin/main` advances, stash local
   evidence and rebase the same ordered commits onto the refreshed target before claiming latest-main.
3. For each conflict, inspect base, target, and source intent; combine compatible behavior explicitly.
4. Run overlap-focused tests for buyback, orders, inventory, API/router/schemas, mocks, tenancy, and flags.
5. Run `agents:check`, lint, typecheck, full Vitest, production build, and exact interaction E2E.
6. Run Settings/order-data and relevant buyback/order regressions plus the six-width browser matrix.
7. Inspect the final diff against both target and source, integrate independent reviews, update task memory,
   and create one scoped local integration commit if documentation/evidence changes are required.

## Rollback and stop conditions

- Before a final local commit, abort the current cherry-pick if a conflict cannot be resolved without changing
  approved product/security semantics; the untouched source branch and `origin/main` remain rollback points.
- After commits exist, rollback is a normal scoped revert on this local integration branch, never `reset --hard`.
- Stop and request a new Owner decision before any push, PR creation, database action, flag change, deployment,
  production access, customer communication, or materially different role/retention policy.
- Stop integration if current remote target changes again; fetch and reclassify before presenting the candidate.

## Acceptance

- All twelve source commits are represented on top of the exact target, with no unresolved conflicts.
- Required upstream and Settings invariants are proven by code review and targeted tests.
- Full post-integration gates pass at the exact candidate commit, or the candidate remains explicitly blocked.
- Independent architecture, security/data, and QA/release reviewers have no unresolved P0/P1 blocker.
- Final task memory records exact commit, conflict decisions, tests, visual evidence, skipped evidence, and
  remaining production NO-GO gates.
