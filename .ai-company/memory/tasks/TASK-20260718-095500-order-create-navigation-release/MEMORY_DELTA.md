# Memory Delta — TASK-20260718-095500-order-create-navigation-release

## Candidate project facts

- Verified/approved: online new-order success has one canonical destination, `/orders/{id}`, for both direct page and list Dialog entry points.
- Source: `order-list-screen.tsx`, target E2E, deployment `dpl_FRW6tZNUggwmtdo7vGPLHhVD7QcT`.
- Scope/review trigger: Orders creation UI; review if successful creation destination or Dialog strategy changes.

## Candidate department updates

- Frontend: recorded the canonical success navigation and no-second-Dialog rule.
- QA: recorded the two-entry URL/root/Dialog regression matrix and separation of UI route stubs from API/data completeness gates.

## Candidate decisions / ADRs

- No ADR required: this restores a single-route UX contract without changing architecture, API or data.

## Candidate lessons and capability evidence

- Evidence: one scoped R2 frontend release completed in an isolated latest-main worktree with target E2E, full static/tests/build, exact Git SHA, Vercel READY and runtime smoke.
- Capability review: retain existing Integration Lead C2 and QA/release capability levels. One additional success is insufficient for an autonomy or permission upgrade; no `CAPABILITY_REGISTRY.md` change.

Memory consolidation result: promoted only the stable Frontend/QA conventions above. Turbopack symlink and temporary mock actor failures remain task-local environment evidence.
