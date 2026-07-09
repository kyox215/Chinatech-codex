# Mobile Order A4 Half-Page Print Mode

Status: implemented
Owner: Hexiang Huang / 鹤祥
Last verified: 2026-07-10

## Decision

Order printing now uses an A4 portrait compatibility mode while keeping the actual order content at A5 landscape size.

The browser receives an injected print page rule:

```css
@page {
  size: A4 portrait;
  margin: 6mm;
}
```

The rendered ticket remains `210mm x 148mm` minus margins, so it occupies only the upper half of an A4 portrait page. In practice, this lets mobile print dialogs keep their common A4 default while the shop can place A5 landscape paper in the printer.

## Scope

- Applies to order detail print: `RepairOrderPrintSheet`.
- Applies to order list/bulk print: `OrderListPrintSheet`.
- Does not change inventory sale receipt printing or other non-order print surfaces.
- Does not change order data, payment, status, notification, permissions, or database schema.

## Operational Note

Use this mode with A5 paper inserted landscape. If the printer reports a paper mismatch or auto-scales the document, disable fit-to-page / scaling in the printer app when available, or fall back to the standard A5 landscape printer setting.

## Verification

- Unit coverage: `src/features/orders/components/print-portal.test.tsx` verifies A4 portrait print CSS injection and cleanup.
- Visual/physical verification still requires a real iPhone/Android print preview and the shop printer with A5 paper.
