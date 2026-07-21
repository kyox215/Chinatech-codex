# Memory Delta — TASK-20260721-001-orders-filter-removal

## Candidate project facts

- Verified task-local fact: the desktop Orders screen no longer exposes the redundant advanced-filter Sheet entry as of production commit `50a7b11988ad8e3802968e60af5a16ace9ac6ad7`.
- Consolidation decision: retain this in task and release evidence only. It is implementation state, not a durable cross-project policy; review if Orders navigation or toolbar architecture changes.

## Candidate department updates

- None. No department mission, interface, SOP, risk boundary, or handoff contract changed.

## Candidate decisions / ADRs

- None. This localized reversible UI removal does not warrant an ADR.

## Candidate lessons and capability evidence

- One successful bounded UI release is insufficient for a capability or autonomy change; no registry update proposed.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
