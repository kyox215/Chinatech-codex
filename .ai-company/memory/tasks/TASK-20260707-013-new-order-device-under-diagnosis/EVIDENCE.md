# Evidence Index — TASK-20260707-013-new-order-device-under-diagnosis

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:35:10Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:35:23Z` `79e5c78b49` — src/features/orders/forms/new-order-customer-device-section.tsx:78 splits Customer and Device into separately reusable sections while preserving shared compact field styling and device inputs.
- `2026-07-07T19:35:23Z` `665bf3e425` — src/features/orders/screens/new-order-screen.tsx:522 keeps NewOrderCustomerSection in the left column; src/features/orders/screens/new-order-screen.tsx:533 renders NewOrderFaultDiagnosisSection followed by NewOrderDeviceSection in the middle column.
- `2026-07-07T19:35:23Z` `0bc948d567` — Validation passed: targeted eslint for new-order screen/device files; npx vitest run src/features/orders/model/new-order-form.test.ts (1 file, 7 tests); npm run typecheck; npm run lint; npm run test (83 files, 539 tests); npm run build outside sandbox; git diff --check for scoped files.
- `2026-07-07T19:35:23Z` `888a2b63af` — Browser verification on http://localhost:3012/orders: deviceIsBelowFault true and deviceSameColumnAsFault true; after scroll, device section visible beneath fault diagnosis. Screenshots: /private/tmp/repairdesk-new-order-device-under-diagnosis-20260707.png and /private/tmp/repairdesk-new-order-device-under-diagnosis-visible-20260707.png.
