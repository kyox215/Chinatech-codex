# Capability Review — TASK-20260718-012

## Assessment

| Actor / capability | Evidence | Recommendation |
|---|---|---|
| Architecture/Explorer read-only reviewer | Correctly rejected the mixed root checkout, found patch-equivalent commits and isolated three semantic release units | retain current C1/C2 read-only scope |
| DATA/Security read-only reviewer | Prevented bundled Inventory V2 apply, verified exact migration/RLS/ACL boundaries and found the purge retry-baseline flaw | candidate evidence only; retain read-only permission |
| QA/Release read-only reviewer | Defined focused/full/browser/baseline/deploy gates and correctly separated eight pre-existing locator failures | candidate evidence only; retain read-only permission |
| Integration Lead release execution | Preserved dirty source state, reconciled concurrent main, selected one migration, applied/postchecked it, pushed non-force and proved exact-SHA deployment | add evidence to existing C1/restricted release capability; no upgrade |

## C0–C4 conclusion

- `CAP-TASK009-RELEASE-20260710` remains **C1 / restricted**. This is a second successful scoped release, but recovery certification, formal serialized release locking and a clean broad E2E baseline remain incomplete.
- Knowledge gained does not grant permission. Database apply, RPC grants, feature activation, purge and V1 retirement remain D4/Owner-approved actions.
- No Agent, Skill, permission or autonomy level is promoted by this task.

## Improvement proposal and evaluation case

- Add a machine-enforced release lock spanning Git, linked database and deployment state; require remote assertions immediately before and after every write.
- Make exact-migration release worktrees a checklist item whenever a full dry-run contains unrelated pending migrations.
- Repair the eight baseline E2E locators, then evaluate the next cross-domain release with: zero stale remote state, exact migration manifest, full green formal suites, exact-SHA READY deployment, rollback target and post-release observation.

## Downgrade / revoke triggers

- Force push, broad staging, `--include-all`, silent baseline-failure dismissal, unapproved flag/RPC activation, secret exposure, wrong-tenant mutation or failure to preserve the source checkout immediately invalidates this candidate evidence and requires incident review.
