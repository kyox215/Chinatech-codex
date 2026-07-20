# Customer Repair Status QR

Status: active
Owner: Integration Lead + Security
Last verified: 2026-07-20 CEST

This document is the authoritative product, security and operations contract for the QR printed on customer repair tickets.

## User contract

- Every standard or batch-printed repair ticket has exactly one smart QR for that order.
- The printed value is `https://www.chinatech.in/r#<opaque-token>`. This is the fixed platform gateway; the customer page itself is white-label and displays the issuing store's public name.
- Customers see only the public order number, device label, simplified repair stage, progress, last update, next action and public store contact information.
- Authorized staff can use the same page to open the internal order task. Login, current-store membership, order permission and technician assignment rules still apply.
- Invalid, expired, revoked, deleted/void-order and inactive/closed-store links use the same unavailable response.
- Reprinting an order rotates and revokes its previously active smart links before issuing the new QR. Store owners can also use the order action “停用已打印二维码” when a paper copy or photo may have leaked.

## Privacy and security contract

- Tokens are 32 cryptographically random bytes encoded as a 43-character Base64URL value. They do not contain an order ID, customer data or internal route.
- The raw token exists only in the issuance response, printed QR, browser fragment and short-lived employee-login session storage. The database stores only its SHA-256 digest.
- `/r` removes the fragment with `history.replaceState` before resolving it. Public resolution uses a same-origin JSON POST with private `no-store`, `no-referrer`, `noindex`, `nosniff` and frame-deny headers.
- The public API uses an explicit safe projection. Never add customer name, contact identity, IMEI/serial, diagnosis, notes, attachments, technician, finance, cost, unlock data, order UUID or store UUID without a new owner-approved privacy review.
- Public requests use one atomic front-door limiter: it first locks and rejects an already saturated global window without creating an IP row, otherwise consumes the trusted-platform-IP counter and only then global capacity. Live links receive a final token counter. Thus one IP cannot drain global capacity after its own limit, while globally blocked traffic cannot grow the IP table. Raw IP addresses, tokens and user agents are not stored. Counters saturate, stale rows become eligible for bounded cleanup after 24 hours, and invalid tokens never create token-scope rows.
- `anon` and `authenticated` roles have no direct access to the link or rate-limit tables. Server-only service-role access is required.
- Employee resolution returns only a relative internal task path after authentication, same-store validation and normal scoped `order:detail` authorization.

## Data contract

Migration: `supabase/migrations/20260720190759_repair_order_customer_status_links.sql`

- `repair_order_customer_status_links` stores the order/store relationship, the active store-lifecycle revision, token digest, expiry, revocation and minimal actor timestamps. A composite foreign key prevents cross-store links; a link also becomes permanently unavailable after its store is closed, even if that store is later reopened.
- `customer_status_rate_limits` stores only HMAC-derived scope keys and bounded counters.
- `repairdesk_consume_customer_status_rate_limit_v1` atomically consumes a saturated counter, performs bounded retention cleanup at a global-window reset, and is executable only by `service_role`.
- `repairdesk_issue_customer_status_links_v1` and `repairdesk_revoke_customer_status_links_v1` lock their order rows and commit link rotation/insertion or revocation together with the audit record. A partial unique index allows only one unrevoked link per store/order, including under concurrent print requests.
- The migration is expand-only and performs no historical backfill. Existing links expire automatically and may be revoked without dropping data.
- Expired or revoked link rows are retained for 90 days after becoming inactive, then removed by the bounded cleanup path.

## Application contract

| Surface                                               | Method | Access                   | Purpose                                                                         |
| ----------------------------------------------------- | ------ | ------------------------ | ------------------------------------------------------------------------------- |
| `/api/repairdesk/customer-status-links/issue`         | POST   | authenticated staff      | Issue one or a bounded batch of print links after order permission checks.      |
| `/api/public/order-status`                            | POST   | public                   | Return only the fixed customer-safe projection.                                 |
| `/api/repairdesk/customer-status-links/staff-resolve` | POST   | authenticated staff      | Resolve a token to an authorized relative task path.                            |
| `/api/repairdesk/customer-status-links/revoke`        | POST   | owner permission         | Revoke every active link for one same-store order with a fixed, audited reason. |
| `/r`                                                  | page   | public                   | Customer status and employee-entry UI without the RepairDesk application shell. |

`CUSTOMER_STATUS_QR_ENABLED=1` enables issuance and resolution for active stores. Any other value fails closed. The public UI is store-branded from the safe store projection; no store may supply or redirect the bearer-link origin. `CUSTOMER_STATUS_PUBLIC_ORIGIN` is optional and accepts only the exact approved Chinatech HTTPS origins in production. Do not document or commit secrets used by Supabase or rate-limit HMAC derivation.

## Print lifecycle

- Single, task and batch print actions prepare links before mounting print DOM or calling `window.print()`.
- Link issuance is all-or-nothing for a batch. Missing or failed links stop printing and show an operator-visible error.
- Issuance atomically revokes older active links, inserts exactly one new hash-only link per order and writes the audit record. Any failure rolls the full database transaction back and printing remains blocked.
- The print lifecycle ignores a second click while preparation/printing is active and always releases state after `afterprint`, focus return, timeout or preparation failure.
- QR size is 22 mm with error correction and a quiet zone. The A4 half-page layout and normal overflow pagination remain unchanged.

## Release and rollback

Before enabling production:

1. Run linked migration history and confirm local/remote versions align.
2. Run `supabase db push --linked --dry-run` and verify the exact pending set.
3. Apply the reviewed migration, then verify tables, RLS, grants, foreign keys, indexes and function execute privileges.
4. Enable `CUSTOMER_STATUS_QR_ENABLED=1`, deploy the exact reviewed Git SHA, and wait for the production deployment to be ready.
5. Smoke-test the public unavailable response and authenticated issuance boundary without exposing a raw token or real customer PII in logs/screenshots.

Rollback is non-destructive: disable the feature flag or revert the application deployment. Keep the additive tables and existing link rows in place; do not drop or rewrite production data during an application rollback.

## Verification

The release gate covers lint, TypeScript, full Vitest, production build, Chromium and WebKit flows, standard/batch/long PDF page counts, one-QR-per-ticket assertions, fragment removal, consecutive scans, public overflow and Safari repeated-click recovery. Physical QR scan and HP/Safari print preview remain a final device-specific shop check after deployment.
