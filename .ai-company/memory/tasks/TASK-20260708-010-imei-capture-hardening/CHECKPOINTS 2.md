# Checkpoints

## 2026-07-08T17:32:56Z - Intake and Subagent Spawn

Status: active

Completed:

- Created task goal through Codex goal tool.
- Classified task as T2/R2/L2 because it touches order UI, browser camera APIs, image input, OCR/text parsing, and device identifiers.
- Spawned four read-only sub-agents:
  - Kepler: ARCH/DATA
  - Aster: UX
  - Aegis: SEC
  - Verity: QA

Current facts:

- Existing IMEI scanner auto-commits the first camera result and lacks multi-candidate selection.
- Existing order detail has a `TextDetector`-based OCR attempt, but current package dependencies do not include a formal OCR library.
- Worktree is dirty with many unrelated changes; implementation must stay scoped.

Next:

- Implement first verifiable slice: IMEI candidate parsing and tests.
- Then harden camera/image capture UI and integrate reviewed sub-agent findings.

## 2026-07-08T17:46:38Z - Implementation Verified

Status: active

Completed:

- Added shared candidate extraction, Luhn validation, suspect IMEI classification, serial extraction, and preferred-candidate selection.
- Added parser tests covering multi-IMEI labels, pure digit OCR text, invalid IMEI check digit, labeled serials, generic barcode serials, and preference ordering.
- Hardened `ImeiScannerField`:
  - inline camera unsupported/permission/device error states;
  - rear-camera preference using media constraints;
  - image upload with JPG/PNG/WebP and 8 MB limit;
  - image barcode decoding via existing `@zxing/browser`;
  - local `TextDetector` OCR fallback when browser supports it;
  - multi-candidate selection and manual fallback;
  - toast no longer includes full IMEI.
- Updated order detail OCR flow to use the shared parser, candidate selection, image file limits, no raw OCR text display, and cancel availability during OCR.
- Closed all four read-only sub-agents after integrating their conclusions.

Verification:

- Targeted parser test passed: 1 file / 15 tests.
- Targeted lint passed.
- `npm run typecheck` passed.
- Full `npm run test` passed: 85 files / 559 tests.
- Full `npm run lint` passed.
- `npm run build` passed after escalated rerun; sandbox failure was Turbopack port binding.
- Full `npm run check` passed after escalation.
- `git diff --check` passed for scoped files.

Visual evidence:

- Screenshot saved at `screenshots/TASK-20260708-010-imei-capture-hardening/orders-new-mobile.png`.
- Screenshot is login redirect, not the IMEI UI, because local route requires authentication.

Residual risks:

- Real-device Chrome/Safari camera behavior still requires manual authenticated browser/device testing.
- OCR remains limited to browser-native `TextDetector`; no Tesseract.js or external OCR dependency was added.
- Server-side `device_imei` schema remains broad; SEC flagged this as a follow-up if stricter persistence validation is desired.
- At that checkpoint, `ACTIVE_CONTEXT.md` pointed to a later employee-management task checkpoint; this IMEI checkpoint was kept task-local to avoid overwriting another active handoff.

Next:

- Owner/tester should log into local or preview environment and manually verify camera permission, upload image, OCR, and multi-candidate selection on Chrome/Safari mobile and desktop.

## 2026-07-08T18:00:51Z - Component Tests and Final Local Gate

Status: active

Completed:

- Added `src/components/imei-scanner-field.test.tsx` to cover:
  - unsupported camera kept inline with manual fallback;
  - multi-IMEI camera payload requires user selection before commit;
  - invalid uploaded file type stays in dialog with a clear error;
  - uploaded image barcode with multiple IMEI candidates remains selectable after processing finishes;
  - scanner controls are stopped when the dialog closes.
- Fixed an image-upload edge case where successful image barcode decoding with multiple candidates could leave the dialog in a processing state.
- Re-ran local gates after the final fix.

Verification:

