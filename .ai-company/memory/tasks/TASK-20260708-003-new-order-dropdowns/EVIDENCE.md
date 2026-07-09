# Evidence Index — TASK-20260708-003-new-order-dropdowns

| Evidence ID | Type    | Claim supported                   | Source/path/command | Result   | Collected at         | Collector        |
| ----------- | ------- | --------------------------------- | ------------------- | -------- | -------------------- | ---------------- |
| E-001       | request | task exists and title is recorded | `TASK.md`           | observed | 2026-07-07T22:31:36Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.

- `2026-07-07T22:31:48Z` `5bdfb0bcb5` — npx eslint targeted pass; npm run typecheck pass; git diff --check pass; browser verified brand/model/fault/accessory/type/status dropdowns open/select with z=90; screenshot new-order-dropdowns-fixed.png captured.
- `2026-07-08T23:40:19Z` `4a412228b3` — git status shows pre-existing kiosk/settings/API WIP before this plan; no application code edited by this turn.
- `2026-07-08T23:40:19Z` `1d20c2244a` — Inspected src/features/orders/forms/new-order-customer-device-section.tsx DenseOptionMenu lines 395-424 and src/components/orders/fault-diagnosis-picker.tsx trigger lines 522-536.
- `2026-07-08T23:40:19Z` `65a902754d` — Existing task TASK-20260708-003-new-order-dropdowns recorded prior dropdown interactivity fix and screenshot; current issue is touch scroll false-open, not menu layering.
- `2026-07-09T00:00:06Z` `ca16e90ba9` — npx eslint targeted pass for touch hook, new order fields, fault picker, and new E2E spec.
- `2026-07-09T00:00:06Z` `6efda97239` — npm run typecheck pass; npm run lint pass; npm run test pass with 88 files and 608 tests.
- `2026-07-09T00:00:06Z` `84b1f4a6bf` — npm run build initially hit known sandbox Turbopack port-binding error, then passed with elevated permissions.
- `2026-07-09T00:00:06Z` `232838050d` — REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/new-order-mobile-dropdown-scroll.spec.ts passed.
- `2026-07-09T00:00:06Z` `af1e73a334` — npx playwright test tests/e2e/visual-overflow.spec.ts passed with 6 tests.
- `2026-07-09T00:00:06Z` `d1553d7dec` — Screenshot captured at screenshots/TASK-20260708-003-new-order-dropdowns/new-order-mobile-dropdown-touch-safe.png.
