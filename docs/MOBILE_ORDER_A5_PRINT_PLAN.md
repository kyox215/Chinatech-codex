# Repair Order A5 Print Contract

Status: implemented
Owner: Hexiang Huang / 鹤祥
Last verified: 2026-07-24

## Decision

Repair order printing provides two explicit, mutually exclusive fixed-PDF modes. Both capture and reuse the exact same A5 landscape ticket content and two-column layout.

1. `A5 横向打印` (default): a 210×148mm A5 landscape physical page.
2. `A4 对半裁切`: a 210×297mm A4 portrait physical page. The unchanged A5 ticket occupies the upper half, a cut line is drawn at 148.5mm, and the lower half stays blank.

The application renders the existing print component at 3× resolution and embeds it into a PDF with an explicit physical MediaBox. Chrome and printer drivers receive an already composed page, so they cannot reflow the two columns or reinterpret the selected orientation.

## Content stability

- Existing fields, order, Italian wording, warranty text, QR position and left/right structure remain unchanged.
- Long values wrap inside their current field.
- The complete ticket may scale uniformly through bounded steps (100%, 90%, 80%, 72%), preserving relative positions.
- Content requiring less than 72% is rejected before print preview with a request to shorten notes. It is never silently clipped, ellipsized or split into a second ticket.
- Every business status remains printable and every printed ticket requires its fixed customer-status QR.

## Scope

- Applies to order detail, task and order list/bulk printing.
- Does not change inventory receipts or other non-order print surfaces.
- Does not change order data, payment, status, notification, permissions, QR identity or database schema.

## Operation

For A5 paper, select `A5 横向打印`. When only A4 is loaded, select `A4 对半裁切` and cut on the dashed line. In the native print dialog keep one page per sheet and 100% / actual size; the PDF already contains the correct layout.

## Verification

- Unit coverage verifies mutually exclusive A5/A4 page CSS, cleanup and bounded fit decisions.
- Browser PDF verification must assert one page per order and physical page dimensions for both modes.
- Release verification covers Chromium and WebKit desktop/mobile viewports. Real printer-driver verification remains an operational check because browser automation cannot control HP/Windows/iOS native print dialogs.