- Component test passed: 1 file / 5 tests.
- Parser + component tests passed: 2 files / 20 tests.
- Scoped eslint passed for IMEI component, new test, parser, parser test, and order detail screen.
- `git diff --check` passed for scoped task files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run agents:check` passed.
- `npm run test` passed: 86 files / 564 tests.
- `npm run build` passed outside sandbox; sandbox build fails with known Turbopack port-binding `Operation not permitted`.

Residual risks:

- Real-device Chrome/Safari camera permission and rear-camera behavior still need authenticated manual testing on phone and desktop.
- Browser-native OCR availability varies; no OCR dependency was added.
- Authenticated visual evidence of the IMEI UI is still pending because local `/orders/new` redirected to login.
- At that checkpoint, `ACTIVE_CONTEXT.md` still pointed to the separate employee-management task, so this task remained checkpointed locally to avoid overwriting another active handoff.

Next:

- Manually test the IMEI capture dialog in an authenticated session on mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari.
- Verify camera permission denied, no-camera/unsupported, image upload, multi-candidate choice, pure digit OCR/text, and manual fallback.

## 2026-07-08T18:08:37Z - Browser E2E Evidence Added

Status: active

Completed:

- Added `tests/e2e/imei-capture-ui.spec.ts`, gated by `REPAIRDESK_E2E_ORDER_AUDIT=1`.
- Started a local `next start` preview on port 3022 with E2E auth bypass after confirming the existing 3012 dev server was unrelated and left untouched.
- Verified the new-order IMEI capture dialog in Chromium through Playwright:
  - route bypass did not redirect to login;
  - new order dialog opened;
  - IMEI capture dialog opened from the device section;
  - no-camera/browser-unsupported state stayed inline with upload/manual fallback;
  - uploaded image path used browser-level OCR mock and produced two valid IMEI candidates;
  - selecting the second candidate filled the new-order IMEI field.
- Saved visual evidence:
  - `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-desktop.png`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-desktop.png`

Verification:

- `npx eslint tests/e2e/imei-capture-ui.spec.ts` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- Parser + component tests passed: 2 files / 20 tests.
- Full `npm run test` passed: 86 files / 564 tests.
- Playwright IMEI E2E passed: 1 Chromium test.
- `git diff --check` passed for scoped files.

Residual risks:

- Real physical camera startup, rear-camera selection, and Safari behavior still require device/manual verification; Chromium E2E uses mocked camera-unavailable and mocked browser OCR because CI/headless cannot exercise real phone cameras or Safari permissions.
- Browser-native OCR support varies by browser; current implementation degrades to barcode/photo/manual paths without adding a new OCR dependency.
- The E2E preview used synthetic IMEI values only; no production/customer identifiers or secrets were captured.

Next:

- Test on real mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari with an authenticated account or safe preview session.
- Record pass/fail for camera allowed, camera denied, no-camera, image upload, multiple candidates, pure numeric OCR/text, and manual fallback.

## 2026-07-08T18:10:59Z - Final Context Audit for This Stage

Status: active

Completed:

- Rechecked `.ai-company/memory/ACTIVE_CONTEXT.md`; it is currently idle, so earlier notes about employee-management active-context contention were historical and were clarified in this task handoff/checkpoints.
- Confirmed scoped dirty files remain limited to IMEI implementation, parser/tests, browser E2E, task memory, and task screenshots.
- Confirmed this stage has browser E2E evidence, but not physical Chrome/Safari camera evidence.

Verification:

- `git diff --check` passed for scoped code, E2E, and task-memory files before this checkpoint.
- Final post-checkpoint diff check is required before closeout because this checkpoint itself changes task memory.

Next:

- Run a final scoped `git diff --check`.
- Stop the task-owned 3022 `next start` preview service.
- Keep the Codex goal active until real-device Chrome/Safari camera verification is complete.

## 2026-07-08T18:28:17Z - Automated Browser Matrix Verified

Status: active

Completed:

- Resumed the active Codex goal for IMEI capture hardening and spawned three follow-up read-only subagents:
  - Kepler / solution_architect / `019f42f4-9e3c-7a30-816b-19ec95b567c8`
  - Sentinel / security_reviewer / `019f42f4-bd6f-75a3-af9a-40caeaeb8ccd`
  - Probe / qa_reviewer / `019f42f4-db8e-71f2-9ce3-8eca105ec6cb`
- Fixed a parser issue discovered during expanded E2E: adjacent plain numeric OCR chunks now extract multiple 15-digit IMEI candidates instead of only the second value.
- Fixed `ImeiScannerField` camera startup cleanup race: delayed `decodeFromConstraints` controls are stopped if the dialog closes before startup completes or if a scan completes before controls are assigned.
- Sanitized unknown IMEI camera/image/OCR/save errors so raw browser/library/server messages are not displayed.
- Aligned order-detail OCR file accept with its JPG/PNG/WebP validator.
- Added component coverage for:
  - uploaded image barcode decode failure falling back to browser-native `TextDetector`;
  - delayed camera controls being stopped after dialog close.
