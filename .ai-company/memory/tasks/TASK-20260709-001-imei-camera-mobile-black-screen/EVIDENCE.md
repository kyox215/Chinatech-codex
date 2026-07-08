# Evidence Index — TASK-20260709-001-imei-camera-mobile-black-screen

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-08T22:04:29Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-08T22:12:18Z` `c538f4e893` — git diff --check passed; npm run lint passed; npm run typecheck passed; npx vitest run src/components/imei-scanner-field.test.tsx src/features/orders/components/order-overview-tab-imei-field.test.tsx --maxWorkers=1 --no-file-parallelism passed with 2 files / 17 tests; REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts passed with chromium-fake-camera and chromium-fake-camera-mobile; npm run build passed. Screenshots: screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-decoded-chromium-fake-camera.png and screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-decoded-chromium-fake-camera-mobile.png.
