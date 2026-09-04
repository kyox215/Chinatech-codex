# CEO Report — Lightweight i18n restart closeout

Date: 2026-09-04
Status: B) RELEASED / CLOSED

## Outcome

The scoped `zh-CN` / `it-IT` / `en` delivery is released and closed. Exact production SHA
`bc892381b2fef0adeca27b5a6599f638ba126c5b` passed hosted CI run `33866260693`; Vercel deployment
`dpl_Uutsq62tprPP3njcQGe1zwCzTh85` is READY on `www.chinatech.in` and `chinatech.in`. No remote SQL,
migration, environment/secret, production-data or customer-data mutation occurred.

## Acceptance matrix

| Acceptance                                                                                         | Result                     | Evidence                                                                                                 |
| -------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Remaining page groups enumerated and delivered in one four-group batch                             | PASS                       | Memos, Toolkit, Platform, AI client production/test diff                                                 |
| Fixed UI/ARIA/validation/fallback supports all three locales                                       | PASS                       | 13 target files / 84 tests; catalog parity/token tests                                                   |
| Locale switching preserves relevant local state and causes no extra business action                | PASS                       | mounted Memos, Toolkit, Platform and AI tests                                                            |
| Dynamic values and canonical API/query/cache/payload/permission/workflow behavior remain unchanged | PASS                       | exact mounted fixtures, payload assertions, independent QA and diff review                               |
| Localization-caused responsive/a11y issues                                                         | PASS for direct i18n P0/P1 | static layout review plus controlled 390/1440 browser checks; no direct-i18n P0/P1                       |
| Final unified browser story                                                                        | CONDITIONAL                | Memos/Toolkit pass; Platform/AI stop on unrelated Escape focus-return P2 after page/locale/layout checks |
| Release to `main` and production                                                                   | PASS / RELEASED            | E-100: exact SHA hosted green; matching Vercel deployment READY on both canonical aliases                 |

## Verification

- Targeted Vitest: 13 files / 84 tests PASS; stderr and React `act` warnings: 0.
- TypeScript: PASS.
- Scoped ESLint, Prettier and `git diff --check`: PASS.
- Independent module QA: PASS; direct-i18n P0 0, P1 0.
- Chromium final-story attempts: each ended 2/4 PASS. The final attempt completed Memos and Toolkit;
  Platform and AI had already passed their current locale/viewport/dynamic/ARIA/overflow iteration
  before failing the out-of-scope Escape focus-return assertion. The experimental failing spec was
  removed from the source candidate; traces and screenshots were retained as evidence.

## Residual risk and ownership

- `QA-BACKLOG-20260903-001`: Platform mobile controlled Dialog and AI mobile controlled Sheet do not
  return focus to their launch trigger after Escape in the synthetic Chromium story. Severity P2,
  owner Frontend + QA, separate task before the next related interaction release.
- AI Italian/English canonical-suggestion request was not reached in the browser story because the
  focus assertion stopped the test. Component tests prove locale-switch draft preservation and zero
  business action; the source maps localized labels to unchanged canonical Chinese request values.
- The complete multi-release candidate and task evidence are now frozen in an exact staged path set.
  It must not be presented as a clean exact-SHA release until commit, hosted gates and deployment pass.

## Documentation impact matrix

| Reader             | Authoritative update                                       | Result                                                      |
| ------------------ | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Product/support    | Supported employee locales and dynamic-content boundary    | `docs/EMPLOYEE_INTERFACE_I18N.md` updated                   |
| Frontend/QA        | Completed Release 2B local coverage and browser limitation | employee i18n declaration and untranslated UI audit updated |
| Release/operations | Owner-approved exact-scope release in progress              | this report and Task Memory                                 |
| API/data/security  | No contract, schema, permission or production change       | no API/data/security runbook update required                |

## Rollback

Before production changes, the candidate can be unstaged or forward-reverted. After release, source
rollback uses a normal forward revert and production rollback promotes the recorded previous READY
deployment. Screenshot/test-result artifacts are synthetic and contain no production credentials or
customer PII.

## Final release record

Owner approval was executed within the exact-scope contract. Accepted production baseline:
`bc892381...` / `dpl_Uutsq62tprPP3njcQGe1zwCzTh85`. Rollback baseline:
`f70dd754...` / `dpl_DxdSwxKvdxRfVM5bktkSk4WstfNz`. The release is formally **B) RELEASED / CLOSED**.
