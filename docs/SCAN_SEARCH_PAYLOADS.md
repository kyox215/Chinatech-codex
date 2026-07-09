# Scan Search Payloads

Status: active
Owner: Frontend + Integration Lead
Last reviewed: 2026-07-09 CEST

This document defines the first supported QR/barcode payloads for RepairDesk scan search.

## Rules

- Scan payloads are lookup/navigation inputs only. They do not bypass authentication, permissions, store isolation, or server-side validation.
- Do not encode customer names, phone numbers, full fault descriptions, payment notes, photos, secrets, or other unnecessary PII in QR codes.
- Internal URLs and short prefixed payloads are preferred over large JSON payloads.
- External URLs are not opened automatically by the scan search resolver.

## Supported Payloads

| Entity | Preferred payload | URL form | Result |
|---|---|---|---|
| Order task | existing print QR `/orders/{orderId}/task` | `https://chinatech.in/orders/{orderId}/task` | Open internal task page, or search the scanned id on the current page. |
| Order detail | `order:{orderId}` | `/orders/{orderId}` | Open order, or search the scanned value. |
| Customer | `customer:{customerId}` | `/customers/{customerId}` | Open customer, or search the scanned value. |
| Inventory item | `inventory:{itemId}` | `/inventory?item={itemId}` | Open focused inventory item, or search the scanned value. |
| Buyback record | `buyback:{recordId}` | `/buyback?id={recordId}` | Open/focus buyback record when available, or search the scanned value. |
| IMEI | `imei:{imei}` or raw IMEI barcode | none | Search current module or route to module search from global scan. |
| Serial | `serial:{serial}` / `sn:{serial}` or raw serial barcode | none | Search current module or route to module search from global scan. |

## Route Query Semantics

- `/orders?q=value` fills order search.
- `/customers?q=value` fills customer search.
- `/buyback?q=value` fills buyback search.
- `/inventory?q=value` fills inventory search.
- `/inventory?item=itemId` focuses an inventory record when present in the current list.
- `/buyback?id=recordId` focuses a buyback record when present; otherwise the value becomes the buyback search term.

## Future Approval Points

- Public customer-facing repair status QR codes require a separate privacy/security review.
- Short-code tables, database indexes, migrations, and public lookup routes require owner approval before production application.
- External OCR or paid recognition services require a separate vendor/privacy decision.
