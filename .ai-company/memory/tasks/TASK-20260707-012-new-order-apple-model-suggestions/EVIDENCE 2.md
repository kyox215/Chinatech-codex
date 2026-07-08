# Evidence Index — TASK-20260707-012-new-order-apple-model-suggestions

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:28:07Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:28:20Z` `69ab65973e` — src/features/orders/model/new-order-form.ts:103 adds 52 Apple iPhone model suggestions from current iPhone 17e/Air/17 family through legacy iPhone models, plus brand-scoped helper functions.
- `2026-07-07T19:28:20Z` `a5808227be` — src/features/orders/forms/new-order-customer-device-section.tsx:56,122,177 wires a model datalist into the device information section and auto-normalizes the brand to Apple when an Apple model suggestion is selected.
- `2026-07-07T19:28:20Z` `f897277685` — src/features/orders/model/new-order-form.test.ts:62 adds tests for current/legacy Apple suggestions, blank/Apple/苹果 brand behavior, non-Apple suppression, and case-insensitive model recognition.
- `2026-07-07T19:28:20Z` `c44c9f1584` — Validation passed: targeted eslint for touched files; npx vitest run src/features/orders/model/new-order-form.test.ts (1 file, 7 tests); npm run typecheck; npm run lint; npm run test (83 files, 539 tests); npm run build outside sandbox; git diff --check for scoped files.
- `2026-07-07T19:28:20Z` `c177256dd8` — Browser verification on http://localhost:3012/orders: new order dialog exposed model datalist repair-device-model-suggestions with 52 options, including iPhone 17e, iPhone Air, iPhone 17 Pro Max, iPhone 8, and iPhone (1st generation); filling iPhone 17 Pro Max set brandValue Apple and modelValue iPhone 17 Pro Max. Screenshot: /private/tmp/repairdesk-new-order-apple-model-options-20260707.png.
