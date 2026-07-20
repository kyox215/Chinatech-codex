# Evidence — TASK-20260720-002

| ID | Stage | Claim | Evidence | Result |
|---|---|---|---|---|
| E-001 | baseline | Isolated implementation starts from current remote | `/private/tmp/repairdesk-print-safari-fix-20260720`, branch `codex/print-safari-fix-20260720`, HEAD/remote `0a0ec0f5a7b3aa4fc992977da172732576686379` | PASS |
| E-002 | focused | Print/guard/session focused tests | 6 files, 23 tests | PASS |
| E-003 | browser | Chromium print media, task print and immediate second intake | `npm run test:e2e:print-safari:mock`, 4/4 | PASS |
| E-004 | browser | WebKit print media and immediate second intake at 390/1440 | `PLAYWRIGHT_BROWSER=webkit npm run test:e2e:print-safari:mock`, 4/4 | PASS |
| E-005 | PDF | Standard ticket is one A4 page | `screenshots/TASK-20260720-002-print-safari-reliability-fixes/repair-order-standard.pdf`, PDF page tree `Pages=1` | PASS |
| E-006 | PDF | Long content continues instead of clipping | `screenshots/TASK-20260720-002-print-safari-reliability-fixes/repair-order-long-content.pdf`, PDF page tree `Pages=2`; print overflow `visible` | PASS |
| E-007 | visual | WebKit/Chromium print and second-intake screenshots | `screenshots/TASK-20260720-002-print-safari-reliability-fixes/` | PASS |
| E-008 | full gate | Lint/type/full unit/build | lint PASS; typecheck PASS; 321 files/2108 tests PASS; production build PASS | PASS |
| E-009 | security | Production E2E bypass flags absent | Vercel production env-name listing contains neither `REPAIRDESK_E2E_ORDER_AUDIT` nor `REPAIRDESK_E2E_BUSINESS_DESKTOP` | PASS |
| E-010 | release | Pre-release rollback target | current READY production `https://chinatech-codex-21k1mhy9q-kyox120-9295s-projects.vercel.app` | RECORDED |

## Current gate

- Automated candidate gate: PASS.
- Physical-device gate: pending owner-side Safari native dialog/HP paper confirmation after production. Automated WebKit and Chromium PDF evidence does not operate the actual HP printer.
- Database migration/apply: N/A; no schema or data changes.

Do not record secrets, production credentials, full customer PII or unsupported pass claims.