- Installed the missing Playwright WebKit browser through `npx playwright install webkit` after the first WebKit run reported a missing executable.
- Ran and passed Chromium/WebKit E2E on desktop and mobile viewports for the new-order IMEI capture dialog.
- Stopped the task-owned 3022 `next start` preview service after E2E.

Verification:

- Targeted parser + component tests passed: 2 files / 23 tests.
- Scoped eslint passed for IMEI component, parser, order-detail integration, and IMEI E2E files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 86 files / 567 tests.
- `npm run build` passed in approved non-sandbox execution.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list` passed: 4 tests across Chromium/WebKit desktop/mobile.
- Final scoped `git diff --check` passed before this checkpoint.

Visual evidence:

- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-chromium-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-webkit-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-webkit-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-chromium-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-webkit-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-webkit-mobile.png`

Open risks:

- Real physical camera startup, camera permission prompts, rear-camera selection, and real Mobile Safari capture behavior still require manual device verification.
- Safari pure numeric photo OCR remains conditional because the app uses browser-native `TextDetector` when available and otherwise falls back to barcode/photo/manual entry; no OCR dependency was added.

## 2026-07-08T20:50:04Z - Detail Persistence and Security Gate Verified

Status: active / real-device-qa-ready

Completed:

- Spawned and closed three read-only subagents for this stage:
  - Atlas / project explorer / `019f436e-e280-79d0-98f4-447d197b4cb8`
  - Gauge / QA reviewer / `019f436e-e365-7ec2-b589-f8f53b8c608f`
  - Sentinel / security reviewer / `019f436e-e3eb-7a53-a17c-a96580752ac9`
- Added route-level order-detail E2E:
  - opens `/orders/ord_1` in E2E mock mode;
  - opens the read-mode IMEI popover in the device panel;
  - exercises camera-unavailable fallback and manual entry;
  - saves through `/api/repairdesk/order/patch`;
  - reloads the page and verifies the IMEI is still visible from detail data.
- Updated IMEI Playwright configs to use `next dev` plus `localhost` for E2E auth-bypass mode. `next start` runs production mode and correctly rejects mock bypass when Supabase browser auth is absent.
- Addressed the security review blockers:
  - `orders/create`, `order/update`, and `order/patch` now call the existing permission matrix before writes.
  - Inline patch permission mapping separates intake fields from repair fields.
  - Viewer create/update/patch writes are denied in router tests.
  - `createOrderSchema`, `updateOrderInputSchema`, and patch schema now share the same nonblank identifier constraints for non-empty IMEI / serial values while still allowing blank create/full-edit values.
- Added a 5s timeout to the mobile order-detail OCR path so image decode or browser-native `TextDetector.detect()` cannot leave the sheet stuck in recognition state.
- Stopped the old non-E2E `next dev` process on port 3012 to run E2E, then stopped the earlier task-owned `next start` process on port 3023 after verification.

Verification:

- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts src/server/api/repairdesk-router.test.ts src/server/permissions.test.ts --reporter=verbose`: 7 files / 106 tests passed.
- Scoped eslint over IMEI component/parser/order detail/order overview/mock API/router/schema/E2E files passed.
- `npm run typecheck`: passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3025 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed across Chromium/WebKit desktop/mobile projects and Pixel/iPhone descriptors.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3026 npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --reporter=list`: 1 Chromium fake-camera stream test passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3027 npx playwright test imei-order-detail-save.spec.ts --config tests/e2e/imei-order-detail.playwright.config.ts --reporter=list`: 1 detail save-refresh test passed.
- `npm run build`: passed in approved non-sandbox execution. Sandbox build still fails with the known Turbopack process/port-binding restriction.
- `git diff --check`: passed.

Visual evidence:

- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-order-detail-save-refresh-desktop.png`
- Existing new-order fallback, upload-candidate, and fake-camera screenshots remain in the same screenshot directory.

Residual risks:

- Real physical camera permission prompts, rear-camera hardware selection, mobile OS gallery behavior, and real iPhone HEIC/HEIF decode still require manual device verification.
- Safari pure numeric photo OCR remains conditional on browser-native `TextDetector`; no OCR dependency or cloud OCR service was added.
- Offline drafts intentionally retain IMEI/order context for offline preservation; this still needs a privacy/retention policy decision or a later encrypted/excluded-draft design.

Next:

- Follow `REAL_DEVICE_QA.md` on real mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari.
- Do not mark the Codex goal complete until real-device evidence is captured or the owner explicitly accepts the residual hardware/browser evidence gap.

