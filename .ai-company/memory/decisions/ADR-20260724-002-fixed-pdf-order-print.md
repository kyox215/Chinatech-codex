# ADR-20260724-002: Fixed PDF artifacts for repair-order printing

Status: accepted by Owner request

## Context

Browser CSS `@page` correctly produced A5/A4 files in automation, but Chrome plus physical printer drivers could override paper orientation and scale, producing the same small top-left ticket for both choices.

## Decision

Repair-order print entry points render the existing print DOM into a 3× raster image and embed it into a client-generated PDF with an explicit MediaBox:

- A5 landscape: 210×148mm.
- A4 landscape full: 297×210mm, with the ticket enlarged proportionally.
- A4 portrait half-cut: 210×297mm, identical ticket at 6mm from the top/left and a cut line at 148.5mm.
- A4 portrait duplicate: 210×297mm, with two identical complete tickets and the same cut line.

PDF generation remains in the active order page. The completed blob is loaded into a hidden same-page iframe and printed with `iframe.contentWindow.print()`, then removed on `afterprint` (plus bounded fallback cleanup). A current-page loading toast communicates QR preparation, PDF rendering and preview launch; no visible loading/PDF tab is opened.

## Alternatives

- Continue CSS print: rejected because printer drivers may reinterpret `@page` and scaling.
- Server-side Chromium PDF: rejected for Vercel runtime size, cold-start and browser-binary operational cost.
- Rebuild the ticket with PDF drawing primitives: rejected because it duplicates layout and complicates Unicode font handling.

## Consequences

- The PDF is visually stable and preserves Unicode/QR rendering from the existing DOM.
- Text is rasterized and not selectable; 3× capture is used for print clarity.
- `pdf-lib` and `html2canvas` become production dependencies; production audit must remain clean.
- Native printer drivers can still scale the complete PDF if users choose non-100% settings, but cannot reflow or misalign its internal layout.
- The hidden-iframe path follows the browser printing model and avoids popup blockers; browsers without a usable embedded PDF viewer receive an explicit load-timeout error rather than a blank tab.

## Review condition

Revisit if searchable/selectable PDF text becomes a requirement or if ticket generation exceeds the client latency budget on low-memory phones.
