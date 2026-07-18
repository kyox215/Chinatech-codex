# Phase 2 Micro Plan — Vision to Editable Inventory Draft

## Current status

| Microstep | Status | Evidence |
|---|---|---|
| 2A — Contract and deterministic merge | completed | 10 focused tests and `npm run typecheck` passed |
| 2B — Safe local image preparation and recognition | completed | 10 focused tests and `npm run typecheck` passed; no dependency/provider call |
| 2C — Bounded fake vision BFF | completed | 61 focused contract/service/route/client tests and `npm run typecheck` passed |
| 2D — Controlled intake form and field review UI | completed | 66 focused tests/typecheck plus 4/4 Playwright at 390/430/1280 passed; sanitized screenshots captured |
| 2E — Independent review and checkpoint | completed | Full gates, P0/P1 reconciliation, documentation, masked screenshots and 2026-07-18T16:01:00Z checkpoint complete |

## Non-negotiable boundary

- Only synthetic fixtures or an employee-selected local image are processed.
- The original image, filename, OCR text and full identifiers are never logged, persisted, committed or copied into task memory.
- No `sharp` install, OpenAI external call, Storage write or inventory/order/draft/image business mutation occurs during recognition/review/apply-to-form. The only intentional persistence is the existing allowlisted, aggregate-only security audit event.
- The existing `createInventoryIntake` mutation runs only after the employee returns to the ordinary form and presses `保存商品`.
- Manual values win conflicts by default; explicit per-field overwrite is required.

## 2A — Contract and deterministic merge

Deliver:

- Extend strict recognition contracts with source, identifier validation and structured conflicts.
- Add conservative local label parsing, Luhn/EAN validation, evidence deduplication and provider/local merge.
- Add form-application helpers that map only brand/model/color/storage/one confirmed primary identifier; RAM and extra identifiers remain visibly unmapped.

Exit:

- Unit tests cover Redmi sample-shaped OCR, multiple/invalid identifiers, conflicts, manual-value preservation and explicit overwrite.
- Reread this file and the Phase 2 section of the master plan before 2B.

## 2B — Safe local image preparation and recognition

Deliver:

- JPEG/PNG/WebP MIME + magic validation, 4 MiB original limit, real browser decode, 4096px/16MP limits, animated PNG/WebP rejection and metadata-stripping canvas re-encode.
- Derived image capped for the BFF; object URLs revoked on replace/close.
- Native browser TextDetector and bundled ZXing provide ephemeral OCR/barcode evidence; raw evidence is discarded after parsing. Tesseract fallback stays disabled until fixed-version same-origin assets and CSP/network assertions are approved.

Exit:

- Unit tests cover allowed/rejected magic, MIME mismatch, animation, size/dimension and cleanup behavior.
- No new dependency and no network provider call in local-recognition tests.
- Reread this file and the Phase 2 section of the master plan before 2C.

## 2C — Bounded fake vision BFF

Deliver:

- Auth-before-parse JSON route with a derived-image request cap.
- Capability/store/permission/quota gates, strict derived-image validation, provider protocol parsing, safe failure mapping and allowlisted audit.
- Fake provider integration only. `openai` remains fail-closed until server decode/dependency/privacy/budget gates pass.

Exit:

- Contract/service/route tests cover success, disabled, cross-scope permission, malformed image, provider failure, audit failure and no secret/PII error leakage.
- Reread this file and the Phase 2 section of the master plan before 2D.

## 2D — Controlled intake form and field review UI

Deliver:

- Extract the oversized `IntakeDialog` into a controlled feature component.
- Keep capture and review in the same Dialog step stack; no nested modal.
- Show image safety state, field value/source/confidence/conflict, accept/edit/clear/reject, primary identifier selection, unmapped RAM/extra identifiers and label-claim warning.
- `AI_DRAFT_APPLY_ENABLED=0` supports shadow review only; enabled fake/E2E mode applies confirmed mapped fields to the current form without saving.

Exit:

- Component tests prove recognition and draft application do not call `createInventoryIntake`; only `保存商品` does.
- 390/430/1280 no-overflow, keyboard/focus, offline, cancel and store-authority reset checks pass.
- Reread this file and the full master plan before 2E.

## 2E — Independent review and checkpoint

Deliver:

- Product/UX, Architecture/API and Data/Security/QA/Release read-only reconciliation.
- Targeted tests followed by full lint/typecheck/test/Webpack build and focused Playwright.
- Sanitized screenshots, runbook/env updates, Evidence/Handoff/Memory Delta and `$memory-checkpoint`.

Exit:

- No P0/P1 finding remains for the default-off/fake/page-memory slice.
- Real external image processing and production draft persistence remain explicitly blocked unless Owner gates change.
