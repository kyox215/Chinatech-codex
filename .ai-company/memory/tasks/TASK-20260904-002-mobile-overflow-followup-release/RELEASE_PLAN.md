# Release Plan — TASK-20260904-002-mobile-overflow-followup-release

## Decision

GO is permitted only for the exact candidate below. The prior tri-language release is formally
`B) RELEASED / CLOSED` at `bc892381b2fef0adeca27b5a6599f638ba126c5b`, tree
`93aebaf21114b303ae42ebf345abb58ffcd697f3`, hosted CI run `33866260693` success, and Vercel
deployment `dpl_Uutsq62tprPP3njcQGe1zwCzTh85` READY on both canonical aliases.

## Frozen candidate

- `.ai-company/memory/ACTIVE_CONTEXT.md`
- `.ai-company/memory/tasks/TASK-20260901-002-site-i18n-optimization-release/{TASK.md,CHECKPOINTS.md,EVIDENCE.md,CEO_REPORT.md,HANDOFF.md}`
- `.ai-company/memory/tasks/TASK-20260904-001-mobile-overflow-audit-fix/`
- `.ai-company/memory/tasks/TASK-20260904-002-mobile-overflow-followup-release/`
- `src/features/dashboard/components/dashboard-quick-start.tsx`
- `src/features/messages/screens/messages-screen.tsx`
- `tests/e2e/dashboard-quick-start.spec.ts`
- `tests/e2e/visual-overflow.spec.ts`
- `screenshots/TASK-20260904-001-mobile-overflow-audit-fix/`

Explicitly excluded: `.ai-company/memory/tasks/TASK-20260902-001-project-function-health-audit/`,
`screenshots/release2b1/` through `screenshots/release2b5/`, `test-results/`, `.next/`, environment
files, secrets, production/customer data, schema and migrations. `next-env.d.ts` is restored to the
tracked production route-types import and is not part of the candidate.

## Gate evidence

- Node `v22.12.0` production build: PASS, 30/30 static generation.
- Node 22 focused core Chromium: PASS 9/9, one worker, retries zero.
- The first production-server E2E attempt was an invalid harness for these synthetic authenticated
  stories because `isRepairDeskE2eSystemActor` intentionally disables the bypass in production. It
  reached explicit permission/error fallbacks and made no mutation. One root-cause re-verification
  with the repository's development E2E server passed 9/9.
- Focused unit/static evidence: scoped ESLint PASS; typecheck PASS; Dashboard + Messages Vitest
  54/54 PASS; targeted Chromium 5/5 + 4/4 PASS.
- Exact baseline Git, hosted CI, Vercel READY, canonical aliases and rollback anchor are recorded in
  E-010 and the prior task E-100.
- Independent UX found no P0/P1 after the Messages correction. Final QA and Release reviewers must
  accept the corrected report, exact manifest and Node 22 final gate before push.

## Release and rollback

1. Verify integration lease holder/version/expiry and fresh-fetch `origin/main`.
2. Stage only the frozen paths; run cached name, diff, whitespace and sensitive-pattern checks.
3. Create a normal commit and non-force push to `main`.
4. Require hosted CI success for the exact new SHA and Git-integrated Vercel production deployment
   READY for the same SHA; no manual project link, env, domain, database or migration change.
5. Verify both canonical domains with read-only smoke and a bounded error/5xx query.
6. On failure, promote prior READY `bc892381...` / `dpl_Uutsq62tprPP3njcQGe1zwCzTh85` or create
   a normal forward revert. Never rewrite history or force-push.
