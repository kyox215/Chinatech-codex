# Implementation plan

1. Add delivery metadata and an atomic invitation-accept RPC.
2. Add trusted server email delivery that uses Auth Invite for new users and Magic Link for existing users, with safe fallback only for an explicit existing-user response.
3. Add a prefetch-safe SSR confirmation page/POST and Supabase local invite/magic-link templates.
4. Add a dedicated invitation completion screen for new/existing users and update the Settings invitation controls.
5. Add unit, repository, route, schema, UI and migration tests.
6. Update the auth/account plan and production runbook.
7. Run full quality/security/data gates, linked migration dry-run/apply where safe, browser screenshots, then scoped commit and main push.

# Rollback

- Code rollback: revert the scoped feature commit.
- Migration is additive. During rollback, old application code ignores new nullable/defaulted delivery columns and the new service-role-only RPC.
- Disable email delivery with `REPAIRDESK_EMAIL_INVITES_ENABLED=false` without removing invitations or memberships.
- Never delete Auth users as rollback.
