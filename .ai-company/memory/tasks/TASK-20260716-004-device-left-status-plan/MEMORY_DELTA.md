# Memory Delta

## Task-local verified facts

- The current new-order `留存` control means accessory notes, not whether the customer left the phone.
- Repair type and device custody are independent dimensions.
- Current cancellation, completion, pickup guidance, overdue classification, and unlock handling assume the shop received the device.

## Candidate project decisions after implementation

- Represent current device custody independently as nullable `with_shop / with_customer`; legacy NULL means unknown.
- Preserve initial custody in the created event and use `delivered_at` for formal return, rather than adding a duplicate `returned` enum.
- Never silently drop a business-critical custody field when the database migration is missing.
- A custody change is an online, version-locked, auditable action, not a generic offline-edit field.

## Not yet permanent

- The Owner has not authorized implementation.
- No schema, API, UI, workflow, permission, or production behavior has changed.
- These candidate decisions should be consolidated into durable project memory only after implementation and quality/release evidence succeed.

## Consolidation result

- Indexed this planning task in `MEMORY_INDEX.md`.
- Synchronized Product, Architecture, Data, Backend, Frontend, QA, and Security department memories with `proposed` status and an explicit non-implementation boundary.
- Did not promote the plan into active `PROJECT_MEMORY` rules or an approved ADR because the Owner requested planning and runtime evidence does not exist yet.
- No capability level or autonomy change was recorded; one planning success is insufficient evidence.
