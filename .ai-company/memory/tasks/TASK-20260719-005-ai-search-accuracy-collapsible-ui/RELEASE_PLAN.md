# Release Plan — TASK-20260719-005

## Release unit

- Application-only code, tests, docs, task memory and task screenshots.
- Base: `origin/main@50f843ddb2f5f734708c70144d8860e19d857dbc` after preserving the concurrent inventory vision client-stall hotfix.
- Business candidate SHA: `d9c86ac1c3a93782d33e3d22732758894eecadba`.
- Business deployment: `dpl_4k8Jt4wCwCErZqz4m4SN9rfo5xEf`, READY on both production domains.
- A documentation/memory-only closeout commit is pushed on top and verified independently; it does not alter runtime code or configuration.
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

## Verified result

- Exact business SHA, READY build log and both production aliases: passed.
- Anonymous `/orders` login redirect and AI capability 401: passed.
- Error-level runtime logs after smoke: none found.
- Authenticated paid live-model turn: not run because no existing session was available; local explicit-model browser and service paths remain the evidence.

## Stop and rollback

- Stop for any lineage mismatch, build error, cross-store/permission issue, wrong-device card, double settlement or local/manual regression.
- Roll back by promoting the previous READY deployment for `50f843dd`; no database rollback.
- Emergency AI flag shutdown remains a separate incident/Owner-controlled action and is not part of normal rollback.
