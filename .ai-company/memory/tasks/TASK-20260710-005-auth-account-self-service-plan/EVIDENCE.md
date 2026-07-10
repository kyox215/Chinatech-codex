# Evidence Index — TASK-20260710-005-auth-account-self-service-plan

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | code-read | Existing auth pages include login/register, forgot password, reset password, callback, and account center | `src/features/auth/screens/*`, `src/app/auth/callback/route.ts`, `src/features/account/screens/account-center-screen.tsx` | observed | 2026-07-10T11:13:24Z | Codex |
| E-002 | code-read | Settings account section edits display name only and should link to account center for security actions | `src/features/settings/screens/settings-screen.tsx` | observed | 2026-07-10T11:13:24Z | Codex |
| E-003 | prior-task | Account center/recovery baseline already closed with tests, build, migration, and screenshots | `.ai-company/memory/tasks/TASK-20260709-020-account-center-recovery/TASK.md` and `EVIDENCE.md` | observed | 2026-07-10T11:13:24Z | Codex |
| E-004 | official-doc | Supabase supports reset password, update user email/password, resend confirmation/email change, rate limits, password security, redirect URL rules, CAPTCHA, and MFA | Official Supabase docs linked in `docs/AUTH_ACCOUNT_SELF_SERVICE_PLAN.md` | observed | 2026-07-10T11:13:24Z | Codex |
| E-005 | artifact | Plan document created | `docs/AUTH_ACCOUNT_SELF_SERVICE_PLAN.md` | added | 2026-07-10T11:13:24Z | Codex |
| E-006 | visual | Screenshot not required for this planning task | planning document only; no UI/runtime behavior changed | no screenshot | 2026-07-10T11:13:24Z | Codex |

Do not record secrets, raw auth links, production credentials, or full customer PII.
