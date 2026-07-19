# Local OCR assets

Inventory label OCR uses fixed-version, same-origin assets so full labels and device identifiers are not sent to a third-party CDN.

- `tesseract.js` and `tesseract.js-core`: version `7.0.0`, Apache-2.0. Runtime files are copied from locked npm packages by `scripts/copy-local-ocr-assets.mjs`.
- `@tesseract.js-data/eng`: version `1.0.0`, MIT. Only `4.0.0_best_int/eng.traineddata.gz` is copied.
- Generated files live under `public/vendor/tesseract/v7.0.0/` and are intentionally ignored by Git; `predev`, `prebuild`, and `prepreview` recreate them deterministically from `package-lock.json`.

The application passes explicit `workerPath`, `corePath`, and `langPath` values to Tesseract and disables Worker Blob URL wrapping. Do not remove those paths or replace them with default CDN loading.
