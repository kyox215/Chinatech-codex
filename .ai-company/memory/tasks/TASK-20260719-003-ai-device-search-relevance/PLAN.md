# Phase Plan and Change Contract

1. Baseline: trace tool arguments, search semantics and privacy-safe evidence; freeze the screenshot as regression input.
2. Domain contract: add pure device-query parsing/normalization and label matching.
3. Integration: add `device_search` to strict AI schema, deterministic router, provider guidance, service and order repository/mock filters.
4. Verification: focused unit/integration tests, exact mobile E2E, lint/typecheck/full test/build, security and diff review.
5. Closeout: local candidate and visual evidence; no production push/deploy without D4 approval.

## Change budget

- Allowed: `src/entities/order/*`, AI order-query contract/router/provider/service/tests, order list type/schema/repository/mock/tests, targeted E2E, this task folder and task screenshot.
- Forbidden: database/migration, dependencies, secrets/env, unrelated UI, customer/order data mutation, production release.

## Evidence mapping

- Intent fidelity: pure parser + router/provider tests.
- Search relevance: repository/mock tests with Samsung phone/IMEI false-positive trap.
- No paid call: service test verifies deterministic route and provider/quota not called.
- UX: 390px E2E exact phrase and result-card device assertions.
- Security: static call-chain review, tenant/permission regression, secret/diff scan.
