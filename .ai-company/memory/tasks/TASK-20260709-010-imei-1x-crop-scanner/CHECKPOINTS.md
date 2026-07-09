# Checkpoints

## 2026-07-09 - Task start

- Created branch `codex/imei-1x-crop-scanner` from latest `origin/main`.
- Current implementation still requests hardware zoom in enhanced camera constraints.
- Next: remove hardware zoom, keep center-crop recognition, update tests and validation.

## 2026-07-09 - Verification checkpoint

- Removed default hardware `zoom: 2` from enhanced camera constraints.
- Kept 1x high-resolution rear camera preview and added center-crop assisted barcode recognition.
- Photo OCR continues to crop/enlarge the center region before OCR.
- Updated tests to assert no hardware zoom and center-crop canvas source coordinates.
- Focused tests, typecheck, lint, full test suite, build, and related Playwright UI flow passed.
