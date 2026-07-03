# Evidence Index — TASK-20260704-001-order-supplier-embed-incident

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-03T23:35:39Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-03T23:35:48Z` `b559d02651` — User screenshot showed: Could not embed because more than one relationship was found for repair_orders and suppliers.
- `2026-07-03T23:35:48Z` `c36d7dbc8c` — Production DB query verified two supplier FKs: repair_orders_supplier_id_fkey and repair_orders_parts_supplier_same_store_fkey.
- `2026-07-03T23:35:48Z` `19415fcb12` — npm run test -- src/server/repairdesk-shared.test.ts src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts passed: 3 files, 47 tests.
- `2026-07-03T23:35:48Z` `a115cbcc4d` — npm run typecheck passed.
- `2026-07-03T23:35:48Z` `526cf2fd70` — npm run lint -- src/server/repairdesk-shared.ts src/server/repairdesk-shared.test.ts passed; project script ran eslint .
- `2026-07-03T23:36:37Z` `e0bdb371be` — TASK.md closeout marks acceptance criteria complete.
- `2026-07-03T23:36:37Z` `c14909a591` — src/server/repairdesk-shared.test.ts guards against supplier:suppliers(*) returning.
