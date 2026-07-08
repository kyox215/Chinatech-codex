# Handoff

## Resume Packet

Task: `TASK-20260708-010-imei-capture-hardening`

Current phase: automated browser E2E, detail persistence, data-safety, schema boundary, field-aware order authorization, and uploaded real-QR detail save/refresh verified; waiting for real-device Chrome/Safari camera verification and offline-retention privacy decision.

Immediate next action:

1. Start a controlled HTTPS local preview with `REPAIRDESK_E2E_ORDER_AUDIT=1 npx next dev --experimental-https -p 3028 --hostname 0.0.0.0`, or use another owner-approved HTTPS preview method.
2. Open `https://<LAN-IP>:3028/orders/new` on mobile and use `.ai-company/memory/tasks/TASK-20260708-010-imei-capture-hardening/REAL_DEVICE_QA.md`.
3. Use generated fixture labels under `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures`.
4. Open new/edit/detail order IMEI entry points.
5. Manually verify camera startup and fallback behavior on mobile Chrome, mobile Safari, desktop Chrome, and desktop Safari.
6. Include iPhone HEIC/HEIF gallery photo selection and pure numeric OCR/TextDetector behavior in the mobile Safari pass.
7. Capture screenshots or a short recording that does not expose full customer PII or secrets.

Important constraints:

- Keep main thread as only writer.
- Do not add OCR dependency without explicit owner approval or a separate decision point.
- Do not touch database migrations or production data.
- Preserve unrelated dirty worktree changes.
- `.ai-company/memory/ACTIVE_CONTEXT.md` currently belongs to `TASK-20260708-012-account-menu-email-logout`; do not overwrite it unless intentionally changing active task context.
- Mobile camera success requires HTTPS. Public tunnel exposure was not opened because it requires explicit owner approval.
- `next dev --experimental-https` may require mkcert/keychain trust and can fail back to HTTP. It also cannot start a second dev server while another Next dev process is active for this repo; do not stop another task's preview without confirming ownership.

Subagents:

- `019f42c9-5bc3-7ba0-bd7c-b6084299c4c3` Kepler, ARCH/DATA
- `019f42c9-9069-73d0-9829-ade56b5fd89f` Aster, UX
- `019f42c9-b290-7521-ae47-67d25a78c9f0` Aegis, SEC
- `019f42c9-db7b-7012-977c-a6d1858eb145` Verity, QA
- `019f42f4-9e3c-7a30-816b-19ec95b567c8` Kepler, ARCH follow-up
- `019f42f4-bd6f-75a3-af9a-40caeaeb8ccd` Sentinel, SEC follow-up
- `019f42f4-db8e-71f2-9ce3-8eca105ec6cb` Probe, QA follow-up
- `019f4325-3294-71d2-a6fe-d295724935cb` Gauge, QA final read-only review
- `019f4325-5d63-7001-b39a-d17f48a84f27` Cipher, SEC final read-only review
- `019f4325-8e28-7e90-a1ac-6852ab4b1f19` Index, DATA final read-only review
- `019f4347-d59f-7381-8d6a-045cbfc284f0` Verity, QA real-device readiness review
- `019f436e-e280-79d0-98f4-447d197b4cb8` Atlas, project explorer detail-persistence review
- `019f436e-e365-7ec2-b589-f8f53b8c608f` Gauge, QA detail/save-refresh review
- `019f436e-e3eb-7a53-a17c-a96580752ac9` Sentinel, security review
- `019f438c-f5fd-7d00-a448-b93fdbe64ddf` Delta the 2nd, DATA detail upload/data review
- `019f438d-2264-73c2-9af7-075ae8d93b37` Cipher the 2nd, SEC auth review
- `019f438d-54c0-7ad1-ab10-8e2e5ce39ba4` Verity the 2nd, QA detail upload review
- `019f4395-db08-71d0-9eba-547ba86d12fc` Aegis the 2nd, SEC follow-up authorization review

Implemented files:

- `src/components/imei-scanner-field.tsx`
- `src/components/imei-scanner-field.test.tsx`
- `src/features/capture/model/barcode-parser.ts`
- `src/features/capture/model/barcode-parser.test.ts`
- `src/features/orders/components/order-overview-tab.tsx`
- `src/features/orders/components/order-overview-tab-imei-field.test.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/server/order.repository.ts`
- `src/features/orders/testing/mock-api.ts`
- `src/features/orders/testing/mock-api.test.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/api/repairdesk-schemas.test.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-router.test.ts`
- `tests/e2e/imei-capture-ui.spec.ts`
- `tests/e2e/imei-capture.playwright.config.ts`
- `tests/e2e/imei-camera-success.spec.ts`
- `tests/e2e/imei-camera-success.playwright.config.ts`
- `tests/e2e/imei-order-detail-save.spec.ts`
- `tests/e2e/imei-order-detail.playwright.config.ts`
- `tests/e2e/imei-upload-real-qr.spec.ts`
- `tests/e2e/imei-order-detail-upload-real-qr.spec.ts`
- `tests/e2e/support/imei-fake-camera-video.ts`
- `tests/e2e/support/imei-fake-camera-video-global-setup.ts`
- `tests/e2e/support/imei-upload-qr-file.ts`
- `scripts/generate-imei-real-device-fixtures.ts`
- `.ai-company/memory/tasks/TASK-20260708-010-imei-capture-hardening/REAL_DEVICE_QA.md`

