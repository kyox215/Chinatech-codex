# Scan Search Payloads

Status: active
Owner: Frontend + Integration Lead
Last reviewed: 2026-07-20 CEST

This document defines the first supported QR/barcode payloads for RepairDesk scan search.

## Rules

- Scan payloads are lookup/navigation inputs only. They do not bypass authentication, permissions, store isolation, or server-side validation.
- Do not encode customer names, phone numbers, full fault descriptions, payment notes, photos, secrets, or other unnecessary PII in QR codes.
- Internal URLs and short prefixed payloads are preferred over large JSON payloads.
- External URLs are not opened automatically by the scan search resolver.
- Smart repair links are a dedicated sensitive payload. They must route only through `/r`, must never become a generic search value, and their token must not be rendered, copied, logged, cached in a query key or persisted in list state.

## Supported Payloads

| Entity         | Preferred payload                                       | URL form                                    | Result                                                                                                       |
| -------------- | ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Repair ticket  | smart print link `/r#<opaque-token>`                    | `https://www.chinatech.in/r#<opaque-token>` | Show the customer-safe repair status; authorized staff can resolve the same token to the internal task page. |
| Order task     | internal navigation only `/orders/{orderId}/task`       | `/orders/{orderId}/task`                    | Open an authenticated internal task page; this form is not printed.                                          |
| Order detail   | `order:{orderId}`                                       | `/orders/{orderId}`                         | Open order, or search the scanned value.                                                                     |
| Customer       | `customer:{customerId}`                                 | `/customers/{customerId}`                   | Open customer, or search the scanned value.                                                                  |
| Inventory item | `inventory:{itemId}`                                    | `/inventory?item={itemId}`                  | Open focused inventory item, or search the scanned value.                                                    |
| Buyback record | `buyback:{recordId}`                                    | `/buyback?id={recordId}`                    | Open/focus buyback record when available, or search the scanned value.                                       |
| IMEI           | `imei:{imei}` or raw IMEI barcode                       | none                                        | Search current module or route to module search from global scan.                                            |
| Serial         | `serial:{serial}` / `sn:{serial}` or raw serial barcode | none                                        | Search current module or route to module search from global scan.                                            |

## Route Query Semantics

- `/orders?q=value` fills order search.
- `/customers?q=value` fills customer search.
- `/buyback?q=value` fills buyback search.
- `/inventory?q=value` fills inventory search.
- `/inventory?item=itemId` focuses an inventory record when present; otherwise the value becomes the inventory search term with an operator-visible fallback notice.
- `/buyback?id=recordId` focuses a buyback record when present; otherwise the value becomes the buyback search term.

## Smart Repair Ticket QR

- Printed repair tickets contain exactly one `/r#<opaque-token>` QR per order. The token is random, does not encode an order ID or customer data, and remains in the URL fragment so it is not sent in the initial HTTP request URL.
- `/r` is a public, shell-free status page. It removes the fragment from browser history immediately, then exchanges the token through a private `no-store` POST request.
- The public response is a fixed customer-safe projection. It never returns customer identity, IMEI/serial, diagnosis, internal notes, technician data, attachments, finance, costs, unlock data or internal UUIDs.
- The same page offers an employee entry. The server returns an internal task route only after authentication, active-store checks and the normal order-detail/technician-assignment permission check.
- Printed smart links are resolved by the server. Do not add client-side decoding, order identifiers, internal paths or PII to the QR payload.
- The in-app scanner accepts the exact `/r#<token>` path from the current origin and the two approved production aliases `https://www.chinatech.in` and `https://chinatech.in`. Lookalike hosts, query strings, missing fragments and malformed tokens are rejected.
- Scanning the smart link offers one action, “查看此订单”. `/r` remains the single identity split: authorized same-store staff are routed to internal detail; everyone else stays on the customer-safe public projection.
- The authoritative implementation and operations contract is [CUSTOMER_REPAIR_STATUS_QR.md](./CUSTOMER_REPAIR_STATUS_QR.md).

## Approval Points

- Changes to the public projection, token lifetime, canonical public origin, permission rules, database schema or public lookup routes require owner approval plus privacy/security review.
- External OCR or paid recognition services require a separate vendor/privacy decision.
