# Release Plan — TASK-20260719-005

## Release unit

- Application-only code, tests, docs, task memory and task screenshots.
- Base: `origin/main@50f843ddb2f5f734708c70144d8860e19d857dbc` after preserving the concurrent inventory vision client-stall hotfix.
- Candidate SHA: pending scoped commit.
- No database, data, dependency, environment or secret changes.

## Pre-release gates

- Acquire and recheck the project integration lease.
- Fetch `origin/main`, require candidate parent/lineage to remain exact and fast-forwardable.
- Review staged names and staged diff; repeat secret and forbidden-scope checks.
- Commit only the approved release unit and push non-force to `origin/main`.

## Deployment verification

- Wait for the Vercel Git deployment whose `gitSource.sha` equals the candidate commit.
- Require READY, inspect build/runtime errors, and explicitly promote the exact deployment if the production alias is not already attached.
- Verify `www.chinatech.in` and `chinatech.in` resolve to the same deployment/SHA.
- Perform anonymous route/API safety smoke. Use an existing ChinaTech pilot session for a single live model query only if available without changing allowlist, budget or credentials; otherwise mark that authenticated model smoke conditional.

## Stop and rollback

- Stop for any lineage mismatch, build error, cross-store/permission issue, wrong-device card, double settlement or local/manual regression.
- Roll back by promoting the previous READY deployment for `50f843dd`; no database rollback.
- Emergency AI flag shutdown remains a separate incident/Owner-controlled action and is not part of normal rollback.
