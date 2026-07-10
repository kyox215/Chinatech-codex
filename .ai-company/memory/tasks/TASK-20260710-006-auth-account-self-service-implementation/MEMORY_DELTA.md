# Memory Delta — TASK-20260710-006-auth-account-self-service-implementation

## Durable Notes

- Account self-service P1-P3 were implemented on 2026-07-10 without requiring a database migration.
- `/account` is the source of truth for password/email/account security actions; Settings links into it.
- Registration and forgot-password redirects should use `buildAuthCallbackUrl()` and `safeAuthNextPath()` from `src/features/auth/model/auth-redirect.ts`.
- Onboarding status now includes `emailVerified` for user-facing security state.

## Future Work

- P4: add abuse protection/audit hygiene if public signup/reset abuse appears or before broader rollout.
- P5: add owner/manager/platform-admin MFA and session-management controls after basic email/password flows stabilize.
