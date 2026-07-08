# Evidence Index — TASK-20260709-002-imei-candidate-selection

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-08T22:31:15Z | CEO-Orchestrator |
| E-002 | test | parser preserves labeled IMEI/SN/ECID candidates and scanner candidate flow works | `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx` | passed: 3 files, 36 tests | 2026-07-08T22:40:05Z | CEO-Orchestrator |
| E-003 | test | full unit regression passes | `npm run test` | passed: 87 files, 603 tests | 2026-07-08T22:46:05Z | CEO-Orchestrator |
| E-004 | static | TypeScript and lint pass | `npm run typecheck`; `npm run lint` | passed | 2026-07-08T22:46:05Z | CEO-Orchestrator |
| E-005 | build | production build passes | `npm run build` | passed; sandbox run failed first due Turbopack port permission, escalated run passed | 2026-07-08T22:46:30Z | CEO-Orchestrator |
| E-006 | e2e | mobile fake-camera scan shows candidate before commit | `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test -c tests/e2e/imei-camera-success.playwright.config.ts tests/e2e/imei-camera-success.spec.ts --project=chromium-fake-camera-mobile` | passed | 2026-07-08T22:45:50Z | CEO-Orchestrator |
| E-007 | e2e | mobile Chromium/WebKit upload/OCR candidates work | `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test -c tests/e2e/imei-capture.playwright.config.ts tests/e2e/imei-capture-ui.spec.ts --project=chromium-mobile --project=webkit-mobile` | passed: 2 tests | 2026-07-08T22:45:20Z | CEO-Orchestrator |
| E-008 | screenshot | fake camera candidate UI visible on mobile | `screenshots/TASK-20260709-002-imei-candidate-selection/imei-new-order-fake-camera-candidates-chromium-fake-camera-mobile.png` | captured | 2026-07-08T22:45:50Z | CEO-Orchestrator |
| E-009 | screenshot | WebKit mobile upload candidate UI visible | `screenshots/TASK-20260709-002-imei-candidate-selection/imei-new-order-upload-candidates-webkit-mobile.png` | captured and visually inspected | 2026-07-08T22:45:20Z | CEO-Orchestrator |
| E-010 | screenshot | Chromium mobile upload candidate UI visible | `screenshots/TASK-20260709-002-imei-candidate-selection/imei-new-order-upload-candidates-chromium-mobile.png` | captured | 2026-07-08T22:45:20Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-08T22:48:31Z` `e0ee5b8572` — npm run typecheck; npm run lint; npm run test; npm run build; mobile fake-camera E2E; Chromium/WebKit mobile upload/OCR E2E; screenshots/TASK-20260709-002-imei-candidate-selection
