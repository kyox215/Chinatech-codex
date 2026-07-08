# Checkpoints — TASK-20260709-003-imei-overlay-selection

## 2026-07-08T23:01:08Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-07-08T23:12:58Z — Implemented and validated before commit/push

- **Phase:** validation / closeout.
- **Completed:** IMEI scanner now preserves frozen camera/upload preview, maps `BarcodeDetector.boundingBox` results to clickable overlay boxes, keeps candidate-list fallback for no-position ZXing/OCR results, fixes bottom action bar behavior, and compacts mobile candidate/error states.
- **Evidence:** `src/components/imei-scanner-field.tsx`; `src/components/imei-scanner-field.test.tsx`; `tests/e2e/imei-capture-ui.spec.ts`; `tests/e2e/imei-camera-success.spec.ts`; screenshot directory `screenshots/TASK-20260709-003-imei-overlay-selection/`.
- **Validation:** `npm run test -- src/components/imei-scanner-field.test.tsx` passed 17 tests; `npm run typecheck` passed; `npm run lint` passed; IMEI capture E2E passed 6 projects; fake-camera E2E passed 2 projects; `npm run test` passed 87 files / 603 tests; `npm run build` passed.
- **Decisions:** On mobile, hide the manual input block after candidates exist so the main selection flow fits in one page; on unsupported-camera error, omit the empty black viewport and show upload/manual/retry directly.
- **Risks/blockers:** `tools/ai_company.py checkpoint` could not run with system Python 3.9 due missing `tomllib`; this structured checkpoint was written manually. Real iOS hardware remains the final hardware-specific confidence layer, but Playwright mobile Safari and upload/manual fallbacks passed.
- **Next:** stage scoped files, commit, push `main`, then report screenshot paths and validation summary.

## 2026-07-08T23:24:57Z — Bugfix for overlay alignment and mobile keyboard

- **Phase:** bugfix validation.
- **Completed:** changed frozen-preview overlay positioning to compensate for `object-contain` image scaling/letterboxing by measuring the rendered viewport and using stored preview dimensions. Prevented Radix dialog open autofocus so the manual input no longer opens the phone keyboard on scanner open.
- **Evidence:** `src/components/imei-scanner-field.tsx`; `src/components/imei-scanner-field.test.tsx`; refreshed screenshots under `screenshots/TASK-20260709-003-imei-overlay-selection/`.
- **Validation:** `npm run test -- src/components/imei-scanner-field.test.tsx` passed 18 tests; `npm run typecheck` passed; `npm run lint` passed; IMEI capture E2E passed 6 projects; fake-camera E2E passed 2 projects; `npm run test` passed 87 files / 604 tests; `npm run build` passed.
- **Decisions:** Do not overwrite `.ai-company/memory/ACTIVE_CONTEXT.md` because the workspace already has an unrelated `TASK-20260709-004-customer-kiosk-ipad-plan` active-context change. This checkpoint is stored in the IMEI task directory only.
- **Risks/blockers:** final confirmation should be done on the same real phone/browser after deployment because the original issue was hardware/browser visual evidence.
- **Next:** stage only IMEI code/tests/task-memory/screenshots, commit, push `main`, and leave unrelated kiosk-plan files untouched.

## 2026-07-08T23:34:03Z — Bugfix for visual top-to-bottom numbering

- **Phase:** bugfix validation.
- **Completed:** candidates with barcode boxes are now sorted by visual position before numbering, so the top detected barcode is marker/list item 1 and the lower detected barcode is marker/list item 2 even if the browser returns detections in another order.
- **Evidence:** `src/components/imei-scanner-field.tsx`; `src/components/imei-scanner-field.test.tsx`; `tests/e2e/imei-capture-ui.spec.ts`; `screenshots/TASK-20260709-003-imei-overlay-selection/imei-new-order-upload-candidates-mobile-safari.png`.
- **Validation:** `npm run test -- src/components/imei-scanner-field.test.tsx` passed 18 tests; scoped `npx eslint src/components/imei-scanner-field.tsx src/components/imei-scanner-field.test.tsx tests/e2e/imei-capture-ui.spec.ts` passed; IMEI capture E2E passed 6 projects.
- **Decisions:** Sort boxed candidates by normalized `box.y`, then `box.x`, then original order. Non-boxed fallback candidates keep their original order after boxed candidates.
- **Risks/blockers:** full-repo `npm run typecheck` and `npm run lint` are currently blocked by unrelated uncommitted kiosk/API files; do not interpret those failures as caused by this IMEI change.
- **Next:** stage only IMEI order-fix files, commit, push `main`, and report the unrelated dirty files separately.
