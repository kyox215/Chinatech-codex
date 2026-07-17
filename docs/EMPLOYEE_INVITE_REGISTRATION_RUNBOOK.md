# Employee invite registration runbook

## Supported flow

1. An owner or authorized manager enters the employee email and an allowed role in Settings.
2. RepairDesk stores a pending business invitation and requests delivery through Supabase Auth.
3. New Auth users receive the Invite template. Existing Auth users receive a magic link with account creation disabled.
4. The email opens `/auth/confirm`. A GET only displays a confirmation button; the one-time token is consumed only after the user submits the same-origin POST.
5. New users set their name and password. Existing users explicitly accept the invitation.
6. A service-role-only database RPC verifies the current Auth email, active store lifecycle, pending invitation, expiry and non-owner role, then atomically creates the membership, accepts the invitation and records the audit event.

## Required production configuration

- `NEXT_PUBLIC_SITE_URL=https://www.chinatech.in`
- `REPAIRDESK_EMAIL_INVITES_ENABLED=true`
- Supabase Auth Site URL: `https://www.chinatech.in`
- Redirect allow-list: `https://www.chinatech.in/**` and `https://chinatech.in/**`
- Hosted Invite and Magic Link templates must match `supabase/templates/invite.html` and `supabase/templates/magic_link.html`.
- Before relying on email invitations at scale, configure a production custom SMTP provider, disable provider link tracking, and complete a real inbox smoke test.
- Do not push the local `supabase/config.toml` to hosted Auth without first replacing the local Site URL and preserving the live MFA, OTP and existing redirect settings. Always review the CLI diff before confirming.

## Release gates

1. Run `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build`.
2. Run a linked migration dry-run and review the exact pending migration list.
3. Apply only the reviewed migration, then verify columns, constraints, index, function ownership/grants and migration history.
4. Apply hosted Auth URL/template configuration without placing access tokens in the repository or logs.
5. Smoke test one unused email and one existing verified employee email. Confirm that link prefetch does not consume the token, account mismatch is denied, invitation acceptance is one-time, and no store data is visible before acceptance.

## Recovery

- Application rollback: set `REPAIRDESK_EMAIL_INVITES_ENABLED=false`; owners can still see and revoke pending business invitations.
- Delivery failure: preserve the pending invitation, show `failed`, and use the explicit resend control after fixing SMTP or Auth configuration.
- Database forward fix: do not drop invitation history. Replace the RPC or constraints with a new timestamped migration after a reviewed dry-run.
- Compromised email: revoke the pending business invitation. A consumed Auth link alone does not create store membership.
