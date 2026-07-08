# Memory Delta — TASK-20260709-002-imei-candidate-selection

## Candidate project facts

- `src/components/imei-scanner-field.tsx` is the shared new-order/order-popover IMEI input path; camera/image/OCR recognition should route through candidate selection, not direct auto-fill. Source: this task implementation. Status: verified.
- Multi-barcode device screens may expose labels such as `IMEI1`, `IMEI2`, `SN`, and `EC-...`; `src/features/capture/model/barcode-parser.ts` now preserves these as candidate labels. Source: owner screenshot and parser tests. Status: verified.

## Candidate department updates

- UX: mobile IMEI dialog needs full-width status text and compact preview height; otherwise action buttons squeeze the status text on 390px-class viewports. Source: Playwright screenshot inspection. Status: verified.
- QA: cover IMEI changes with parser tests, component tests, order popover test, mobile fake-camera E2E, and Chromium/WebKit mobile upload/OCR E2E. Source: EVIDENCE.md. Status: verified.

## Candidate decisions / ADRs

- Decision: even a single high-confidence IMEI from camera/upload is shown as a selectable candidate before committing, because the owner expects confirmation and multi-number selection behavior. Owner: CEO-Orchestrator. Status: implemented.
- Decision: optional browser `BarcodeDetector` is used for still images/current frames before ZXing and TextDetector, because it can return multiple one-dimensional barcodes from one image. Owner: CEO-Orchestrator. Status: implemented.

## Candidate lessons and capability evidence

- Lesson: fake-camera E2E can prove the camera callback path, but screenshot preview may be black after scanner controls stop; candidate UI and field commit are the acceptance evidence. Source: E2E screenshots and test flow. Status: observed.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
