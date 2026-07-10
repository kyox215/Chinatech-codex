# Memory Delta — TASK-20260710-007-email-link-registration-completion

## Durable Notes

- Registration completion now uses a verified email link landing page: `/auth/callback?next=/register/complete` then `/register/complete`.
- Registration submit must not route directly into onboarding even when Supabase returns a session; the UI signs out and keeps the user in the email-link completion flow.
- Local Supabase config sets `[auth.email].enable_confirmations = true`.

## Operational Note

- Production email confirmation, callback allowlist, SMTP, and email template settings are Supabase Auth configuration items, not Postgres migrations.
