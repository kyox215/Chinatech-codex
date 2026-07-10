# Auth And Account Self-Service Plan

Last updated: 2026-07-10
Owner: Hexiang Huang / 鹤祥
Status: P1-P3 implemented on 2026-07-10; email-link registration completion added on 2026-07-10; P4-P5 remain recommendations
Scope: Registration, password recovery, password change, email binding/change, account settings, and auth hardening for RepairDesk

## Executive Summary

RepairDesk already has the first version of account self-service:

- `/login` supports email/password login and registration.
- `/forgot-password` sends Supabase password recovery emails.
- `/auth/callback` exchanges the recovery code and sets a short recovery cookie.
- `/reset-password` updates the password from a recovery session.
- `/account` shows account profile, login email, current store identity, profile phone, and change-password controls.
- `/settings?section=account` currently edits the display name only.

The next step should not be another isolated form. The safer plan is to make `/account` the single account security center, and let Settings link into it. The work should complete the auth lifecycle around verified email, email change/binding, resend verification, stronger registration guidance, abuse protection, audit hygiene, and role-aware security controls.

## Implementation Status — 2026-07-10

Completed in `TASK-20260710-006-auth-account-self-service-implementation`:

- `/login` registration now asks for password confirmation, uses a canonical auth callback redirect, and shows a post-signup email confirmation state with resend support.
- `/forgot-password` now uses the shared safe callback URL helper for password recovery redirects.
- `/account` is now the account security center for profile details, email verification resend, email change request with current-password confirmation, and password changes.
- `/settings?section=account` now links password/email security actions back to `/account` instead of duplicating account security logic.
- Server onboarding status now exposes `emailVerified` so the account center can show verified/unverified state.
- Added unit coverage for auth redirect helpers, email validation/error helpers, and onboarding email verification mapping.
- Supabase linked dry-run returned `Remote database is up to date`; no database migration was required for this implementation.

Still recommended after this implementation:

- P4 abuse protection and audit hygiene, including optional app-side throttling wrappers, CAPTCHA policy, and redacted security audit events.
- P5 role-aware upgrades, especially optional MFA for owners/managers/platform admins and session management.

## Registration Completion Update — 2026-07-10

Completed in `TASK-20260710-007-email-link-registration-completion`:

- Registration no longer treats an immediate Supabase signup session as completed registration.
- Signup and resend confirmation emails now use `/auth/callback?next=/register/complete`.
- `/register/complete` is the verified landing page after the email link callback succeeds.
- Local Supabase config enables email confirmations under `[auth.email]`.

Production configuration requirement:

- Supabase Auth must have email confirmation enabled and must allow the deployed app callback URL.
- Dashboard Auth settings, SMTP, email templates, and redirect allowlists are configuration work, not database migrations.

## Verified Current Facts

Current source evidence:

- Supabase Auth is enabled and local signup is enabled in `supabase/config.toml`.
- Auth UI lives mainly under `src/features/auth/screens/*`.
- Account center lives at `src/features/account/screens/account-center-screen.tsx`.
- Settings account section lives inside `src/features/settings/screens/settings-screen.tsx`.
- Request auth and store context are resolved through `src/server/auth-context.ts`.
- Unsafe RepairDesk API POST requests already pass through `src/server/api/repairdesk-request-guard.ts`.
- Existing account recovery task `TASK-20260709-020-account-center-recovery` closed with lint, typecheck, test, build, linked migration apply, and screenshots.

External reference points:

