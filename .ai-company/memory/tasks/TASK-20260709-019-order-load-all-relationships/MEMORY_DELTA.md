# Memory Delta — TASK-20260709-019-order-load-all-relationships

## Candidate project facts

- For `repair_orders` embeds, use same-store explicit relationships:
  - `customer:customers!repair_orders_customer_same_store_fkey(...)`
  - `device:devices!repair_orders_device_same_store_fkey(...)`
  - `supplier:suppliers!repair_orders_supplier_same_store_fkey(...)`
  - `parts_supplier:suppliers!repair_orders_parts_supplier_same_store_fkey(...)`

## Candidate department updates

- API/DATA: multi-store same-store FKs intentionally create multiple PostgREST relationships. Any `repair_orders` nested select must be explicit, or production can fail with `PGRST201`.

## Candidate decisions / ADRs

- Prefer same-store FKs over legacy single-column FKs for order embeds to preserve tenant isolation.

## Candidate lessons and capability evidence

- Lesson: after fixing one PostgREST relationship ambiguity, query production constraints for all embeds in the same select before declaring the incident resolved.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
