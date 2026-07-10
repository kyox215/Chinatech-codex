# Evidence Index — TASK-20260710-006-auth-account-self-service-implementation

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | code | Shared auth redirect helper added | `src/features/auth/model/auth-redirect.ts` | added | 2026-07-10T12:41:58Z | Codex |
| E-002 | code | Registration validation and resend state added | `src/features/auth/screens/login-screen.tsx`, `src/features/auth/model/auth-errors.ts` | changed | 2026-07-10T12:41:58Z | Codex |
| E-003 | code | Forgot password redirect uses shared helper | `src/features/auth/screens/forgot-password-screen.tsx` | changed | 2026-07-10T12:41:58Z | Codex |
| E-004 | code | Account center email verification and email-change controls added | `src/features/account/screens/account-center-screen.tsx` | changed | 2026-07-10T12:41:58Z | Codex |
| E-005 | code | Settings account security entry links to account center | `src/features/settings/screens/settings-screen.tsx` | changed | 2026-07-10T12:41:58Z | Codex |
| E-006 | code | Onboarding status includes email verification mapping | `src/lib/repairdesk/types.ts`, `src/features/platform/server/platform.repository.ts`, `src/server/api/repairdesk-router.ts` | changed | 2026-07-10T12:41:58Z | Codex |
| E-007 | test | Targeted auth/platform tests pass | `npm run test -- src/features/auth/model/auth-errors.test.ts src/features/auth/model/auth-redirect.test.ts src/features/platform/server/platform.repository.test.ts` | 32 tests passed | 2026-07-10T12:41:58Z | Codex |
| E-008 | test | Full lint/typecheck/test pass | `npm run lint`; `npm run typecheck`; `npm run test` | passed; 678 tests passed | 2026-07-10T12:41:58Z | Codex |
| E-009 | build | Production build passes after sandbox port-binding workaround | `npm run build` | passed with escalated local execution | 2026-07-10T12:41:58Z | Codex |
| E-010 | database | Linked Supabase migration history synced | `supabase migration list --linked` | local and remote migration IDs match through `20260709235000` | 2026-07-10T12:41:58Z | Codex |
| E-011 | database | No DB migration needed or applied | `supabase db push --linked --dry-run --include-all` | `Remote database is up to date.` | 2026-07-10T12:41:58Z | Codex |
| E-012 | visual | Registration tab visual state | `screenshots/TASK-20260710-006-auth-account-self-service/register-mobile.png` | captured | 2026-07-10T12:41:58Z | Codex |
| E-013 | visual | Login visual state | `screenshots/TASK-20260710-006-auth-account-self-service/login-mobile.png` | captured | 2026-07-10T12:41:58Z | Codex |
| E-014 | visual | Forgot password visual state | `screenshots/TASK-20260710-006-auth-account-self-service/forgot-password-mobile.png` | captured | 2026-07-10T12:41:58Z | Codex |
| E-015 | visual | Account center visual state | `screenshots/TASK-20260710-006-auth-account-self-service/account-mobile.png` | captured with E2E preview auth | 2026-07-10T12:41:58Z | Codex |
| E-016 | visual | Settings account entry visual state | `screenshots/TASK-20260710-006-auth-account-self-service/settings-account-mobile.png` | captured with E2E preview auth | 2026-07-10T12:41:58Z | Codex |

No secrets, raw auth links, recovery tokens, passwords, invite codes, or full customer PII were recorded.
