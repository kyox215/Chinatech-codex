# ADR — Evidence-qualified Order Query V2

- **Status:** Accepted for implementation; production inline-write activation deferred.
- **Decision:** Use a strict structured query plan, independent server reconciliation, store-owned
  calendar resolution, evidence-qualified filter chips, and server-generated action candidates.
- **Not chosen:** prompt-only accuracy fixes; treating quote lines as completed repairs; treating
  received-stock allocation as purchase ordering; model-triggered writes; existing batch or generic
  patch endpoints.
- **Consequence:** phase 1 accurately covers device/date/workflow/payment and honestly supports
  quote-service/order-level-parts evidence. Exact performed-service and purchase-requisition
  semantics require later additive data models and a separate migration approval.
- **Review trigger:** a service-execution/parts-requisition model is approved, or per-store order
  volume makes the current in-memory list filter unsuitable.
