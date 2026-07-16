# Implementation Plan — Dashboard Handoff Priority

## Change contract

| Surface | Approved change | Compatibility boundary |
|---|---|---|
| Dashboard API | Add `dashboard/priority-summary`, returning an allowlisted priority summary ranked from all authorized active orders | Keep legacy `dashboard/summary` unchanged for the rolling-client compatibility window; no database change |
| Priority model | Pure deterministic classification, copy, counts, and slice-after-sort | Reuse canonical workflow/task guidance and repository-projected order rows |
| Dashboard UI | Remove header rail and duplicate summaries; show quick entries plus priority cards and business links | Shared scaffold and task/detail screens remain unchanged |
| Cache | Dashboard summary patches or invalidates safely after order mutations | Preserve queue/detail cache behavior |
| Docs/tests | Update Dashboard declaration and focused/full gates | No unrelated documentation rewrite |

## Sequence

1. Add failing priority-model and API-contract tests.
2. Implement priority types/model and actor-scoped server summary.
3. Update client/cache contract and tests.
4. Implement responsive handoff workspace and complete state matrix.
5. Update Playwright assertions and UI declaration.
6. Run focused then full gates, capture visual evidence, and perform read-only independent review.
7. Checkpoint memory, commit scoped files, push HEAD to `main`, and verify remote SHA.

## Rollback

Revert the single task commit. No schema, data, permission, secret, dependency, or deployed environment changes are included.