## 2026-07-08T21:00:00Z - Real-Device QA Fixtures Prepared

Status: active / real-device-qa-prep

Completed:

- Added `scripts/generate-imei-real-device-fixtures.ts`.
- Generated real-device QA assets:
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-camera-qr.svg`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-multi-candidate-label.svg`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-multi-candidate-label.png`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-ocr-text-label.svg`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-ocr-text-label.png`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-real-device-labels.html`
- Updated `REAL_DEVICE_QA.md` with:
  - fixture generation command;
  - LAN IP lookup;
  - HTTPS local preview command;
  - mkcert/self-signed certificate caveats;
  - warning not to stop another task's Next dev server blindly.
- Visually inspected the generated multi-candidate label and confirmed the QR code and OCR text are readable at useful size.

Verification:

- `npx tsx scripts/generate-imei-real-device-fixtures.ts` passed in approved non-sandbox execution. Sandbox run failed with `tsx` IPC pipe `EPERM`.
- `npx eslint scripts/generate-imei-real-device-fixtures.ts` passed.
- `npm run typecheck` passed after adding the generator.

Environment note:

- A short attempt to start `REPAIRDESK_E2E_ORDER_AUDIT=1 npx next dev --experimental-https -p 3028 --hostname 0.0.0.0` found two environment blockers: mkcert certificate generation failed, and Next reported another repo dev server already active on port 3016. The active 3016 preview was not stopped because it belongs to another task context.

Next:

- When the owner is ready for real-device testing, either stop/reuse the existing dev preview deliberately or start a trusted HTTPS preview. Then run the matrix in `REAL_DEVICE_QA.md` using the generated label assets.
- Keep the goal active until real-device Chrome/Safari evidence is captured or formally risk-accepted.

## 2026-07-08T21:01:02Z - Real QR Upload E2E Verified

Status: active / real-device-qa-prep

Completed:

- Added `tests/e2e/imei-upload-real-qr.spec.ts`.
- The new test generates an actual PNG QR label in Node using `qrcode.react` and `sharp`, disables camera to force the upload fallback, uploads the image through the IMEI dialog, and verifies `@zxing/browser` decodes `356938035643809` without any `TextDetector` OCR mock.
- Stopped an existing non-E2E Next dev server on port 3016 after approval so Playwright could start the dedicated IMEI mock server.

Verification:

- `npx eslint tests/e2e/imei-upload-real-qr.spec.ts`: passed.
- `npm run typecheck`: passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3029 npx playwright test imei-upload-real-qr.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed across Chromium/WebKit desktop/mobile projects and Pixel/iPhone descriptors.
- Scoped eslint over the new E2E, IMEI Playwright config, and real-device fixture generator passed.
- Final `git diff --check`: passed.

Visual evidence:

- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-chromium-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-webkit.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-webkit-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-mobile-chrome.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-mobile-safari.png`

Residual risks:

- This proves uploaded QR label image decoding in browser engines, but not physical phone camera permission prompts, rear lens selection, or mobile OS gallery HEIC behavior.

Next:

- Continue with real-device HTTPS camera/gallery matrix from `REAL_DEVICE_QA.md`.
- Order-detail IMEI entry is integrated and partially covered through shared component/parser tests, but a dedicated order-detail E2E remains a follow-up.
- `.ai-company/memory/ACTIVE_CONTEXT.md` currently points to another account-menu task; this checkpoint remains task-local to avoid overwriting an unrelated active context.

Next:

- On an authenticated safe local/preview session, manually verify mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari:
  - camera allowed;
  - camera denied;
  - no camera/unsupported browser fallback;
  - rear-camera behavior on mobile;
  - image upload for JPG/PNG/WebP;
  - multi-IMEI candidate selection;
  - pure numeric OCR where browser supports `TextDetector`;
  - manual fallback and save on new/edit/detail order entry points.

## 2026-07-08T18:58:03Z - iPhone Gallery and Device Matrix Expanded

Status: active

Completed:

- Added HEIC/HEIF file selection support for IMEI image upload in `ImeiScannerField`.
- Added HEIC/HEIF file selection support for the order-detail mobile OCR entry point.
- Added component coverage for iPhone-style `.heic` gallery files with empty MIME type when the browser can decode the image.
- Expanded `tests/e2e/imei-capture.playwright.config.ts` from two browser projects to six:
  - `chromium`
  - `chromium-mobile`
  - `webkit`
  - `webkit-mobile`
  - `mobile-chrome` using Playwright Pixel 7 device descriptor
  - `mobile-safari` using Playwright iPhone 15 device descriptor
- Adjusted `tests/e2e/imei-capture-ui.spec.ts` so project device settings are not overwritten by test-level viewport calls.
- Re-ran the IMEI E2E suite and generated mobile Chrome / mobile Safari screenshot evidence.
- Stopped the task-owned 3022 `next start` preview service after E2E.

Verification:

- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts --reporter=verbose`: 2 files / 24 tests passed.
- Scoped eslint passed for IMEI component, component test, order-detail integration, and IMEI E2E files.
- `npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --list`: 6 tests in 1 file.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 86 files / 568 tests.
- `npm run build` passed in approved non-sandbox execution.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed.
- Final scoped `git diff --check` passed before this checkpoint.

