# Memory Delta — TASK-20260717-163954-task

## Candidate project facts

- **Verified / source TASK-20260717-163954-task:** online order create is a multi-round-trip server repository flow; the router then awaits a separate audit insert before responding. Scope: current online `orders/create` path. Owner: Backend + Data. Review trigger: any create-order reliability implementation.
- **Verified / source TASK-20260717-163954-task:** both desktop and mobile share the same mutation, 30-second client timeout, disabled pending submit button, and toast-only failure feedback. Owner: Frontend + UX + QA. Review trigger: create-order UI or request lifecycle changes.

## Candidate department updates

- Backend/Data: track ambiguous-success, non-atomic write, missing idempotency, and missing phase timing as an open reliability debt.
- Frontend/QA: require explicit timeout confirmation/recovery and tests for late server success, same-key replay, double submit, and refresh recovery.

## Candidate decisions / ADRs

- **Proposed, not approved:** one store-scoped, service-role-only database function should atomically create/reuse customer, device, order, initial event, audit, and idempotency record. Use a request hash and return the original order for same-key/same-payload replay; reject same-key/different-payload.
- **Proposed, not approved:** add a non-sensitive correlation/operation ID and phase timings; do not log customer name, phone, IMEI, notes, unlock data, or secrets.

## Candidate lessons and capability evidence

- Passing normal-path tests does not cover ambiguous-success behavior; timeout-after-commit and recovery must be explicit tests.
- One API/Data sub-agent completed an evidence-backed read-only review. Two Frontend/QA sub-agent attempts failed due model capacity; this is infrastructure evidence, not a capability downgrade.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
