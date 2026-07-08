# Memory Delta — TASK-20260709-003-imei-overlay-selection

## Candidate project facts

- IMEI scanner component now supports frozen camera/upload previews with optional `BarcodeDetector.boundingBox` overlay selection while preserving ZXing/OCR list fallback. Source: `src/components/imei-scanner-field.tsx`. Status: validated. Owner: frontend. Review trigger: next scanner/capture UI change.

## Candidate department updates

- UX/mobile: candidate state hides manual input and uses a shorter viewport so frame selection, candidate list, confirm, upload, and retry fit in one mobile screen when possible. Source: mobile Safari screenshot under `screenshots/TASK-20260709-003-imei-overlay-selection/`. Status: validated. Owner: UX/frontend. Review trigger: mobile dialog density changes.
- QA: IMEI capture E2E now covers overlay box selection through mocked `BarcodeDetector` bounding boxes across Chromium/WebKit/mobile projects. Source: `tests/e2e/imei-capture-ui.spec.ts`. Status: validated. Owner: QA. Review trigger: barcode/OCR pipeline changes.

## Candidate decisions / ADRs

- Do not require bounding boxes for all scanner results. Use overlay boxes when available, and keep the existing candidate list as canonical fallback for Safari, ZXing-only, OCR, and unsupported-camera scenarios. Status: accepted in implementation. Review trigger: if a new scanner engine guarantees cross-browser coordinates.

## Candidate lessons and capability evidence

- System Python 3.9 cannot run `tools/ai_company.py` because it imports `tomllib`; manual checkpoint update is acceptable fallback, but repo tooling should eventually run under Python 3.11+ or include compatibility import. Source: `python3 tools/ai_company.py checkpoint --help`. Status: observed. Owner: platform/tooling. Review trigger: future task memory CLI use.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
