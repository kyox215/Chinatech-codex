# Evidence

## Initial Evidence - 2026-07-08T17:32:56Z

- Existing IMEI field implementation: `src/components/imei-scanner-field.tsx`
- Existing global scanner sheet: `src/features/capture/components/barcode-scanner-sheet.tsx`
- Existing barcode parser: `src/features/capture/model/barcode-parser.ts`
- Existing order new/edit/detail call sites:
  - `src/features/orders/forms/new-order-customer-device-section.tsx`
  - `src/features/orders/forms/edit-order-dialog.tsx`
  - `src/features/orders/screens/order-detail-screen.tsx`
  - `src/features/orders/components/order-overview-tab.tsx`
- Current package has `@zxing/browser` and no committed OCR dependency in `package.json`.

## External Browser Sources

- MDN `getUserMedia`: camera access requires secure context and user permission; common errors include permission denied, no matching media, unreadable device, and overconstrained requests.
- MDN `BarcodeDetector`: limited availability, so it should not be the cross-browser baseline.
- MDN `input type=file` and `capture`: file upload is broadly available; `capture` is useful as a mobile hint but not a universal baseline.
- Tesseract.js official site: browser-capable OCR option, but dependency addition remains an approval/architecture point.

## Subagent Evidence

- Kepler / ARCH-DATA / `019f42c9-5bc3-7ba0-bd7c-b6084299c4c3`: no DB migration needed for first slice; centralize candidate parser; defer OCR dependency.
- Aster / UX / `019f42c9-9069-73d0-9829-ade56b5fd89f`: inline camera recovery, visible upload/manual paths, multi-candidate selection, no toast-only errors.
- Aegis / SEC / `019f42c9-b290-7521-ae47-67d25a78c9f0`: local OCR only, file size/type limits, avoid raw OCR/IMEI in toast or screenshots, new OCR dependency requires Owner approval.
- Verity / QA / `019f42c9-db7b-7012-977c-a6d1858eb145`: parser tests first, then full gates; Safari/mobile camera remains manual real-device verification.
- Kepler / ARCH / `019f42f4-9e3c-7a30-816b-19ec95b567c8`: central parser and `ImeiScannerField` reuse are sound; fixed required `decodeFromConstraints` cancellation cleanup; `TextDetector` remains conditional, not guaranteed Safari OCR.
- Sentinel / SEC / `019f42f4-bd6f-75a3-af9a-40caeaeb8ccd`: image/OCR stays local, but raw camera/image/OCR/save error messages needed sanitizing; fixed with whitelist fallback messages.
- Probe / QA / `019f42f4-db8e-71f2-9ce3-8eca105ec6cb`: added missing OCR fallback component evidence and executed browser E2E after its static coverage review.

## Verification Evidence

