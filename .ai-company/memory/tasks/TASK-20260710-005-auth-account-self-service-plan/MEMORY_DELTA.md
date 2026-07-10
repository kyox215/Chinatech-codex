# Memory Delta — TASK-20260710-005-auth-account-self-service-plan

## Candidate project facts

- `docs/AUTH_ACCOUNT_SELF_SERVICE_PLAN.md` is the current proposed plan for completing RepairDesk registration, password recovery, password change, email binding/change, and auth self-service hardening.
- Future implementation is auth/permissions-sensitive and should be treated as R3 when changing behavior or Supabase configuration.

## Candidate department updates

- Security: email binding/change must not silently desync Supabase Auth email from `staff_profiles` or `store_memberships`.
- Product: `/account` should be the primary account security center; Settings should deep-link rather than duplicate account security logic.

## Candidate decisions / ADRs

- None approved. Plan recommendations require owner approval before production auth/config changes.

## Candidate lessons and capability evidence

- Prior account-center recovery task already implemented the baseline; future work should extend rather than recreate it.
