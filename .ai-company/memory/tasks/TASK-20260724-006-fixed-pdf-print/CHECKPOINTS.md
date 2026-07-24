# Checkpoint — 2026-07-24 12:58 Europe/Rome

## Verified facts

- Fixed A5 PDF: one page, 595.276×419.528pt (210×148mm).
- Fixed A4 half-cut PDF: one page, 595.276×841.89pt (210×297mm), identical ticket on upper half and cut line at 148.5mm.
- PNG inspection confirms full-width alignment, complete footer, two columns and QR without clipping.
- Chromium fixed-PDF E2E passes; lint, typecheck, 11 related unit tests and webpack production build pass.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Evidence: `screenshots/TASK-20260724-006-fixed-pdf-print/`.

## Decision

Use the existing print DOM as the single layout source, render at 3× with `html2canvas`, and package with `pdf-lib`. A synchronous loading window preserves the user gesture before asynchronous QR and PDF generation.

## Open operational risk

- Repository Playwright config exposes Chromium only; native Windows driver and iPhone/iPad AirPrint remain physical checks.
- Drivers can still scale the whole fixed PDF when non-100% options are chosen, but cannot reflow or misalign its internal layout.

## Next action

Release candidate commit `9bf16da5` is complete and the worktree is clean. It has not been pushed or deployed. Next action requires Owner approval: push to main, deploy Vercel Production, smoke-test, then perform one A5 and one A4 physical print/QR scan.
