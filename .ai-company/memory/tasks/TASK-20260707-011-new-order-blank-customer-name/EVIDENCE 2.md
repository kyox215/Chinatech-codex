# Evidence Index — TASK-20260707-011-new-order-blank-customer-name

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:19:54Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:20:21Z` `58f81bb8e3` — src/features/orders/model/new-order-form.ts:53 adds customerNameForNewOrder/customerNameValueForCreateOrder helpers; src/features/orders/screens/new-order-screen.tsx:189 and :304 use them for customer selection, history prefill, and create payload.
- `2026-07-07T19:20:21Z` `bc77567b80` — src/features/orders/server/order.repository.ts:2661 allows creating a customer with phone and blank name; src/features/orders/testing/mock-api.ts:1525 mirrors the behavior.
- `2026-07-07T19:20:21Z` `f4a6d430f6` — Tests added in src/features/orders/model/new-order-form.test.ts:10 and src/features/orders/testing/mock-api.test.ts:602.
- `2026-07-07T19:20:21Z` `4ba9294ea4` — Validation passed: npm run lint; npm run typecheck; npm run test (83 files, 535 tests); npm run build outside sandbox after sandbox Turbopack port denial; targeted eslint and targeted vitest for order form/mock-api passed; git diff --check for touched task files passed.
- `2026-07-07T19:20:21Z` `b9b12ffb30` — Browser verification on http://localhost:3012/orders?new=1: after selecting phone 3335719865, nameValue was blank, hasGeneratedNameInNameInput false, history models visible true. Screenshot: /private/tmp/repairdesk-new-order-blank-customer-name-full-20260707.png.