Visual evidence added:

- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-mobile-chrome.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-mobile-safari.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-mobile-chrome.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-mobile-safari.png`

Open risks:

- HEIC/HEIF files are now selectable, but actual recognition still depends on whether the target browser can decode the image and whether barcode/OCR can read the label. Unsupported decode paths show a safe generic failure and preserve manual fallback.
- Playwright mobile device descriptors improve coverage but still do not prove physical camera permission prompts, rear-camera hardware selection, or real iPhone camera/gallery behavior.
- The goal remains active until real-device Chrome/Safari camera verification is performed.

Next:

- Perform manual authenticated testing on physical mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari:
  - allow camera;
  - deny camera;
  - rear-camera selection;
  - iPhone HEIC/HEIF gallery photo;
  - JPG/PNG/WebP photo;
  - multi-IMEI candidate selection;
  - pure numeric OCR where available;
  - manual fallback and save on new/edit/detail order flows.

## 2026-07-08T19:38:49Z - Data Safety and Browser Matrix Hardened

Status: active

Completed:

- Spawned three real read-only review agents for the current execution batch:
  - Gauge / QA / `019f4325-3294-71d2-a6fe-d295724935cb`
  - Cipher / SEC / `019f4325-5d63-7001-b39a-d17f48a84f27`
  - Index / DATA / `019f4325-8e28-7e90-a1ac-6852ab4b1f19`
- Added a focused order-detail `ImeiField` component test for uploaded-image multi-candidate selection reaching quick save.
- Rejected blank `device_imei` inline patches in UI mutation, API schema, real repository, and mock API.
- Added data invariant tests proving IMEI-only patch preserves customer linkage, device linkage, unlock PIN/password metadata, contact data, notes, warranty, fault prices, and finance fields.
- Changed mobile order-detail IMEI sheet save errors to use IMEI-specific sanitized messages.
- Added uploaded-image barcode/OCR timeout protection so Chromium cannot stay stuck on image recognition; barcode timeout falls back to OCR.
- Removed the unstable order-detail E2E attempt that depended on unavailable pending-store context; current detail behavior is covered by component + mock/API invariant tests instead.
- Re-ran the final 6-project IMEI Playwright matrix successfully after the Chromium image-recognition timeout fix.
- Stopped the task-owned local 3022 preview process.

Verification:

- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 78 tests passed.
- Scoped eslint for all IMEI/parser/order-detail/schema/mock/e2e touched files passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` default high-parallel mode failed because existing `order-option-pickers.test.tsx` timed out at 5000ms; the same file passed independently.
- `npx vitest run src/features/orders/components/order-option-pickers.test.tsx --reporter=verbose`: 1 file / 5 tests passed.
- `npx vitest run --maxWorkers=1 --no-file-parallelism`: 87 files / 572 tests passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed.
- `npm run build` passed in approved non-sandbox execution.
- Final scoped `git diff --check` passed.

Open risks:

- Real physical camera startup, permission prompts, rear-camera hardware selection, and real iPhone Safari gallery/camera behavior remain manual verification gaps.
- Same-store role authorization for `order/update` and `order/patch` remains a broader server permission task. This IMEI task did not modify the permission model.
- Browser IndexedDB offline drafts still persist normalized IMEI with order context to preserve offline order data; this requires explicit privacy/retention acceptance or a future encrypted/excluded-draft design.
- Dedicated order-detail E2E is still blocked by safe active-store context setup; current evidence is component and mock/API invariant coverage.

Next:

- Manual real-device verification on mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari.
- Separate permission hardening task for order patch/update role checks if owner approves security scope expansion.
- Separate offline privacy decision for IMEI retention in local IndexedDB drafts.

