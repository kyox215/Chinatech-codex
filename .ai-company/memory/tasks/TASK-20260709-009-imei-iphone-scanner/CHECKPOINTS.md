# Checkpoints

## 2026-07-09 - Task start

- Created isolated worktree from latest `origin/main`.
- Installed `tesseract.js@7.0.0` for lazy browser-side OCR fallback.
- Next: implement camera/OCR changes and focused tests.

## 2026-07-09 - Validation checkpoint

- Implemented iPhone-first enhanced camera startup and 2x center-crop capture for IMEI scanning.
- Added dedicated `拍照 OCR` flow using browser OCR first and lazy Tesseract OCR fallback when native OCR is unavailable.
- Focused scanner test, full test suite, typecheck, lint, build, and related Playwright IMEI UI flow passed.
- Remaining risk: hardware focus/zoom on real iPhone Chrome/Safari requires post-merge device smoke test.
