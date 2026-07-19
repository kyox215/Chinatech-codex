# QA Report — TASK-20260719-005

## Verdict

PASS for release candidate. Production release verification remains pending.

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

## Tooling note

`npm run build` selected Turbopack and rejected the isolated worktree's external `node_modules` symlink. The same candidate passed `next build --webpack`; the failure is an isolated dependency-layout limitation, not an application compile error. The exact Vercel deployment remains the production build authority.
