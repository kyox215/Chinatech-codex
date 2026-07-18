# Release Plan — Phase 3A Dormant Slice

## Release unit

Deterministic zero-model routing, cost/runtime policy, durable quota interface/migration file, tests and docs. No live provider dependency, external call, production migration apply, public assistant or formal business write.

## Mandatory production state

- Every existing AI feature flag absent or `0`.
- `AI_ASSISTANT_PROVIDER=fake` or absent.
- No `OPENAI_API_KEY`, model, approved budget, external-data approval or durable quota activation in Vercel production.
- New quota/cost variables absent/zero must fail closed.
- The migration may be present in Git but must remain unapplied; production must contain zero enabled AI usage policy rows because no Phase 3A DB object is authorized yet.

## Gates

- Full static/test/build and fake E2E green.
- Migration file static/schema-clone review green; linked apply explicitly not run.
- P0/P1 security/data/QA findings reconciled for dormant slice.
- `git diff --check`, scope inventory, secret/identifier scan and generated-file hygiene.
- Exact Git/deployment identity, anonymous smoke, error observation and READY rollback target.

## Rollback

1. Keep/set `AI_ASSISTANT_ENABLED=0`.
2. Roll Vercel back to prior READY deployment if any non-AI regression appears.
3. Revert the Phase 3A scope-only commit if needed.
4. Do not drop additive quota tables in an emergency; this release does not apply them.
5. If a secret exposure is suspected, rotate at provider; no secret should be part of this release.
