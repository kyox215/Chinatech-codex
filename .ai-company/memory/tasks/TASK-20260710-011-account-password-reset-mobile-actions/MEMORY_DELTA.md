# Memory Delta — TASK-20260710-011-account-password-reset-mobile-actions

## Candidate project memory

- Account self-service password recovery can be exposed from logged-in Account Center by reusing Supabase `resetPasswordForEmail` and the existing `/auth/callback?next=/reset-password` recovery flow; no RepairDesk app database change is required.
- Visual evidence for account/security flows must use `.test` email addresses and synthetic names, must not trigger real email, and must exclude stale screenshots containing identity-like data.
- Direct component coverage should assert the current normalized email, callback target, missing-email disabled state, mutation pending lock, and safe errors.

## Not promoted yet

- Actual linked Supabase recovery-email delivery remains release-specific evidence and was not promoted from this local package.