- Supabase [`resetPasswordForEmail`](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) sends a reset email and redirects back to the app before calling `updateUser({ password })`.
- Supabase [`updateUser`](https://supabase.com/docs/reference/javascript/auth-updateuser) supports updating authenticated user email and password.
- Supabase [`resend`](https://supabase.com/docs/reference/javascript/auth-resend) supports signup confirmation and email-change resend.
- Supabase recommends stronger [password security](https://supabase.com/docs/guides/auth/password-security), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), safe [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), CAPTCHA, and [MFA](https://supabase.com/docs/guides/auth/auth-mfa) for higher assurance.

## Product Principles

1. Registration creates an account, not store access.
2. Store business data remains private until the account has a verified email and an active store membership.
3. Joining a store must not expose store lists, store IDs, owner match results, or membership status to outsiders.
4. Email is the account identity anchor. Changing it must require confirmation and must not silently desync `auth.users`, `staff_profiles`, and `store_memberships`.
5. Security-sensitive UI belongs in one place: `/account`. Settings should expose an account entry card or deep link, not duplicate password/email logic.
6. Password reset and registration messages must avoid account enumeration: public responses should say "if this email is registered..." where appropriate.
7. Audit records should store action metadata and redacted before/after fields, never passwords, raw tokens, recovery links, or invite codes.

## Target Account Flows

### Registration

User enters name, email, password, and password confirmation on `/login`.

Expected result:

- Always show "check your email" and offer resend confirmation after registration submit.
- If Supabase returns an immediate signup session, sign out and keep the user in the email-link completion flow. That state indicates production Auth config should be checked for email-confirmation parity.
- The verification email redirects to `/auth/callback?next=/register/complete`.
- After callback exchange succeeds, `/register/complete` confirms registration completion and continues to onboarding.
- Onboarding still gates store creation, store join, invitation acceptance, and invite-code redemption behind verified email.
- New users see three safe paths: create private store, accept pending invitation, or request to join by owner email/invite code.

### Forgot Password

User opens `/forgot-password`, enters email, and receives a generic success response.

Expected result:

- Recovery email redirects to `/auth/callback?next=/reset-password`.
- Callback exchanges the code server-side and sets a short `repairdesk-password-recovery` cookie.
- `/reset-password` is only reachable with a valid auth session and recovery cookie.
- After password update, clear recovery cookie, sign out, and require fresh login.

### Change Password While Logged In

User opens `/account`, enters current password, new password, and confirmation.

Expected result:

- Use Supabase `updateUser({ current_password, password })` when current-password enforcement is enabled.
- If the Supabase project enables reauthentication nonce, support the `reauthenticate()` + nonce path.
- On success, clear form fields and optionally sign out other sessions if supported by the selected session policy.

### Bind Or Change Email

User opens `/account`, sees current login email and verification status, then requests a new email.

Expected result:

- If current email is unverified, show "resend verification email".
- If changing email, ask for current password or recent reauthentication before submitting.
- Submit `updateUser({ email: newEmail })` with the configured app redirect URL.
- Show pending state until Supabase confirms the email change.
- Sync `staff_profiles.email` and `store_memberships.email` only after the authenticated user email has actually changed.
- Use `resend({ type: "email_change" })` only for the pending new email path.

## Recommended Scope

### P0: Preflight And Configuration Audit

Goal: know the current auth posture before changing behavior.

Deliverables:

- Confirm Supabase production `SITE_URL`, additional redirect URLs, email confirmation, secure email change, password policy, current-password setting, SMTP, rate limits, and CAPTCHA/MFA settings.
- Confirm whether `chinatech.in`, preview domains, and local dev URLs are all intentionally allowed.
- Confirm current `auth.users.email_confirmed_at` behavior against `getRequestActor()` and onboarding gates.
- Create a test account matrix: unverified new user, verified no-store user, invited user, active owner, active manager, active technician, platform-admin-only user.

Approval required:

- Any change in Supabase dashboard production auth settings.
- Any production migration, data backfill, or service-role repair.

### P1: Account Security Center

Goal: make `/account` the authoritative place for self-service account security.

Deliverables:

- Add email status card: current email, verified/unverified badge, last known status, resend verification action.
- Add email change card: new email, confirm new email, current password/reauth requirement, pending email state.
- Keep profile card: display name and contact phone.
- Keep password card: current password, new password, confirmation, strength/help text.
- Add Settings account card that links to `/account` for password/email/security actions.
- Remove or clearly de-emphasize duplicated password update mode in `/login` if it is no longer needed outside recovery.

Tests:

- Component/unit tests for validation, disabled states, generic success text, and error mapping.
- Browser screenshots for `/account` desktop and mobile, plus Settings account section.

### P2: Registration And Verification UX

Goal: make registration understandable without weakening store isolation.

Deliverables:

- Add password confirmation and stronger password guidance to the registration form.
- Add post-signup "check email" state with resend confirmation.
- Add redirect helper that uses the canonical app URL instead of relying only on `window.location.origin`.
- Add user-facing explanation that registration does not open store data until verified email and onboarding are complete.
- Preserve existing onboarding priorities: active store, pending invitation, pending request, rejected/cancelled request, then create/join options.

Tests:

- Unit tests for redirect URL helper and post-login redirect behavior.
- Onboarding tests for unverified email blocking create-store, join request, invite redemption, and invitation acceptance.
- E2E or integration smoke for registration-to-onboarding with a controlled test account where feasible.

### P3: Password Recovery Hardening

Goal: make recovery robust and resistant to link misuse.

Deliverables:

- Keep the recovery cookie short-lived and HTTP-only.
- Handle expired callback links, missing session, and repeated submissions with clear messages.
- Add tests for `safeNextPath`, recovery callback success/failure, recovery cookie clearing, and middleware reset-password guard.
- Ensure no recovery tokens, codes, or full links are logged or audited.

Tests:

- Route handler tests for `/auth/callback`.
- Middleware/proxy tests for `/reset-password` access rules.
- Screenshot for `/forgot-password` and `/reset-password`.

### P4: Abuse Protection And Audit Hygiene

Goal: protect auth flows without blocking normal shop use.

Deliverables:

- Decide whether registration/reset should stay direct-to-Supabase or move behind app API wrappers for local throttling and audit hooks.
- Add or verify CAPTCHA for sign-up and password-reset if public abuse becomes likely.
- Add security audit events for profile update, password change success/failure, email-change request/completion, resend verification, MFA enrollment, and account disable/reactivation.
- Keep audit payloads redacted. Do not store passwords, raw OTPs, raw recovery URLs, raw invite codes, or unnecessary PII.
- Verify rate-limit behavior and user-facing 429 messages.

Tests:

- Security tests for generic external errors and no account enumeration.
- Audit sanitizer tests for forbidden sensitive fields.
- QA test matrix for repeated submissions and rate-limit messaging.

### P5: Role-Aware Security Upgrades

Goal: give higher-risk roles stronger protection.

Recommended order:

1. Optional TOTP MFA for owners, managers, and platform admins.
2. Session management card: current session status and "sign out everywhere" if supported safely.
3. Admin-managed account lifecycle: owner/manager can resend invitations, revoke pending invites, disable members, and see email verification status where appropriate.
4. Optional passkeys later, after basic email/password/MFA flows are stable.

Tests:

- MFA enrollment/authentication tests when enabled.
- Role matrix tests for owner, manager, technician, sales, viewer, and platform-admin-only users.

## Data And API Impact

Likely code areas:

- `src/features/auth/screens/login-screen.tsx`
- `src/features/auth/screens/forgot-password-screen.tsx`
- `src/features/auth/screens/reset-password-screen.tsx`
- `src/features/auth/model/*`
- `src/features/account/screens/account-center-screen.tsx`
- `src/features/settings/screens/settings-screen.tsx`
- `src/server/auth-context.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/features/platform/server/platform.repository.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/types.ts`
- `src/utils/supabase/proxy.ts`

Possible data changes:

- Avoid new auth tables unless needed.
- If email-change pending state must be visible beyond Supabase Auth metadata, add an additive table such as `account_email_change_requests` with hashed or minimized data only.
- If audit coverage expands, update existing audit sanitizer allowlists before writing new payload shapes.
- Any production schema change requires dry-run, DATA/SEC/QA review, backup/restore proof, and owner-approved command set.

## Security Threat Model

Assets:

- Auth sessions, staff identity, login email, store memberships, customer PII, order history, attachments, platform-admin state.

Main attack paths:

- Account enumeration through registration/reset/resend errors.
- Store discovery during onboarding or owner-email join.
- Recovery-link replay or direct `/reset-password` access.
- Email desync between Supabase Auth and app profile tables.
- Weak passwords, credential stuffing, and repeated reset/sign-up attempts.
- Audit/log leakage of tokens, emails, passwords, or invite codes.

Controls:

- Verified-email gates before store creation/join/invite acceptance.
- Generic public errors for reset, resend, and join-owner-email matching.
- Strict redirect allowlist and safe next-path handling.
- Current-password or reauthentication for password/email changes.
- Short-lived recovery cookie plus session requirement.
- Rate limits, CAPTCHA where needed, redacted audit logs, and role-aware MFA.

## Verification Matrix

Required before implementation closeout:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Browser screenshots for login/register, forgot password, reset password, account center, and Settings account entry.
- Manual or automated smoke for: register, verify email, resend verification, forgot password, reset password, logged-in password change, email change request, pending email confirmation, onboarding blocked while unverified.

Production/release gates:

- No production Supabase config change without owner approval.
- No production migration without dry-run and approved command set.
- No customer-facing email template change without reviewed copy in Chinese/Italian/English where applicable.
- No claim of live auth behavior until verified against the target Supabase project.

## Recommended Implementation Order

1. Read-only auth/config audit and test-account matrix.
2. Refactor shared auth helpers: redirect URL, validation, generic messages, resend helpers.
3. Upgrade `/account` email/password cards and Settings account entry.
4. Upgrade registration and verification UX.
5. Add route/unit/component tests.
6. Add screenshots and manual smoke tests.
7. Prepare Supabase dashboard/config approval packet if production settings must change.
8. Only after approval, apply production config/migration changes and run release observation.

## Open Decisions For Owner

These do not block the plan, but they block production behavior changes:

1. Should public registration stay open, or should new staff accounts primarily come from store invitations?
   - Recommendation: keep public registration open, but never grant store data access without verified email plus onboarding/invitation approval.
2. Should owners/managers/platform admins be required to use MFA?
   - Recommendation: optional first, mandatory for platform admins later.
3. Should password reset and registration use CAPTCHA immediately?
   - Recommendation: enable if abuse appears or before public marketing exposure; otherwise start with Supabase rate limits plus generic messages.
4. Should email change sign out all devices?
   - Recommendation: sign out current session after password reset; for email change, require fresh login after confirmation if supported cleanly.

## No-Screenshot Reason

This document is a planning artifact only. It does not change UI or runtime behavior, so no new screenshot is required for this planning task. Future UI implementation tasks must provide screenshots before closeout.

## Sources

- Supabase JavaScript `updateUser`: https://supabase.com/docs/reference/javascript/auth-updateuser
- Supabase JavaScript `resetPasswordForEmail`: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Supabase JavaScript `resend`: https://supabase.com/docs/reference/javascript/auth-resend
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
