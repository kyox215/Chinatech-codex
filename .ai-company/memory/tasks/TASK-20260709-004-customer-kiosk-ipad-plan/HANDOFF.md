# Handoff

## Current State

MVP foundation is implemented locally and validated. Production database migration and deployment were not performed.

## Primary Document

- `docs/CUSTOMER_KIOSK_IPAD_PLAN.md`

## Implemented

1. Kiosk migration draft for device/session tables.
2. Server/client/mock APIs for kiosk devices and sessions.
3. `/kiosk` customer page and `/api/kiosk/*` public token-based routes.
4. Settings page iPad management.
5. Order detail and QR task page pickup-confirmation push to active iPad.
6. Public route/provider bypass so kiosk is not behind staff login or AppShell.
7. Validation and screenshots.

## Recommended Next Implementation Order

1. Apply the migration through the approved Supabase path after owner approval.
2. Add staff review/accept/return UI and canonical customer/order mutation.
3. Persist signature images as order attachments and pickup evidence fields.
4. Add `/orders/new` intake session push with staff-reviewed auto-fill.
5. Replace polling with store-scoped realtime invalidation when session state changes.
6. Finalize legal/privacy wording and production rollout checklist.

## Risk Notes

- Treat implementation as R3 because of customer PII, signatures, device tokens, and order completion.
- Pickup signature is not mandatory for MVP completion; missing signature should trigger strong warning plus staff override/audit.
- Do not expose full staff account/session to the iPad customer mode.
- Do not put PII or signature payloads into realtime events.
- Legal/privacy text must be approved by the owner before production customer use.
- Current implementation uses polling and logs submission events without putting customer PII into realtime payloads.
