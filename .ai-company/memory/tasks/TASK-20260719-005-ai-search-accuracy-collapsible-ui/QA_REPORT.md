# QA Report — TASK-20260719-005

## Verdict

PASS for the scoped production release.

## Verified behavior

- The full natural phrase resolves to an iPhone 15 device-only repository constraint.
- Empty, numeric, conflicting and mixed provider device plans cannot broaden the query.
- A repository result that violates the effective device constraint fails closed.
- Model reconciliation retains one provider call and one durable settlement.
- Local, order reference, amount review, permissions, cancellation, offline and latest-intent behavior remain green.
- Usage and processing disclosures default collapsed, expose ARIA state, preserve the selected mode and keep model external-send meaning visible.
- 390px, 430px and desktop browser paths have no horizontal overflow.

## Gate evidence

- Focused Vitest: 174 passed, followed by final full regression.
- Full Vitest after rebasing onto latest `origin/main`: 309 files, 1997 tests passed.
- ESLint: passed.
- TypeScript: passed.
- AI Playwright: all 11 scenarios passed across bounded batches.
- Production webpack build: passed, 26 routes generated.
- `git diff --check`: clean.

## Production verification

- Business commit `d9c86ac1c3a93782d33e3d22732758894eecadba` was pushed non-force on top of `50f843dd`.
- Vercel deployment `dpl_4k8Jt4wCwCErZqz4m4SN9rfo5xEf` reported the exact Git SHA and completed its native Turbopack build READY.
- `www.chinatech.in` and `chinatech.in` both resolve to that deployment; anonymous `/orders` redirects to login and finishes 200, while anonymous AI capabilities returns 401.
- Error-level runtime log query after smoke returned no entries.

## Residual evidence boundary

No existing authenticated ChinaTech browser session was available in this execution environment, so no paid live model turn was consumed after deployment. The explicit-model phrase is covered by service/repository tests and 11 local browser scenarios; this limitation does not weaken the exact deployment, anonymous authorization or build evidence and is not represented as a live authenticated smoke.

## Tooling note

`npm run build` selected Turbopack and rejected the isolated worktree's external `node_modules` symlink. The same candidate passed `next build --webpack`; the failure is an isolated dependency-layout limitation, not an application compile error. The exact Vercel deployment remains the production build authority.