## 2026-07-08T19:47:28Z - Camera Error and Image Timeout Regression Coverage

Status: active

Completed:

- Added regression coverage for recoverable camera startup errors across `NotAllowedError`, `NotFoundError`, `NotReadableError`, and `OverconstrainedError`.
- Added regression coverage for insecure-context / generic `TypeError` camera rejection so the IMEI scanner shows safe recovery copy instead of raw browser errors.
- Added regression coverage proving uploaded-image barcode decoding timeout falls back to local `TextDetector` OCR candidates instead of leaving the dialog stuck.
- Re-ran focused IMEI validation after the test hardening.

Verification:

- `npx prettier --write src/components/imei-scanner-field.test.tsx`: unchanged.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 84 tests passed.
- Scoped eslint for all IMEI/parser/order-detail/schema/mock/e2e touched files passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.

Decision:

- `.ai-company/memory/ACTIVE_CONTEXT.md` was not overwritten because it currently belongs to `TASK-20260708-012-account-menu-email-logout`; this IMEI checkpoint remains task-local to avoid corrupting an unrelated active task context.

Open risks:

- Real physical camera startup, permission prompts, rear-camera hardware selection, and real iPhone Safari gallery/camera behavior still require manual device verification.
- Safari pure numeric photo OCR remains conditional on browser-native `TextDetector`; no OCR dependency/service was added in this slice.
- The goal remains active until real-device Chrome/Safari camera verification is performed.

Next:

- Manual authenticated verification on physical mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari:
  - camera allow/deny;
  - rear-camera selection;
  - image upload for HEIC/HEIF/JPG/PNG/WebP;
  - multi-IMEI candidate selection;
  - pure numeric OCR where browser support exists;
  - manual fallback and save on new/edit/detail order flows.

## 2026-07-08T19:56:10Z - Real Device QA Package and Identifier Boundary

Status: active

Completed:

- Spawned and closed a real read-only QA reviewer for device-verification readiness:
  - Verity / QA / `019f4347-d59f-7381-8d6a-045cbfc284f0`
- Added `.ai-company/memory/tasks/TASK-20260708-010-imei-capture-hardening/REAL_DEVICE_QA.md` with:
  - desktop/mobile Chrome/Safari matrix;
  - HTTPS vs localhost requirements;
  - safe test identifiers;
  - camera allow/deny/no-camera/busy scenarios;
  - gallery JPG/PNG/WebP/HEIC/HEIF scenarios;
  - pure numeric OCR pass/fallback rules;
  - save-integrity checks for linked customer, device, unlock, order, warranty, finance, and contact data.
- Started a task-owned local preview on port 3022 and confirmed `/orders/new` returned `HTTP/1.1 200 OK`.
- Attempted HTTPS tunnel setup for mobile camera validation, but escalation review rejected it because third-party public tunneling exposes the local preview and requires explicit owner approval.
- Hardened `device_imei` inline patch schema with max 64 characters and a serial-safe character set, while keeping create/full edit IMEI optional.

Verification:

- `npx prettier --write src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts`: unchanged.
- `npx vitest run src/server/api/repairdesk-schemas.test.ts src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts --reporter=verbose`: 5 files / 84 tests passed.
- Scoped eslint for IMEI/parser/order-detail/schema/mock/e2e touched files passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed before this checkpoint.

Decision:

- Live camera capture remains barcode/QR decoding. Pure numeric OCR is verified through image upload/capture where native `TextDetector` exists.
- `.ai-company/memory/ACTIVE_CONTEXT.md` remains untouched because it currently belongs to `TASK-20260708-012-account-menu-email-logout`.

Open risks:

- Real physical camera startup, permission prompts, rear-camera hardware selection, and true iPhone Safari gallery behavior still require manual device verification.
- Mobile Chrome/Safari camera success requires a controlled HTTPS preview or explicit owner-approved tunnel.
- Safari pure numeric OCR is conditional on native browser `TextDetector`.
- Broader `order/update` / `order/patch` role authorization and offline IMEI retention policy remain separate security/product decisions.

Next:

- Use `REAL_DEVICE_QA.md` to run authenticated manual verification.
- If owner explicitly approves a temporary public tunnel, open it only for the minimum validation window and avoid real customer data.
- Otherwise verify desktop Chrome/Safari locally at `http://localhost:3022/orders/new` and wait for a controlled HTTPS preview before mobile camera PASS.