- `npx vitest run src/features/capture/model/barcode-parser.test.ts`: 1 file / 15 tests passed.
- `npx vitest run src/components/imei-scanner-field.test.tsx --reporter=verbose`: 1 file / 5 tests passed.
- `npx vitest run src/features/capture/model/barcode-parser.test.ts src/components/imei-scanner-field.test.tsx --reporter=verbose`: 2 files / 20 tests passed.
- `npx eslint src/components/imei-scanner-field.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts src/features/orders/screens/order-detail-screen.tsx`: passed.
- `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts src/features/orders/screens/order-detail-screen.tsx`: passed.
- `npm run typecheck`: passed.
- `npm run test`: 86 files / 564 tests passed.
- `npm run lint`: passed.
- `npm run build`: sandbox run failed with known Turbopack port-binding `Operation not permitted`; escalated rerun passed.
- `npm run agents:check`: passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 npx playwright test tests/e2e/imei-capture-ui.spec.ts --project=chromium --reporter=list`: 1 Chromium test passed.
- Earlier `npm run check`: passed outside sandbox before the final component-test addition; final post-addition gates were run individually as listed above.
- `git diff --check` on scoped files: passed.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts --reporter=verbose`: 2 files / 23 tests passed after OCR fallback and delayed camera cleanup tests.
- `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/orders/screens/order-detail-screen.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts tests/e2e/imei-capture-ui.spec.ts tests/e2e/imei-capture.playwright.config.ts`: passed.
- `npm run typecheck`: passed after final safety and race fixes.
- `npm run lint`: passed after final safety and race fixes.
- `npm run test`: 86 files / 567 tests passed.
- `npm run build`: passed in approved non-sandbox execution after final changes.
- Initial WebKit E2E attempt failed because Playwright WebKit executable was missing; `npx playwright install webkit` completed successfully.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 4 tests passed across Chromium/WebKit desktop/mobile.
- Final scoped `git diff --check`: passed.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts --reporter=verbose`: 2 files / 24 tests passed after HEIC/HEIF support.
- `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/orders/screens/order-detail-screen.tsx tests/e2e/imei-capture-ui.spec.ts tests/e2e/imei-capture.playwright.config.ts`: passed after HEIC/HEIF and E2E matrix expansion.
- `npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --list`: 6 tests listed in 1 file.
- `npm run typecheck`: passed after HEIC/HEIF and E2E matrix expansion.
- `npm run lint`: passed after HEIC/HEIF and E2E matrix expansion.
- `npm run test`: 86 files / 568 tests passed.
- `npm run build`: passed in approved non-sandbox execution after HEIC/HEIF and E2E matrix expansion.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed across desktop Chrome, desktop Safari, mobile viewport Chrome/Safari, Pixel Chrome, and iPhone Safari device descriptors.
- Gauge / QA / `019f4325-3294-71d2-a6fe-d295724935cb`: conditional pass for parser/shared component hardening; requested explicit order-detail save coverage and real camera manual verification.
- Cipher / SEC / `019f4325-5d63-7001-b39a-d17f48a84f27`: found unresolved broader order patch role-authorization and offline IMEI draft policy risks; accepted local image/OCR minimization but required IMEI-specific save-error sanitization.
- Index / DATA / `019f4325-8e28-7e90-a1ac-6852ab4b1f19`: non-empty quick-save is scoped and versioned; requested blank IMEI semantics and invariant tests for customer/device/unlock/order fields.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 78 tests passed after order-detail component coverage, blank IMEI rejection, data invariants, and schema checks.
- `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts src/features/orders/screens/order-detail-screen.tsx src/features/orders/components/order-overview-tab.tsx src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.ts src/features/orders/testing/mock-api.test.ts src/features/orders/server/order.repository.ts src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts tests/e2e/imei-capture-ui.spec.ts tests/e2e/imei-capture.playwright.config.ts`: passed.
- `npm run typecheck`: passed after final IMEI save/schema/data-safety changes.
- `npm run lint`: passed after final IMEI save/schema/data-safety changes.
- `npm run test`: failed in default high-parallel mode because existing `src/features/orders/components/order-option-pickers.test.tsx` test `shows expanded front desk service options for every fault category` timed out at 5000ms; the same file passed independently.
- `npx vitest run src/features/orders/components/order-option-pickers.test.tsx --reporter=verbose`: 1 file / 5 tests passed; the timed-out case passed in 2205ms when isolated.
- `npx vitest run --maxWorkers=1 --no-file-parallelism`: 87 files / 572 tests passed, confirming full suite passes under low-concurrency execution in this environment.
- First rerun of the 6-project IMEI Playwright matrix exposed Chromium image recognition hanging on a 1x1 PNG during barcode decode; fixed by adding barcode/OCR recognition timeouts and retrying.
- Final `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed across desktop Chrome, desktop Safari, mobile viewport Chrome/Safari, Pixel Chrome, and iPhone Safari device descriptors.
- `npm run build`: sandbox run failed with known Turbopack internal port-binding restriction; approved non-sandbox rerun passed after final changes.
- Final scoped `git diff --check` passed for IMEI code, tests, E2E config/spec, and task-memory files.
- `npx prettier --write src/components/imei-scanner-field.test.tsx`: unchanged after camera-error and timeout regression additions.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 84 tests passed after camera error variants and uploaded-image barcode timeout fallback coverage.
- `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab.tsx src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/screens/order-detail-screen.tsx src/features/orders/server/order.repository.ts src/features/orders/testing/mock-api.ts src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts tests/e2e/imei-capture-ui.spec.ts tests/e2e/imei-capture.playwright.config.ts`: passed.
- `npm run typecheck`: passed after camera-error and timeout regression additions.
- Final `git diff --check`: passed after task-local checkpoint update.
- Verity / QA / `019f4347-d59f-7381-8d6a-045cbfc284f0`: conditional pass; confirmed automated coverage is strong for parser, multi-candidate, fallback errors, blank patch boundaries, and mocked browser matrix, but real camera, permission prompts, rear-camera hardware, HEIC gallery, and Safari OCR still need true device evidence.
- `curl -I http://127.0.0.1:3022/orders/new` against the task-owned local preview returned `HTTP/1.1 200 OK` on 2026-07-08T19:52:05Z.
- `npx prettier --write src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts`: unchanged after adding IMEI patch max/character validation.
- `npx vitest run src/server/api/repairdesk-schemas.test.ts src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts --reporter=verbose`: 5 files / 84 tests passed after `device_imei` max length and character boundary validation.
- `npx eslint src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab.tsx src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/screens/order-detail-screen.tsx src/features/orders/server/order.repository.ts src/features/orders/testing/mock-api.ts src/features/orders/testing/mock-api.test.ts tests/e2e/imei-capture-ui.spec.ts tests/e2e/imei-capture.playwright.config.ts`: passed.
- `npm run typecheck`: passed after `device_imei` max length and character boundary validation.
- Final `git diff --check`: passed before the 2026-07-08T19:56:10Z checkpoint.
- Public HTTPS tunnel was attempted but rejected by escalation review because exposing the local preview through a third-party tunnel requires explicit owner approval; no tunnel was opened.
- `npx prettier --write src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts`: unchanged after camera fallback and IMEI candidate dedupe additions.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts --reporter=verbose`: 2 files / 32 tests passed after rear-camera overconstrained fallback and single IMEI/generic-serial dedupe.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 86 tests passed.
- `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.ts src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab.tsx src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/screens/order-detail-screen.tsx src/features/orders/server/order.repository.ts src/features/orders/testing/mock-api.ts src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.ts src/server/api/repairdesk-schemas.test.ts tests/e2e/imei-capture-ui.spec.ts tests/e2e/imei-capture.playwright.config.ts`: passed after camera fallback and IMEI candidate dedupe.
- `npm run typecheck`: passed after camera fallback and IMEI candidate dedupe.
- Final `git diff --check`: passed before the 2026-07-08T20:03:43Z checkpoint.
- `npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --list`: 1 Chromium fake-camera test listed in 1 file.
- First fake-camera decode attempt exposed a fixture bug: sharp composite preserved alpha, but the YUV converter read the buffer as RGB. The resulting QR video was distorted and not decodable.
- After adding `.removeAlpha()` and regenerating the fixture as `repairdesk-imei-qr-camera-v3.y4m`, frame inspection showed a clean QR image.
- `npm run build`: passed in approved non-sandbox execution after the current IMEI parser/scanner changes.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3022 npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --reporter=list`: 1 test passed in approved non-sandbox execution, proving fake-camera QR decode fills the new-order IMEI field.
- Visual evidence added: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-stream-chromium.png`.
- Visual evidence added: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-decoded-chromium.png`.
- Fake-camera E2E proves Chromium can open a real browser media stream, decode the QR video through ZXing, and fill the IMEI field. It does not prove physical camera hardware or mobile Safari/Chrome permission prompts.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts --reporter=verbose`: 5 files / 86 tests passed after adding fake-camera E2E files.
- Scoped eslint including fake-camera E2E and support files passed.
- `npm run typecheck`: passed after adding fake-camera E2E files.
- Final `git diff --check`: passed before the 2026-07-08T20:25:51Z checkpoint.
- Atlas / project explorer / `019f436e-e280-79d0-98f4-447d197b4cb8`: recommended direct `/orders/ord_1` detail route E2E with the read-mode IMEI popover and save-refresh assertion.
- Gauge / QA reviewer / `019f436e-e365-7ec2-b589-f8f53b8c608f`: conditional pass; requested route-level detail save-refresh E2E and real-device hardware/browser verification.
- Sentinel / security reviewer / `019f436e-e3eb-7a53-a17c-a96580752ac9`: found blocking missing order write authorization and inconsistent create/update IMEI schema; also recommended mobile OCR timeout and privacy decision for offline IMEI drafts.
- `npx vitest run src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx src/features/orders/testing/mock-api.test.ts src/server/api/repairdesk-schemas.test.ts src/server/api/repairdesk-router.test.ts src/server/permissions.test.ts --reporter=verbose`: 7 files / 106 tests passed after order write authorization, schema consistency, detail persistence E2E, and mobile OCR timeout changes.
- Scoped eslint over IMEI component/parser/order detail/order overview/mock API/router/schema/E2E files passed after the final security and OCR timeout changes.
- `npm run typecheck`: passed after the final security and OCR timeout changes.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3025 npx playwright test imei-capture-ui.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed across desktop Chrome, desktop Safari, mobile viewport Chrome/Safari, Pixel Chrome, and iPhone Safari device descriptors.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3026 npx playwright test imei-camera-success.spec.ts --config tests/e2e/imei-camera-success.playwright.config.ts --reporter=list`: 1 Chromium fake-camera stream QR decode test passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3027 npx playwright test imei-order-detail-save.spec.ts --config tests/e2e/imei-order-detail.playwright.config.ts --reporter=list`: 1 route-level order-detail IMEI save-refresh test passed.
- `npm run build`: passed in approved non-sandbox execution after final changes. Sandbox build fails with known Turbopack process/port-binding restriction.
- Final `git diff --check`: passed after final changes and before the 2026-07-08T20:50:04Z checkpoint.
- `npx tsx scripts/generate-imei-real-device-fixtures.ts`: generated real-device QA label HTML/SVG/PNG assets in `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures` after approved non-sandbox execution; sandbox `tsx` failed with IPC pipe `EPERM`.
- `npx eslint scripts/generate-imei-real-device-fixtures.ts`: passed.
- `npm run typecheck`: passed after adding the real-device fixture generator.
- Manual visual inspection of `imei-multi-candidate-label.png` confirmed the QR and OCR text label are visible at usable size.
- Attempted HTTPS local preview command `REPAIRDESK_E2E_ORDER_AUDIT=1 npx next dev --experimental-https -p 3028 --hostname 0.0.0.0` could not become the active verification server because mkcert certificate generation failed and Next reported another repo dev server already active on port 3016. No unrelated preview was stopped.
- Added `tests/e2e/imei-upload-real-qr.spec.ts` to verify image upload barcode decoding with a real generated QR PNG and no OCR mocks.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3029 npx playwright test imei-upload-real-qr.spec.ts --config tests/e2e/imei-capture.playwright.config.ts --reporter=list`: 6 tests passed across Chromium/WebKit desktop/mobile projects and Pixel/iPhone descriptors.
- Stopped the existing non-E2E Next dev server on port 3016 after approval because it redirected to login and blocked the dedicated IMEI E2E mock server.
- Scoped eslint over `tests/e2e/imei-upload-real-qr.spec.ts`, `tests/e2e/imei-capture.playwright.config.ts`, and `scripts/generate-imei-real-device-fixtures.ts`: passed.
- `npm run typecheck`: passed after adding the real QR upload E2E.
- Final `git diff --check`: passed after adding the real QR upload E2E.
- Delta the 2nd / DATA / `019f438c-f5fd-7d00-a448-b93fdbe64ddf`: conditional pass; no migration required; online nonblank IMEI quick-save path preserves linked customer/device/order fields; full-edit blank IMEI fallback semantics remain a later product decision.
- Cipher the 2nd / SEC / `019f438d-2264-73c2-9af7-075ae8d93b37`: found high-risk `order/update` authorization gap and recommended field-aware permissions plus explicit finance permission.
- Verity the 2nd / QA / `019f438d-54c0-7ad1-ab10-8e2e5ce39ba4`: confirmed automated browser coverage is strong but not physical device proof; requested a clean detail upload-real-QR pass log and real-device QA.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3030 npx playwright test imei-order-detail-upload-real-qr.spec.ts --config tests/e2e/imei-order-detail.playwright.config.ts --reporter=list`: 1 Chromium test passed, proving order-detail uploaded QR decode, save, and refresh persistence.
- `npx vitest run src/server/api/repairdesk-router.test.ts src/server/permissions.test.ts src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts src/features/orders/components/order-overview-tab-imei-field.test.tsx --reporter=verbose`: 5 files / 77 tests passed after field-level order authorization fix.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3032 npx playwright test imei-order-detail-upload-real-qr.spec.ts --config tests/e2e/imei-order-detail.playwright.config.ts --reporter=list`: 1 Chromium test passed after the authorization fix, proving the IMEI detail save path still works.
- Aegis the 2nd / SEC follow-up / `019f4395-db08-71d0-9eba-547ba86d12fc`: PASS for changed auth scope; no remaining high-risk bypass found in `order/update`, `order/patch`, or `order/finance`.
- Scoped eslint over router/schema/IMEI component/parser/order detail/order overview/mock API and IMEI E2E files passed after the authorization fix.
- `npm run typecheck`: passed after the authorization fix.
- `git diff --check`: passed after the authorization fix and before task-memory checkpoint.

