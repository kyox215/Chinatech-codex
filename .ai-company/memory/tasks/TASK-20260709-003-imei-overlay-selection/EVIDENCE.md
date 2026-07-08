# Evidence Index — TASK-20260709-003-imei-overlay-selection

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-08T23:01:08Z | CEO-Orchestrator |
| E-002 | code | overlay candidate boxes and frozen preview implemented | `src/components/imei-scanner-field.tsx` | implemented | 2026-07-08T23:12:58Z | CEO-Orchestrator |
| E-003 | test | component behavior for camera frame boxes, upload preview, OCR/ZXing fallbacks | `npm run test -- src/components/imei-scanner-field.test.tsx` | 17 passed | 2026-07-08T23:11:19Z | CEO-Orchestrator |
| E-004 | static | TypeScript contract valid | `npm run typecheck` | passed | 2026-07-08T23:11:19Z | CEO-Orchestrator |
| E-005 | static | lint rules valid | `npm run lint` | passed | 2026-07-08T23:11:19Z | CEO-Orchestrator |
| E-006 | e2e | camera fallback, upload overlay candidates, mobile Chrome/Safari/WebKit layouts | `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-capture-ui.spec.ts --config=tests/e2e/imei-capture.playwright.config.ts` | 6 passed | 2026-07-08T23:11:59Z | CEO-Orchestrator |
| E-007 | e2e | fake camera stream decodes and commits IMEI on desktop/mobile Chromium | `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-camera-success.spec.ts --config=tests/e2e/imei-camera-success.playwright.config.ts` | 2 passed | 2026-07-08T23:12:10Z | CEO-Orchestrator |
| E-008 | regression | full unit regression | `npm run test` | 87 files, 603 tests passed | 2026-07-08T23:12:16Z | CEO-Orchestrator |
| E-009 | build | production build | `npm run build` | passed with escalated permissions due Turbopack local port binding | 2026-07-08T23:12:16Z | CEO-Orchestrator |
| E-010 | screenshot | mobile high-density candidate layout visible | `screenshots/TASK-20260709-003-imei-overlay-selection/imei-new-order-upload-candidates-mobile-safari.png` | verified | 2026-07-08T23:12:58Z | CEO-Orchestrator |
| E-011 | screenshot | mobile camera unsupported fallback no longer wastes video space | `screenshots/TASK-20260709-003-imei-overlay-selection/imei-new-order-camera-fallback-mobile-safari.png` | verified | 2026-07-08T23:12:58Z | CEO-Orchestrator |
| E-012 | screenshot | fake camera mobile candidate and decoded states captured | `screenshots/TASK-20260709-003-imei-overlay-selection/imei-new-order-fake-camera-candidates-chromium-fake-camera-mobile.png`; `screenshots/TASK-20260709-003-imei-overlay-selection/imei-new-order-fake-camera-decoded-chromium-fake-camera-mobile.png` | verified | 2026-07-08T23:12:58Z | CEO-Orchestrator |
| E-013 | tooling | `tools/ai_company.py checkpoint` unavailable under system Python 3.9 because `tomllib` requires Python 3.11+ | `python3 tools/ai_company.py checkpoint --help`; `python3 --version` | blocked, manual structured checkpoint used | 2026-07-08T23:12:58Z | CEO-Orchestrator |

## Quality Gate

Conclusion: PASS.

Test matrix:

- Barcode position overlay: covered by component test and Playwright upload overlay mock.
- ZXing/OCR/no-position fallback: covered by component tests and WebKit/mobile Safari Playwright projects.
- Fixed bottom actions and mobile density: covered by screenshots under `screenshots/TASK-20260709-003-imei-overlay-selection/`.
- Real browser camera stream regression: covered by fake-camera desktop and mobile Chromium E2E.
- Whole-app regression: covered by `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

Residual risk:

- Real iOS camera hardware can still differ from Playwright/mobile emulation; current code minimizes restart loops and keeps upload/manual fallback available.

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
