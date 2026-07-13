# Memory Delta - TASK-20260713-002-order-search-grouped-results

## Verified durable rules

- Order search must visibly distinguish debounce, fetching, stale-result refresh, success, empty and error states.
- Operational order results are grouped by queue stage before date sorting; list order uses stable `created_at`, not generic `updated_at`.
- Mobile and desktop order surfaces display the same date semantics without expanding staff permissions.
- Current status time accepts only a real transition into the current status; missing legacy history falls back to intake time instead of an unrelated event.

## Status

- Verified locally by automated/browser evidence plus independent QA and UX PASS; synchronized to frontend/backend department memory and `docs/ORDERS_SPEC.md`.
- No capability or permission elevation. No ADR required because the API change is additive, dependency-free and fully reversible.
- Task-specific screenshots, exact counts and tool limitations remain in task evidence rather than long-term project memory.
