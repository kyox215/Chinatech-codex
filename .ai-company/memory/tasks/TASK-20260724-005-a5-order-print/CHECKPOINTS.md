# Checkpoint — 2026-07-24 11:25 Europe/Rome

## Verified facts

- A5 PDF: one page, 594.96×420pt (210×148mm).
- A4 half-cut PDF: one page, 594.96×841.92pt (210×297mm), unchanged A5 ticket on upper half and cut line at 148.5mm.
- Existing order fields, order, warranty copy, QR position and two-column content component are shared by both modes.
- `npm run lint`, `npm run typecheck`, 11 targeted print tests and `npm run build -- --webpack` pass.
- Evidence: `screenshots/TASK-20260724-005-a5-order-print/`.

## Decisions

- A5 landscape is the default; A4 half-cut is explicit and uses the same ticket.
- Last paper selection is stored locally per browser.
- Different print portals use an owner stack so only the current mode controls `@page`.
- Direct browser printing without a prepared QR ticket suppresses internal UI and prints an instruction instead of customer/internal data.
- Content uses bounded whole-ticket scaling and blocks clearly oversized input rather than creating a second ticket.

## Open operational risk

- Native Windows printer drivers and iOS/iPadOS AirPrint cannot be controlled by browser automation. Store validation should use actual-size/100%, matching A5 or A4 paper, and scan the printed QR.

## Next action

Released as commit `eea6d341` on `main`. Vercel Production deployment `dpl_FmHbbr7AaRGff5hB4A6bfiP6bt9W` is READY and aliases `www.chinatech.in` / `chinatech.in`; `/orders` returns the expected authenticated redirect. Next operational action is physical Windows/iOS A5/A4 printing and QR scanning in store.
