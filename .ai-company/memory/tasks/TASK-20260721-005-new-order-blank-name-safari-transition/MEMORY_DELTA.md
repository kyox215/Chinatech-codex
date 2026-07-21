# Memory Delta — TASK-20260721-005-new-order-blank-name-safari-transition

## Candidate project facts

- New-customer names are optional at intake; the atomic database create function must preserve an empty string and the order snapshot displays it as an unnamed customer.

## Candidate department updates

- FE/FLOW: after atomic creation, await store-scoped workflow/options invalidation and prefetch the created order detail before routing.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- WebKit regression should assert the flow button is enabled and its panel opens without a manual refresh.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
