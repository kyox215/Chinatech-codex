# Evidence

| ID | Evidence | Status |
|---|---|---|
| E-001 | User mobile screenshot: “有没有什么是金额异常的” returned generic no-match/search copy | verified |
| E-002 | `order-intent-router.ts`: only exact references and three locked searches bypass provider | verified |
| E-003 | `contracts.ts`: `search_orders` has search/view/paid/overdue/queue only | verified |
| E-004 | `openai-responses-provider.ts`: Responses API uses strict tools and `tool_choice: required` | verified |
| E-005 | `order-assistant.service.ts`: zero-card search always asks for order/customer/device details | verified |
| E-006 | OpenAI function-calling guide: clear tool/parameter descriptions, strict schemas and evals are recommended | verified current 2026-07-19 |
| E-007 | Domain/router/provider/service/repository focused regressions are included in the 305-file full suite | PASS, 1930/1930 tests |
| E-008 | `npm run lint` and `npm run typecheck` | PASS |
| E-009 | `npx next build --webpack` | PASS, 26 static pages generated |
| E-010 | 390×844 in-app browser: exact screenshot phrase returns finance-review empty result; old order/customer/device prompt absent; scroll width equals viewport | PASS |
| E-011 | Playwright `mobile amount-anomaly` regression against local fake-provider BFF | PASS, 1/1 |
| E-012 | Screenshot `screenshots/TASK-20260719-002-ai-order-query-understanding/amount-anomaly-mobile-390.png` | verified sanitized local mock page |
| E-013 | Diff/secret boundary: no env/key/migration/dependency changes; no order amount or new PII in AI cards/provider payload | PASS |
- `2026-07-19T08:24:39Z` `88ece4ef4d` — isolated branch head; screenshot amount-anomaly-mobile-390.png; no migration, key read, paid call, push or deploy
