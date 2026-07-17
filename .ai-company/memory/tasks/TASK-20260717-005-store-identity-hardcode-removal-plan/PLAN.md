# Complete Plan - Remove Chinatech Hardcoding From Multi-Store Customer Output

## 0. Decision Summary

Recommended direction:

1. Treat Chinatech as one store's data, not the platform default.
2. Create a single store-aware customer output identity contract.
3. Generate customer-facing links from a configured public origin, not from the current browser URL.
4. Fail closed when the current store identity is missing, mismatched, or contaminated by legacy Chinatech defaults.
5. Do not place the Owner's real ChinaTech shop information into defaults, examples, mocks, fixtures, placeholders, docs templates, platform branding, or seed data.
6. Fix local code first, then run a read-only production contamination audit, then apply any production data correction only after Owner approval.

## 1. Product Rules

### Store Output Identity

### No Real ChinaTech Defaults

ChinaTech information is private store data, not product scaffolding.

Forbidden:

- code defaults such as default store name/address/email/domain;
- onboarding placeholders like real ChinaTech names or owner email;
- mock/demo store names that use the real shop;
- test fixtures that use the real address/domain unless the test is explicitly about legacy contamination quarantine;
- documentation examples that present `chinatech.in` as the generic platform URL;
- seed data for new stores.

Allowed:

- the actual ChinaTech tenant row and its own `store_settings`;
- historical migration/evidence references that cannot be rewritten safely;
- quarantine tests that deliberately use the old fingerprint to prove non-default stores are blocked.

Neutral replacements:

- `Demo Repair Store`
- `Centro Riparazioni Roma`
- `Via Esempio 12, Roma`
- `owner@example.com`
- `https://example.test`

Every customer-visible output must resolve this identity before sending, printing, exporting, or generating a QR:

- `store_id`
- `store_name`
- `store_address`
- `store_phone`
- `store_whatsapp`
- `store_email`
- `message_signature`
- `print_footer`
- `public_base_url`
- `identity_status`

`identity_status` states:

- `ready`: output allowed.
- `loading`: block and wait.
- `missing_required_fields`: block and route owner/manager to Settings.
- `store_context_mismatch`: block and reload active store context.
- `legacy_identity_contamination`: block non-default stores using known Chinatech/Floridia defaults.
- `legal_identity_missing`: block legal docs, buyback finalize, and customer contracts.

### Link Policy

Customer-visible links must not use `window.location.href` or `window.location.origin` as the business identity.

Allowed sources, in order:

1. Store-specific verified public domain, if configured and approved.
2. Neutral platform customer portal domain, for example a future `app.repairdesk...` domain.
3. Relative internal path only for internal QR/search flows.
4. No link, when neither domain nor customer-safe public route is available.

Until a neutral domain exists, partner stores should either:

- omit customer links from WhatsApp templates, or
- use a neutral platform domain approved by Owner, not `chinatech.in`.

### Legal / Buyback Policy

Buyback legal text cannot be generated from mutable display settings alone.

For non-Chinatech stores:

- buyback quote messages may use store display identity if they are not legal agreements;
- buyback restricted evidence/finalize must remain off until each store has an approved legal identity package;
- legal text versions must be store/legal-entity scoped, not globally `chinatech-*`.

## 2. Work Packages

### WP-01 Inventory and Classification

Goal: create a complete hardcode inventory.

Files to scan:

- `src/`
- `docs/`
- `supabase/migrations/`
- `.ai-company/`

Classify every hit:

- runtime customer-visible
- runtime staff-visible
- test fixture
- mock/demo data
- historical migration
- active docs
- historical docs
- legal text
- deployment/project identity

Default/example rule:

- Replace generic defaults, placeholders, fixtures and docs examples with neutral fictional values.
- Do not use the Owner's real ChinaTech store data as a convenient fallback.

Exit criteria:

- A table lists every active runtime hit and the planned action.
- Historical migrations are marked "do not edit; forward fix only".

### WP-02 Store Public Identity Contract

Goal: centralize output identity.

Implementation shape:

- Extend or wrap `resolveStoreOutputIdentity`.
- Add a pure helper such as `resolveStoreCustomerOutputContext`.
- Add `public_base_url` to settings only if a data migration is approved; otherwise read from environment/store config and block external links for partner stores.
- Add clear block reasons for missing domain versus missing store profile.

Expected files:

- `src/entities/store/model/store-output-identity.ts`
- `src/features/messages/model/template-renderer.ts`
- settings model/types if a field is added
- tests under `src/entities/store/model/*`

Exit criteria:

- The helper returns one object used by messages, print, QR, receipts, and buyback quote.
- Tests prove non-default stores cannot use Chinatech fingerprint.

### WP-03 Customer Message and WhatsApp Fix

Goal: stop wrong Chinatech links and signatures in outbound customer messages.

Change:

- Replace `window.location.href` in order detail with store-aware link generation.
- Replace `window.location.origin` in customer detail with store-aware public origin.
- Make order/customer templates omit links when no safe public origin exists.
- Keep current `wa.me` open-and-record behavior; do not add auto-send API.

Expected files:

- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/customers/screens/customer-detail-screen.tsx`
- `src/features/orders/model/order-message-templates.ts`
- `src/features/messages/model/template-renderer.ts`
- `src/features/customers/forms/customer-message-dialog.tsx`
- `src/features/orders/forms/notify-dialog.tsx`
- `src/features/orders/forms/approval-request-dialog.tsx`

Exit criteria:

- xutech-like store previews show xutech identity or no link, never Chinatech.
- Chinatech store can still use its own identity.

### WP-04 Print, QR, Receipts and Scan Payloads

Goal: remove Chinatech domain/address from printed and scanned customer artifacts.

Change:

- `RepairOrderPrintSheet` QR uses safe internal path or configured public origin.
- `docs/SCAN_SEARCH_PAYLOADS.md` stops using `https://chinatech.in` as the generic URL form.
- Sale receipts and print profile continue using resolved store identity.

Expected files:

- `src/features/orders/components/repair-order-print-sheet.tsx`
- `src/features/orders/model/order-task-flow.ts`
- `docs/SCAN_SEARCH_PAYLOADS.md`
- print/inventory receipt tests

Exit criteria:

- Non-Chinatech print output contains only that store's configured identity.
- Internal QR scan still routes inside authenticated app and does not bypass permissions.

### WP-05 Staff UI and Onboarding Copy

Goal: remove global Chinatech branding from generic platform screens.

Change:

- Login page becomes neutral RepairDesk platform wording or active-store-aware only after store is known.
- Sidebar subtitle uses active store name from shell context, not `ChinaTech 工作台`.
- Onboarding placeholders use neutral examples like `owner@example.com` and `Centro Riparazioni Roma`.
- Mock/demo store must not use the Owner's real ChinaTech shop identity; use an explicit demo identity unless the mock is specifically testing the real ChinaTech tenant.

Expected files:

- `src/features/auth/screens/login-screen.tsx`
- `src/components/app-sidebar.tsx`
- `src/features/auth/screens/onboarding-screen.tsx`
- relevant tests

Exit criteria:

- A new partner store user never sees Chinatech as the platform brand on generic auth/onboarding surfaces.

### WP-06 Production Data Audit and Repair Plan

Goal: find persisted non-default store rows contaminated with legacy Chinatech settings.

Read-only query pack:

- `store_settings` where non-default `store_id` has `store_name = ChinaTech`, Floridia address, Chinatech signature, or Chinatech footer.
- `message_templates` bodies containing Chinatech/Floridia/Viale Vittorio Veneto/chinatech.in.
- store rows and onboarding rows that use Chinatech only as test/demo names.

Correction flow:

1. Generate preview rows with exact before/after.
2. Owner approves exact store IDs and fields.
3. Apply scoped DML in a transaction.
4. Post-check zero contaminated non-default rows.
5. Record evidence and rollback snapshot.

Exit criteria:

- No production DML happens before explicit approval.
- Repair report distinguishes default Chinatech store from partner stores.

### WP-07 Buyback Legal Identity

Goal: prevent Chinatech legal docs from being used by other stores.

Change:

- Keep restricted buyback legal/finalize feature off for non-Chinatech stores.
- Add a legal identity resolver separate from display identity.
- Plan future `store_legal_profiles` only after legal review.

Exit criteria:

- Non-Chinatech stores cannot finalize with `chinatech-buyback-v1`.
- Quote-only WhatsApp messages may use display identity but must not pretend to be legal agreement text.

### WP-08 Tests, QA and Release

Required local gates for implementation:

- `npm run lint`
- `npm run typecheck`
- targeted Vitest for identity, messages, print, customer messages, onboarding copy
- `npm run test`
- `npm run build`

Required browser checks:

- Chinatech store: WhatsApp preview still has Chinatech identity.
- xutech/non-default store: WhatsApp preview has xutech identity or link omitted.
- Settings recovery warning appears when legacy identity is detected.
- Login/onboarding no longer show Chinatech as global brand.
- Generic examples, placeholders, docs and mock/demo data do not contain the Owner's real ChinaTech shop information.

Release gates:

- No production deploy without Owner approval.
- No production SQL without preview and backup/rollback evidence.
- Post-release smoke must include customer message preview and print preview.

## 3. Approval Points

Owner approval required for:

1. Choose public domain strategy:
   - A: neutral platform domain for all stores.
   - B: per-store custom domain.
   - C: omit customer links until domain strategy is ready.
2. Any production data correction.
3. Any migration adding `public_base_url` / legal profile fields.
4. Any buyback legal reactivation.
5. Production deployment.

Recommended default:

- Short term: omit unsafe external customer links for non-Chinatech stores unless a safe neutral platform origin is configured.
- Medium term: add neutral platform domain and optional per-store verified public URL.

## 4. Rollback

Code rollback:

- Revert helper usage back to prior message generation if tests fail, while keeping fail-closed identity guard.

Data rollback:

- Every production correction must store before-snapshot rows.
- Roll back by restoring exact previous `store_settings` / `message_templates` fields for approved store IDs only.

Release rollback:

- Redeploy previous Vercel production deployment.
- Disable new public link field/feature flag if link generation misbehaves.

## 5. Documentation Updates

Update:

- `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`
- `docs/SCAN_SEARCH_PAYLOADS.md`
- settings/operator guide if store public identity fields change
- project memory after implementation

Do not update:

- historical migrations except through a new forward migration
- historical archive docs unless adding a banner or active supersession note