## Visual Evidence

- Screenshot path: `screenshots/TASK-20260708-010-imei-capture-hardening/orders-new-mobile.png`
- Note: local `/orders/new` redirected to the login screen, so the screenshot proves local visual access was attempted but does not show the IMEI field. Authenticated order-page screenshots still require a safe local account/session.
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-desktop.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-desktop.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-chromium-mobile.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-webkit-desktop.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-webkit-mobile.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-chromium-mobile.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-webkit-desktop.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-webkit-mobile.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-mobile-chrome.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-mobile-safari.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-mobile-chrome.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-mobile-safari.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-stream-chromium.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-decoded-chromium.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-order-detail-save-refresh-desktop.png`
- Real-device QA fixture: `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-real-device-labels.html`
- Real-device QA fixture: `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-multi-candidate-label.png`
- Real-device QA fixture: `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-ocr-text-label.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-desktop.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-chromium-mobile.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-webkit.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-webkit-mobile.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-mobile-chrome.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-mobile-safari.png`
- Browser E2E screenshot: `screenshots/TASK-20260708-010-imei-capture-hardening/imei-order-detail-upload-real-qr-refresh-desktop.png`

## Remaining Evidence Gap

- Automated Chromium/WebKit checks use mocked camera-unavailable and mocked browser `TextDetector`; they prove UI fallback and candidate selection flows, not real physical camera permission/rear-camera behavior.
- Real mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari camera startup still require authenticated manual/device verification.
- Safari pure-numeric photo OCR is conditional because the implementation uses browser-native `TextDetector` when available and otherwise degrades to barcode/photo/manual paths.
- Security review blocking findings for `orders/create`, field-aware `order/update`, `order/patch`, `order/finance`, and create/update IMEI schema consistency were addressed in this task and covered by router/schema/permission tests plus SEC follow-up. Broader scoped object-level policies beyond the current matrix remain a future access-control design topic.
- Offline new/edit order drafts currently persist normalized IMEI alongside order context in browser IndexedDB. This matches the owner requirement to preserve order information offline, but remains a privacy policy decision requiring explicit retention/risk acceptance or a separate encrypted/excluded-draft design.