Final local verification:

- Parser + IMEI component + order-detail component + mock/API schema/router/permission tests: 7 files / 106 tests passed.
- Full Vitest low-concurrency: 87 files / 572 tests passed.
- Default `npm run test` high-parallel mode currently times out in existing `order-option-pickers.test.tsx`; the same file passes independently.
- Playwright IMEI E2E: 6 tests passed across desktop Chrome, desktop Safari, mobile viewport Chrome/Safari, Pixel Chrome, and iPhone Safari device descriptors.
- Playwright fake-camera E2E: 1 Chromium media-stream QR decode test passed.
- Playwright order-detail E2E: 1 direct detail save-refresh persistence test passed.
- Playwright real QR upload E2E: 6 browser/mobile descriptor projects passed without OCR mocks.
- Playwright order-detail uploaded real QR E2E: 1 Chromium test passed before and after the field-authorization fix.
- Router/security tests after field-aware authorization: 5 files / 77 tests passed.
- SEC follow-up passed for `order/update`, `order/patch`, and `order/finance` authorization scope.
- `npm run typecheck`, `npm run lint`, and approved non-sandbox `npm run build` passed.
- Scoped `git diff --check` passed.
- Local desktop preview health check returned `HTTP/1.1 200 OK` for `http://127.0.0.1:3022/orders/new`.
- Camera startup now retries the browser default camera when rear-camera constraints fail with `OverconstrainedError`.
- Single valid numeric IMEI scans are no longer duplicated as generic serial candidates, so they can auto-fill without manual candidate selection.
- Chromium fake-camera E2E passes and proves the IMEI dialog can open a real browser media stream, decode a QR video through ZXing, and auto-fill the new-order IMEI field. It does not prove physical camera hardware or mobile browser permission prompts.
- Order write authorization now checks the existing permission matrix for `orders/create`, `order/update`, and `order/patch`; viewer write attempts are covered by router tests.
- Create/update/patch IMEI schema now rejects over-64-character and unsafe nonblank identifiers while preserving blank create/full-edit compatibility.
- Mobile order-detail OCR now has a 5s timeout.

Visual evidence:

- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-chromium-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-webkit-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-webkit-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-chromium-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-webkit-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-webkit-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-mobile-chrome.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-camera-fallback-mobile-safari.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-mobile-chrome.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-candidates-mobile-safari.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-stream-chromium.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-fake-camera-decoded-chromium.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-order-detail-save-refresh-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-chromium-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-webkit.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-webkit-mobile.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-mobile-chrome.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-new-order-upload-real-qr-mobile-safari.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/imei-order-detail-upload-real-qr-refresh-desktop.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-real-device-labels.html`
- `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-multi-candidate-label.png`
- `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-ocr-text-label.png`

Known remaining gaps:

- Automated browser checks include mocked camera-unavailable/TextDetector flows plus Chromium fake-camera QR decode. They still do not prove real physical camera permission prompts, rear-camera hardware selection, or mobile OS gallery behavior.
- Mobile Safari pure numeric OCR depends on browser `TextDetector` availability; no OCR dependency was added.
- HEIC/HEIF files are accepted for iPhone gallery compatibility, but recognition still depends on target-browser image decoding and barcode/OCR success.
- Real-device detail save-refresh should still be manually checked once a real authenticated session/device matrix is available, but automated route-level detail persistence now exists.
- Scoped object-level authorization beyond the current role matrix remains a future access-control hardening topic; this task added route-level role enforcement for create/update/patch/finance and field-aware full-update permission checks.
- Offline new/edit order drafts still persist normalized IMEI with order context in browser IndexedDB. This preserves offline order information but needs explicit privacy/retention acceptance or a future encrypted/excluded design.
- Inline `device_imei` patch now rejects blank, over-64-character, and obvious illegal-character values, but broader identifier policy and offline retention remain separate product/security decisions.
- Full-edit blank IMEI semantics remain a product decision: if blank means “clear IMEI”, repository fallback from linked-device IMEI needs a future explicit rule; inline patch already rejects blank.