## 2026-07-08T20:03:43Z - Camera Constraint Fallback and Single IMEI Deduped

Status: active

Completed:

- Added camera startup fallback in `src/components/imei-scanner-field.tsx`: when rear-camera constraints fail with `OverconstrainedError`, retry with default browser camera constraints before surfacing an error.
- Hardened error-name detection so retry logic does not depend on cross-runtime `DOMException instanceof DOMException` behavior.
- Fixed `extractImeiCandidates` so a single valid numeric IMEI is not also added as a generic serial candidate when `includeGenericSerial` is enabled.
- Added regression tests for:
  - default-camera retry after rear-camera constraints are unsupported;
  - valid IMEI not being duplicated as a generic serial candidate.
- Updated real-device QA package to accept default-camera fallback as the expected recoverable path when rear-camera constraints are unsupported.

Verification:

- `npx prettier --write src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts`: unchanged.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts --reporter=verbose`: 2 files / 32 tests passed.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 86 tests passed.
- Scoped eslint for IMEI/parser/order-detail/schema/mock/e2e touched files passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed before this checkpoint.

Decision:

- Only retry on `OverconstrainedError`; permission denial, no camera, camera busy, and insecure-context errors remain explicit user-facing fallback states.
- `.ai-company/memory/ACTIVE_CONTEXT.md` remains untouched because it currently belongs to `TASK-20260708-012-account-menu-email-logout`.

Open risks:

- Real physical camera startup, permission prompts, rear-camera hardware selection, and true iPhone Safari gallery behavior still require manual device verification.
- Mobile Chrome/Safari camera success still requires a controlled HTTPS preview or explicit owner-approved tunnel.

Next:

- Continue with `REAL_DEVICE_QA.md` real-device verification.
- If a physical device reports rear-camera fallback problems, inspect actual browser error name and constraints behavior before broadening retry rules.

## 2026-07-08T20:13:10Z - Chromium Fake-Camera Stream Verified

Status: active

Completed:

- Added `tests/e2e/imei-camera-success.playwright.config.ts` for Chromium fake-camera verification.
- Added `tests/e2e/support/imei-fake-camera-video.ts` and global setup to generate a temporary Y4M fake-camera stream without committing generated video files.
- Added `tests/e2e/imei-camera-success.spec.ts` to verify the new-order IMEI scanner opens a real browser media stream without camera fallback errors.
- Captured visual evidence at `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-stream-chromium.png`.

Verification:

- `npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --list`: 1 Chromium fake-camera test listed in 1 file.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --reporter=list`: 1 test passed in approved non-sandbox execution.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 86 tests passed.
- Scoped eslint including fake-camera E2E and support files passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed before this checkpoint.

Decision:

- Treat fake-camera E2E as evidence for Chromium browser media-stream startup and UI state only. It does not prove QR/IMEI video decoding or physical camera behavior.
- `.ai-company/memory/ACTIVE_CONTEXT.md` remains untouched because it currently belongs to `TASK-20260708-012-account-menu-email-logout`.

Open risks:

- Real mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari physical camera startup still require authenticated manual/device verification.
- QR/IMEI video decode through a fake video stream was attempted but not claimed as passing; current decode evidence remains component-level plus real-device QA requirement.
- Mobile camera success still requires a controlled HTTPS preview or explicit owner-approved tunnel.

Next:

- Use `REAL_DEVICE_QA.md` for physical-device validation.
- If future automation needs QR video decode proof, improve the fake-camera fixture until ZXing decodes it, then add a separate assertion without weakening this media-stream gate.

## 2026-07-08T20:25:51Z - Chromium Fake-Camera QR Decode Verified

Status: active

Completed:

- Fixed fake-camera fixture generation by removing alpha before RGB-to-I420 conversion; the prior RGBA/RGB mismatch distorted QR frames.
- Regenerated the fake-camera Y4M path as `repairdesk-imei-qr-camera-v3.y4m`.
- Upgraded `tests/e2e/imei-camera-success.spec.ts` from media-stream-only evidence to QR decode evidence:
  - browser opens Chromium fake-camera stream;
  - ZXing decodes the QR from the camera stream;
  - new-order IMEI field auto-fills `490154203237518`;
  - dialog closes after capture.
- Added decoded-field visual evidence:
  - `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-decoded-chromium.png`

Verification:

