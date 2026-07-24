# Repair Order A5 Print Contract

Status: implemented
Owner: Hexiang Huang / 鹤祥
Last verified: 2026-07-24

## Decision

Repair order printing provides four explicit, mutually exclusive fixed-PDF modes. All four capture and reuse the exact same A5 landscape ticket content and two-column layout.

1. `A5 横向` (default): a 210×148mm A5 landscape physical page.
2. `A4 横向铺满`: a 297×210mm A4 landscape page. The complete ticket is enlarged proportionally to fill A4 without reflow.
3. `A4 上半裁切`: a 210×297mm A4 portrait page. The unchanged A5 ticket occupies the upper half, a cut line is drawn at 148.5mm, and the lower half stays blank.
4. `A4 双联`: a 210×297mm A4 portrait page containing two identical complete tickets, separated by the 148.5mm cut line.

The application renders the existing print component at 3× resolution and embeds it into a PDF with an explicit physical MediaBox. Chrome and printer drivers receive an already composed page, so they cannot reflow the two columns or reinterpret the selected orientation. The 3× capture is the quality floor and may not be reduced as a performance shortcut.

PDF generation stays on the active order page. A loading toast reports QR preparation and PDF rendering. For single-order printing only, the generated 3× ticket image is cached in bounded page memory and reused across the four paper compositions; the final PDF is also cached by store/order scope, content fingerprint and paper mode. Batch output is never cached. Changing store, order or QR content invalidates reuse, while leaving the page clears the cache. No PDF or customer data is persisted by this optimization.

Delivery is device-aware:

- Desktop browsers first use the hidden same-page PDF iframe and native `print()` flow. If the browser rejects that path, the same visible recovery dialog is shown.
- Mobile/iPad browsers do not depend on iframe `contentWindow.print()`. After generation they show `PDF 已准备好`; the user's explicit second click invokes native file sharing so iOS/Android can offer Print, AirPrint, Save or Share while user activation is still valid.
- If native file sharing is unavailable or rejected, `查看/打开 PDF` and `下载 PDF` remain visible. Opening uses the current tab, avoiding an intermediate `about:blank` rendering tab.
- Closing the system share sheet is treated as cancellation, not as a print failure. The application only reports that the system menu opened; it never claims that physical printing completed.

The client emits `repairdesk:fixed-pdf-ready` cache state plus QR preparation, layout readiness, PDF generation and end-to-end timing details for QA. A representative warm/cache-hit single-order flow, measured from paper selection through PDF ready, has a target of less than 2 seconds. Cold capture time is measured separately and must retain progress feedback; the target never permits lowering the 3× quality floor.

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

For A5 paper, select `A5 横向`. For A4 choose `A4 横向铺满`, `A4 上半裁切`, or `A4 双联` according to the required physical output. In the native print dialog keep one page per sheet and 100% / actual size; the PDF already contains the correct layout.

## Verification

- Unit coverage verifies desktop iframe cleanup, mobile/iPad routing, native share cancellation, unsupported-share recovery controls, mutually exclusive A5/A4 page CSS and bounded fit decisions.
- Browser PDF verification must assert one page per order and physical page dimensions for all four modes.
- Mobile browser verification must assert that no PDF print iframe is created, the visible ready dialog appears, the native share call happens only after a second user click, and a repeated print reports a cache hit below the 2-second target.
- Release verification covers Chromium and WebKit desktop/mobile viewports. Real printer-driver verification remains an operational check because browser automation cannot control HP/Windows/iOS native print dialogs.
