# Checkpoints

## 2026-07-09 - Task start

- Created branch `codex/imei-fast-lock-scanner` from latest `origin/main`.
- Current center-crop assist interval is 1100ms and uses the full image-recognition barcode path.
- Next: shorten pre-scan loop, add frame-lock state, and avoid slow final detection when live raw barcode already yields candidates.

## 2026-07-09T09:32:58Z - Implementation checkpoint

- Implemented a fast-lock camera path in `src/components/imei-scanner-field.tsx`.
- Reduced center-crop assist polling from 1100ms to 250ms and added a 450ms barcode-only fast timeout.
- Added `isFrameLocked` and `scannerLockInProgressRef` so a live camera hit freezes the current frame once and blocks duplicate late callbacks until retry/close.
- Live ZXing results that already contain IMEI/SN candidates now skip the slow multi-barcode pass and show candidates immediately on the locked frame.
- Center-crop assist uses the fast barcode helper first, then freezes the recognized crop preview with candidate overlays when detections have boxes.
- Added a focused component test proving valid live raw scans lock the frame without invoking slow `BarcodeDetector` or `decodeFromImageElement`.
- Validation passed: focused component test, typecheck, lint, full Vitest, build outside sandbox, and IMEI Playwright smoke.
- Next: review final diff, stage scoped files, commit, fetch/rebase check, push to `main`, then close task memory.

## 2026-07-09T09:41:48Z - Post-review fix checkpoint

- Diff review found that the center-crop assist loop could clear `isImageProcessing` even when another lock/OCR path owned the processing state.
- Fixed the loop with a per-iteration `lockedByThisDecode` guard so only a successful center-crop lock clears its own processing state.
- Re-ran validation after the fix: focused component test, typecheck, lint, full Vitest, build outside sandbox, and IMEI Playwright smoke all passed.
- Refreshed visual evidence in `screenshots/TASK-20260709-012-imei-fast-lock-scanner/` and restored generated changes outside the task scope.

## 2026-07-09T09:43:40Z - Ready for push

- Scoped commit prepared after fetch confirmed `origin/main` had no new commits.
- Task memory is closed so the pushed main branch will not resume this task as active.
- Next action: push the current commit to `main`.