- `npm run build`: initial sandbox run failed due known Turbopack port-binding restriction; approved non-sandbox rerun passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --reporter=list`: 1 test passed in approved non-sandbox execution.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 86 tests passed.
- Scoped eslint including fake-camera E2E and support files passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed before this checkpoint.

Decision:

- Chromium fake-camera is now valid automated evidence for browser media-stream startup plus ZXing QR decode into the new-order IMEI field.
- It remains insufficient for physical camera, OS permission prompt, mobile rear-camera hardware, iPhone Safari gallery, or browser-native OCR availability.
- `.ai-company/memory/ACTIVE_CONTEXT.md` remains untouched because it currently belongs to `TASK-20260708-012-account-menu-email-logout`.

Open risks:

- Real mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari physical camera startup still require authenticated manual/device verification.
- Mobile camera verification still requires controlled HTTPS preview or explicit owner-approved tunnel.

Next:

- Use `REAL_DEVICE_QA.md` for physical-device validation.
- If physical device results diverge from fake-camera evidence, prioritize real-device evidence and update camera constraints/fallback rules accordingly.

## 2026-07-08T21:19:07Z - Detail Upload QR and Field Authorization Verified

Status: active / automated-gates-passed / real-device-qa-pending

Completed:

- Spawned and closed three read-only review agents for this stage:
  - Delta the 2nd / DATA / `019f438c-f5fd-7d00-a448-b93fdbe64ddf`
  - Cipher the 2nd / SEC / `019f438d-2264-73c2-9af7-075ae8d93b37`
  - Verity the 2nd / QA / `019f438d-54c0-7ad1-ab10-8e2e5ce39ba4`
- Added shared E2E QR upload helper and route-level order-detail upload-real-QR E2E:
  - uploads a generated QR PNG through the IMEI dialog;
  - decodes `356938035643809`;
  - saves through `/api/repairdesk/order/patch`;
  - reloads `/orders/ord_1` and verifies the IMEI remains visible.
- Verified screenshot evidence is a real order-detail page, not a login or blank page:
  - `screenshots/TASK-20260708-010-imei-capture-hardening/imei-order-detail-upload-real-qr-refresh-desktop.png`
- Integrated SEC blocking finding:
  - `order/update` no longer checks only `order:update_intake`;
  - full-update repair/unlock/warranty fields require `order:update_repair`;
  - full-update finance fields and `order/finance` require `payment:adjust`;
  - IMEI patch remains intake-permitted while `device_unlock` patch maps to repair permission.
- Spawned and closed follow-up SEC reviewer:
  - Aegis the 2nd / SEC follow-up / `019f4395-db08-71d0-9eba-547ba86d12fc`
  - Result: PASS for the changed authorization scope; no remaining high-risk authz bypass found in `order/update`, `order/patch`, or `order/finance`.

Verification:

- `npx vitest run src/server/api/repairdesk-router.test.ts src/server/permissions.test.ts src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx --reporter=verbose`: 5 files / 77 tests passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3030 npx playwright test imei-order-detail-upload-real-qr.spec.ts --config tests/e2e/imei-order-detail.playwright.config.ts --reporter=list`: 1 Chromium test passed.
- After the authorization fix, `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3032 npx playwright test imei-order-detail-upload-real-qr.spec.ts --config tests/e2e/imei-order-detail.playwright.config.ts --reporter=list`: 1 Chromium test passed.
- Scoped eslint over router/schema/IMEI component/parser/order detail/order overview/mock API and IMEI E2E files passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed before this checkpoint.

Decisions:

- Full `order/update` is now intentionally conservative: because the payload contains full form fields, it requires the strongest relevant permissions for the field categories present. Intake/sales IMEI updates should use the inline `order/patch` route.
- No schema migration or dependency addition is needed.
- `.ai-company/memory/ACTIVE_CONTEXT.md` remains untouched because current global active context belongs to another task.

Open risks:

- Real mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari physical camera startup still require authenticated manual/device verification.
- Playwright mobile projects are device descriptors, not real phones; do not claim them as physical device proof.
- iPhone HEIC/HEIF gallery decode and pure numeric OCR still depend on target browser image decoding and browser-native `TextDetector` availability.
- Offline draft retention of IMEI/order context remains a privacy/retention decision for a later hardening task.
- DATA reviewer flagged full-edit blank IMEI semantics as a product decision: blank may later fall back to linked-device IMEI. Inline patch already rejects blank.

Next:

- Use `REAL_DEVICE_QA.md` and generated fixture labels for true device/browser verification.
- If sales/frontdesk must edit full order finance/diagnosis fields, design explicit scoped permissions instead of weakening the full-update guard.
