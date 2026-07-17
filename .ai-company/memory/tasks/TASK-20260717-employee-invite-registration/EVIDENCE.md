# Evidence

## Baseline

- Isolated branch: `codex/employee-invite-registration-20260717` at `origin/main` `1f643313`.
- Primary worktree was left unchanged because it was ahead 1, behind 10, with extensive unrelated changes.
- FLOW/UX baseline targeted tests: 5 files, 30 tests passed.
- SEC/QA baseline targeted tests: 6 files, 162 tests passed.

## External primary sources checked

- Supabase Users/Inviting Users and `inviteUserByEmail` behavior.
- Supabase Email Templates, SSR `token_hash + verifyOtp`, prefetch and link-tracking limitations.
- Supabase `signInWithOtp` existing/new-user behavior.
- Supabase 2026-06-03 free-tier email-template restriction.

## Implementation evidence

- New/existing-user delivery split: `src/features/stores/server/store-invitation-email.ts` and 6 focused tests.
- Prefetch-safe confirmation: `/auth/confirm` GET plus same-origin `/auth/confirm/complete` POST; route tests cover token type/hash, internal next and no-store redirect.
- Dedicated completion UI: `/invite/complete` and `InviteRegistrationScreen`; component tests cover new-account password/profile flow, existing-account accept and account mismatch.
- Atomic authorization: `repairdesk_accept_store_invitation_rpc` rechecks active store, optional lifecycle state, current Auth email, invitation state/expiry/non-owner role, then membership/invitation/audit in one transaction under the store advisory lock.
- Settings shows delivery state and resend/revoke. Mock mode records `sent` state for responsive browser verification.

## Quality and visual evidence

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: 217 files / 1484 tests passed. One unrelated settings input timing failure appeared once in a parallel run, then its 20-test file and the full suite passed on immediate serial rerun.
- `npm run build`: passed outside the port-restricted sandbox; 24 routes generated including `/auth/confirm`, `/auth/confirm/complete` and `/invite/complete`.
- Desktop and mobile local mock flow showed `邮件已发送`, resend/revoke and no layout overflow.
- Screenshots: `screenshots/TASK-20260717-employee-invite-registration/settings-invite-sent-desktop.png`, `settings-invite-sent-mobile.png`, `auth-confirm-mobile.png`, `invite-registration-mobile.png`.

## Production evidence

- Linked dry-run initially contained only `20260717220219_employee_invite_email_delivery.sql`.
- Post-apply lint exposed two RPC definition issues; three immutable forward migrations corrected the dynamic optional lifecycle lookup and named the membership uniqueness constraint. Final linked history aligns through `20260717223354`; final `supabase db lint --linked --level error` reports no schema errors.
- Final schema-only dump confirms delivery columns/checks/index and `repairdesk_accept_store_invitation_rpc` granted to `service_role` with PUBLIC revoked.
- Supabase project is `ACTIVE_HEALTHY` on Pro. Hosted Site URL, production redirect and both custom templates are applied; original TOTP, 8-digit OTP, one-minute frequency and v0 callbacks were preserved.
- Vercel Production variables `NEXT_PUBLIC_SITE_URL` and `REPAIRDESK_EMAIL_INVITES_ENABLED` were added without exposing secrets.
- GitHub `origin/main` is `3469512fe92248799f1303bd219c5297e32de820` (`66f2cd82` feature plus `3469512f` canonical production origin fix).
- The first production smoke exposed an invalid provisional `chinatech-codex.vercel.app` origin. Vercel and hosted Supabase Auth were corrected to `https://www.chinatech.in`; both canonical and bare-domain redirect patterns are now allowed.
- Final Vercel deployment `dpl_7H7J8Poo9usmGkcXqaZWJGKnHmFs` is Ready. `vercel inspect https://www.chinatech.in` resolves to that deployment and lists both custom-domain aliases.
- Production `GET /auth/confirm` returns 200 with `Cache-Control: private, no-cache, no-store` and `Referrer-Policy: no-referrer`. Unauthenticated `GET /invite/complete?...` returns the expected 307 login redirect.
- Residual external check: no real employee inbox address was supplied, so actual inbox delivery and spam placement remain unverified; dedicated custom SMTP is still recommended before higher-volume use.
