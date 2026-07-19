# Quality Gate — AI 自然语言订单查询 V3

## Conclusion

**PASS for exact-SHA production release.** No open product, permission, data, security or build blocker remains.

## Acceptance matrix

| Area | Verification | Result |
|---|---|---|
| Exact reported sentence | Fixed-clock service test proves iPhone 15 + 2026-01-19..2026-07-19 + all orders + no invented finance filter | PASS |
| Model deviation | Adversarial provider cannot inject Samsung, previous month, amount anomaly, active-only, payment or workflow filters | PASS |
| Arbitrary dates | Absolute/open/range, rolling N, calendar periods, arbitrary month/year/quarter and all-time; invalid/reversed/ambiguous input fails closed | PASS |
| Device boundary | Apple iPhone 15 family accepted; Samsung, iPhone 14 and iPhone 150 excluded | PASS |
| Explainability | Exact scope/date/timezone/source and interpretation state render; zero and partial results are unambiguous | PASS |
| Inline interaction | Details expand inside the sheet; navigation occurs only from the explicit order link; query adjustment does not auto-send | PASS |
| Tenant/RBAC | Existing store actor flows retained; archive/all scope now has an explicit server permission gate | PASS |
| PII/model egress | Existing PII denial remains; only validated calendar tokens are redacted before the numeric detector | PASS |
| Writes | Inline actions remain disabled; no DB/schema/config/secret change | PASS |
| Automated gates | final rebased candidate: lint; typecheck; 311 test files / 2,033 tests; 156 focused tests; Webpack production build | PASS |
| Browser | Changed Apple local/model paths 2/2; 390/430/768/1280 no horizontal overflow; no browser warning/error | PASS |

## Reliability note

The full Playwright file exercises a development-only auth bypass that source code intentionally disables under `NODE_ENV=production`. Repeated serial or highly concurrent runs against Next dev can stall hydration at the existing store-context readiness wait. The changed Apple scenarios pass in independent Chromium workers, manual browser inspection passes, and the real production build passes. This is recorded as a local harness limitation, not silently retried into a false all-green claim.

## Reproduction

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npx next build --webpack`
- `REPAIRDESK_E2E_BUSINESS_DESKTOP=1 ... npx next dev --webpack -H 127.0.0.1 -p 3114`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3114 REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx playwright test --workers=2 tests/e2e/ai-assistant-staff.spec.ts --grep "mobile Apple 15 query excludes|mobile model mode"`

## Residual product boundaries

- Date years are bounded to 1900–2199 and rolling amounts to 1–120.
- Archive/all-history queries require `order:archive_browse`; there is no silent downgrade.
- Service-group matches are quote/catalog evidence, not proof that a physical repair was completed.
- Parts-needed matches are order-level markers, not a supplier purchase-order ledger.
