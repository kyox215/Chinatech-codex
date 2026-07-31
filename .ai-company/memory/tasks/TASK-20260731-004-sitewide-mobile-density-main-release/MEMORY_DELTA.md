# Memory Delta — TASK-20260731-004-sitewide-mobile-density-main-release

## Candidate project facts

- Release candidate combines sitewide mobile density with `main@a9e6db44`; no schema, API, dependency, environment, permission or domain change. Status: scoped verified; owner: Integration Lead; review trigger: any remote-main drift before push.

## Candidate department updates

- Operations: when main is second parent of the feature-side merge commit, revert the release with `git revert -m 2 <merge_sha>`. Status: release-specific; owner: Integration Lead; review trigger: rollback or different merge topology.

## Candidate decisions / ADRs

- Independent Release and QA reviewers found no Must-fix after requiring exact-SHA gates and production smoke. Status: conditional until deploy; owner: Integration Lead; review trigger: gate/deploy failure.

## Candidate lessons and capability evidence

- None yet.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
