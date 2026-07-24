# Customer Repair Status QR

Status: release candidate
Owner: Integration Lead + Security
Last updated: 2026-07-24 CEST

This is the authoritative product, security and operations contract for repair-order QR codes.

## Product contract

- Every repair order that still exists has one stable QR identity, including new, active, completed, cancelled, voided and soft-deleted historical records.
- Every single or batch customer print page contains exactly one QR for its order. A missing QR is a preparation failure and must stop the print window; printing must never silently fall back to a QR-less document.
- Reprinting the same order returns the same QR. Only an explicit owner reset or a store lifecycle restore rotates it.
- The printed URL is `https://www.chinatech.in/r#<opaque-token>`.
- An unauthenticated scan shows only the customer-safe public progress page. The page contains no employee login button.
- An authenticated and authorized scan automatically opens `/orders/<id>?from=orders`. Cross-store users, unauthorized roles and technicians not assigned to the order remain on the same public page.
- Public resolution of voided or soft-deleted records is unavailable. Authorized employees may still open their internal historical detail. Physically deleted records no longer have a QR identity.
- Existing legacy 43-character random QR links continue to resolve under their original expiry, revocation and lifecycle rules.

## Privacy and security contract

- Stable tokens use `v2.<key-version>.<random-public-id>.<generation>.<full-HMAC-SHA256>` with Base64URL/base36 encoding.
- The token contains no order UUID, store UUID, customer data, phone, IMEI, password, diagnosis, finance or internal route.
- The database stores the random public locator and generation metadata, not the complete bearer token or signature. The signing keyring is server-only.
- `CUSTOMER_STATUS_QR_HMAC_KEYS` must be a dedicated versioned JSON keyring. Each key is at least 32 random bytes encoded as Base64URL. It must never reuse the Supabase service-role key or the rate-limit secret.
- `CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION` identifies the version for newly created/reset identities. Retain previous keys while their printed QR codes must remain valid.
- Production also stores the non-secret active version in the service-role-only singleton `customer_status_qr_key_config`. Its value and `CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION` must match. Key rotation first adds the new key to the application keyring, then changes the singleton in a reviewed additive migration; existing identity rows keep their original key version.
- Parsing is strict; HMAC comparison is constant-time; token, URL and signature values must never be logged or written to task memory.
- `/r` removes the fragment before making requests. Public responses remain `no-store`, `no-referrer`, `noindex`, `nosniff` and frame-denied.
- The public DTO remains limited to public order number, device label, simplified stage, progress, update time, next action and public store contacts.
- Existing atomic IP/global/token rate limiting remains mandatory. Raw IPs, tokens and user agents are not stored.
- The identity and legacy link tables are RLS-enabled and service-role-only. Employee routing still checks login, active store lifecycle, same-store membership, `order:detail` and technician assignment.

## Data contract

Migrations:

- `20260720190759_repair_order_customer_status_links.sql`: legacy hash-only links and rate limiting.
- `20260724071717_fixed_order_customer_status_qr.sql`: stable identities, full historical backfill, future-order trigger, reset RPC and lifecycle-restore rotation.

`repair_order_customer_status_identities` has one row per existing `repair_orders` row. A composite foreign key enforces same-store integrity and cascade removal after a physical order delete. It is not client-readable. The service-role-only singleton `customer_status_qr_key_config` supplies the active non-secret key version to the historical backfill, future-order trigger and explicit reset RPC; no key bytes are stored in Postgres.

`repairdesk_ensure_customer_status_identities_v2` is a service-role-only, permission-prechecked application RPC used to repair any unexpected identity gap and return metadata for up to 50 orders. Normal repeat printing does not rotate or insert a new identity.

`repairdesk_rotate_customer_status_identity_v2` atomically changes the public locator and generation, revokes still-active legacy links and writes a redacted audit event. Rotation requires the existing owner-level order-void permission and one fixed reason.

When a store is restored to a new active lifecycle revision, every stable identity for that store rotates. QR codes printed before closure therefore stay invalid after restoration.

## Application and print contract

| Surface                                               | Access                 | Contract                                                                                                     |
| ----------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/api/repairdesk/customer-status-links/issue`         | authenticated staff    | Return deterministic stable URLs after same-store/object checks; batch additionally needs export permission. |
| `/api/public/order-status`                            | public                 | Resolve legacy or stable tokens to the fixed safe DTO.                                                       |
| `/api/repairdesk/customer-status-links/staff-resolve` | authenticated staff    | Return only an authorized relative internal detail path.                                                     |
| `/api/repairdesk/customer-status-links/revoke`        | owner-level permission | Reset the stable QR and invalidate prior stable/legacy copies.                                               |
| `/r`                                                  | public                 | Remove fragment, load public progress and silently auto-route authorized logged-in staff.                    |

The fixed QR is a core print requirement, not a feature-flag enhancement. The legacy `CUSTOMER_STATUS_QR_ENABLED` variable no longer disables issuance or resolution. All print entry points must:

1. remain clickable for every existing order business state;
2. prepare all stable URLs before mounting print DOM;
3. stop with a visible retryable error if any URL is missing;
4. call `window.print()` only after every rendered order page has exactly one QR;
5. reject duplicate clicks while preparation or print preview is active.

## Release and rollback

Release order:

1. Validate migration SQL, backfill counts, RLS/grants and service-role RPC access.
2. Configure the dedicated version-1 HMAC keyring and independent rate-limit secret in Production without recording values.
3. Apply the migration and verify identity count equals repair-order count with zero same-store violations.
4. Deploy the exact reviewed Git SHA and verify the production aliases.
5. Smoke-test active and historical print preparation, anonymous public scan, authorized auto-route, unauthorized fallback and legacy QR compatibility using non-sensitive test data.

Rollback is forward-compatible: promote the previous compatible application only if it does not encounter v2 QR print paths, otherwise ship a forward fix that keeps v2 resolution. Retain the additive identity table and legacy history; do not drop or rewrite production data. A compromised signing key requires adding a new key version and explicitly rotating affected identities, not deleting orders.

## Verification gate

Required evidence: lint, typecheck, full tests, production build, migration advisor review, one-QR-per-page print assertions, stable repeat-token test, tamper test, legacy resolution test, public safe-projection test, staff authorization tests, browser screenshots and a physical shop-device scan/print confirmation after deployment.
